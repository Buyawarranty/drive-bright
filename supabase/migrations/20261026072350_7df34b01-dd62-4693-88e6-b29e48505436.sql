ALTER TABLE public.sales_leads ADD COLUMN IF NOT EXISTS management_hold boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.release_management_hold_on_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NEW.management_hold = true THEN
    NEW.management_hold := false;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS release_management_hold_on_assignment ON public.sales_leads;
CREATE TRIGGER release_management_hold_on_assignment
BEFORE UPDATE ON public.sales_leads
FOR EACH ROW
EXECUTE FUNCTION public.release_management_hold_on_assignment();

CREATE OR REPLACE FUNCTION public.claim_lead_for_agent(p_lead_id uuid, p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_agent_cap RECORD;
    v_lead RECORD;
    v_agent_role text;
    v_settings RECORD;
    v_now timestamp with time zone := now();
    v_is_solo_agent boolean := false;
    v_is_overflow boolean := false;
BEGIN
    SELECT * INTO v_settings FROM public.lead_distribution_settings LIMIT 1;
    v_is_solo_agent := (v_settings.solo_mode_enabled AND v_settings.solo_agent_id = p_agent_id);

    SELECT role INTO v_agent_role FROM public.admin_users WHERE id = p_agent_id AND is_active = true;

    IF v_agent_role IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agent not found.');
    END IF;

    IF v_agent_role = 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Administrators cannot claim leads.');
    END IF;

    SELECT * INTO v_lead FROM public.sales_leads WHERE id = p_lead_id;
    IF v_lead IS NULL THEN
        SELECT * INTO v_lead FROM public.abandoned_carts WHERE id = p_lead_id;
        IF v_lead IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Lead not found.');
        END IF;
    END IF;

    IF COALESCE((v_lead.management_hold)::boolean, false) = true THEN
        RETURN jsonb_build_object('success', false, 'error', 'This lead is held for management review and cannot be claimed.');
    END IF;

    SELECT * INTO v_agent_cap FROM public.agent_distribution_caps WHERE admin_user_id = p_agent_id;

    IF v_agent_cap IS NULL THEN
        INSERT INTO public.agent_distribution_caps (admin_user_id, daily_cap, assigned_today, paused)
        VALUES (p_agent_id, 20, 0, false)
        RETURNING * INTO v_agent_cap;
    END IF;

    IF v_agent_cap.paused = true THEN
        RETURN jsonb_build_object('success', false, 'error', 'Your lead receiving is currently paused.');
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.overflow_recipients o
        LEFT JOIN public.agent_distribution_caps adc ON adc.admin_user_id = o.admin_user_id
        JOIN public.admin_users au ON au.id = o.admin_user_id
        WHERE o.admin_user_id = p_agent_id
          AND o.is_active = true
          AND au.is_active = true
          AND COALESCE(adc.paused, false) = false
    ) INTO v_is_overflow;

    IF NOT v_is_solo_agent AND NOT v_is_overflow THEN
        IF v_agent_cap.daily_cap IS NOT NULL AND v_agent_cap.assigned_today >= v_agent_cap.daily_cap THEN
            RETURN jsonb_build_object('success', false, 'error', 'You have reached your daily lead cap.');
        END IF;
    END IF;

    UPDATE public.sales_leads
    SET assigned_to = p_agent_id, updated_at = v_now
    WHERE id = p_lead_id;

    UPDATE public.agent_distribution_caps
    SET assigned_today = assigned_today + 1, last_assigned_at = v_now
    WHERE admin_user_id = p_agent_id;

    RETURN jsonb_build_object('success', true, 'message', 'Lead successfully claimed!');
END;
$function$;