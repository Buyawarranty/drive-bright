-- 1) New agents start switched OFF for lead distribution
ALTER TABLE public.agent_distribution_caps ALTER COLUMN paused SET DEFAULT true;

CREATE OR REPLACE FUNCTION public.ensure_agent_distribution_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_active = true AND NEW.role IN ('sales', 'sales_lead') THEN
    -- IMPORTANT: new agents are created PAUSED. A manager must switch them on
    -- before they can receive any leads.
    INSERT INTO public.agent_distribution_caps (
      admin_user_id, daily_cap, assigned_today, paused, percentage, cap_reset_date
    )
    VALUES (NEW.id, 20, 0, true, 0, CURRENT_DATE)
    ON CONFLICT (admin_user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) No team / no lead-type configured => does NOT work new leads
CREATE OR REPLACE FUNCTION public.agent_works_new_leads(p_admin_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.lead_team_members
    WHERE admin_user_id = p_admin_user_id
      AND workstream_new_leads = true
  );
$function$;

-- 3) Generic picker must respect role + switched-on + new-leads flag
CREATE OR REPLACE FUNCTION public.get_next_eligible_agent(p_distribution_mode text DEFAULT 'round_robin'::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_selected_agent_id uuid;
    v_settings RECORD;
    v_now timestamp with time zone := now();
    v_active_threshold timestamp with time zone := v_now - interval '90 seconds';
BEGIN
    SELECT * INTO v_settings FROM lead_distribution_settings WHERE team_id IS NULL LIMIT 1;

    IF v_settings.solo_mode_enabled AND v_settings.solo_agent_id IS NOT NULL THEN
        SELECT au.id INTO v_selected_agent_id
        FROM admin_users au
        LEFT JOIN user_presence up ON up.admin_user_id = au.id
        LEFT JOIN agent_distribution_caps adc ON adc.admin_user_id = au.id
        WHERE au.id = v_settings.solo_agent_id
          AND au.is_active = true
          AND au.role IN ('sales','sales_lead')
          AND COALESCE(adc.paused, true) = false
          AND public.agent_works_new_leads(au.id)
          AND (up.is_paused_receiving IS NULL OR up.is_paused_receiving = false);
        RETURN v_selected_agent_id;
    END IF;

    IF p_distribution_mode IN ('round_robin', 'fixed_caps', 'percentage') THEN
        SELECT au.id INTO v_selected_agent_id
        FROM admin_users au
        JOIN agent_distribution_caps adc ON adc.admin_user_id = au.id
        JOIN user_presence up ON up.admin_user_id = au.id
        WHERE au.is_active = true
          AND au.role IN ('sales','sales_lead')
          AND adc.paused = false
          AND public.agent_works_new_leads(au.id)
          AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
          AND up.last_interaction_at >= v_active_threshold
          AND (up.is_paused_receiving IS NULL OR up.is_paused_receiving = false)
        ORDER BY adc.last_assigned_at NULLS FIRST, au.created_at ASC
        LIMIT 1;

        IF v_selected_agent_id IS NULL AND v_settings.overflow_recipient_id IS NOT NULL THEN
            SELECT au.id INTO v_selected_agent_id
            FROM admin_users au
            LEFT JOIN user_presence up ON up.admin_user_id = au.id
            LEFT JOIN agent_distribution_caps adc ON adc.admin_user_id = au.id
            WHERE au.id = v_settings.overflow_recipient_id
              AND au.is_active = true
              AND au.role IN ('sales','sales_lead')
              AND COALESCE(adc.paused, true) = false
              AND public.agent_works_new_leads(au.id)
              AND (up.is_paused_receiving IS NULL OR up.is_paused_receiving = false);
        END IF;

        RETURN v_selected_agent_id;
    END IF;

    RETURN NULL;
END;
$function$;