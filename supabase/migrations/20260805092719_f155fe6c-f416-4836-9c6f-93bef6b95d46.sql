-- 1. Rotation must never try to level daily totals (that causes catch-up bursts
--    for late starters, new joiners and agents returning from holiday).
CREATE OR REPLACE FUNCTION public.get_next_eligible_agent(p_exclude_agent_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_settings RECORD;
    v_next_agent_id UUID;
BEGIN
    PERFORM reset_daily_caps();

    SELECT * INTO v_settings FROM lead_distribution_settings LIMIT 1;

    IF v_settings.solo_mode_enabled AND v_settings.solo_agent_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM admin_users WHERE id = v_settings.solo_agent_id AND role != 'admin') THEN
            RETURN v_settings.solo_agent_id;
        END IF;
    END IF;

    SELECT adc.admin_user_id INTO v_next_agent_id
    FROM agent_distribution_caps adc
    INNER JOIN admin_users au ON au.id = adc.admin_user_id
    LEFT JOIN user_presence up ON up.admin_user_id = adc.admin_user_id
    WHERE au.is_active = true
        AND au.role != 'admin'
        AND adc.paused = false
        AND COALESCE(up.is_paused_receiving, false) = false
        AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
        AND (p_exclude_agent_id IS NULL OR adc.admin_user_id != p_exclude_agent_id)
        AND (
            v_settings.active_only_distribution = false
            OR (
                up.status = 'online'
                AND up.last_interaction_at > now() - INTERVAL '90 seconds'
            )
        )
    -- Strict turn order: longest wait since last lead goes next. NEVER order by
    -- assigned_today, which would dump a catch-up batch on returning agents.
    ORDER BY adc.last_assigned_at ASC NULLS FIRST, adc.sort_order ASC NULLS LAST
    LIMIT 1;

    IF v_next_agent_id IS NULL AND v_settings.overflow_recipient_id IS NOT NULL THEN
        SELECT adc.admin_user_id INTO v_next_agent_id
        FROM agent_distribution_caps adc
        INNER JOIN admin_users au ON au.id = adc.admin_user_id
        LEFT JOIN user_presence up ON up.admin_user_id = adc.admin_user_id
        WHERE adc.admin_user_id = v_settings.overflow_recipient_id
            AND au.is_active = true
            AND au.role != 'admin'
            AND COALESCE(adc.paused, false) = false
            AND (
                v_settings.active_only_distribution = false
                OR up.status = 'online'
            );
    END IF;

    RETURN v_next_agent_id;
END;
$function$;

-- 2. New joiners / agents switched back on slot into the BACK of the rotation
--    and take their normal single turn from that point forward.
CREATE OR REPLACE FUNCTION public.agent_rejoins_rotation_at_back()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.last_assigned_at := COALESCE(NEW.last_assigned_at, now());
        RETURN NEW;
    END IF;

    -- Agent switched back on for receiving (holiday return, reinstatement)
    IF COALESCE(OLD.paused, false) = true AND COALESCE(NEW.paused, false) = false THEN
        NEW.last_assigned_at := now();
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agent_rejoins_rotation_at_back ON public.agent_distribution_caps;
CREATE TRIGGER trg_agent_rejoins_rotation_at_back
BEFORE INSERT OR UPDATE OF paused ON public.agent_distribution_caps
FOR EACH ROW EXECUTE FUNCTION public.agent_rejoins_rotation_at_back();