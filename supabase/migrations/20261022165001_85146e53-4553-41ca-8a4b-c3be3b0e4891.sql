ALTER POLICY "Staff can view payment button clicks" ON public.payment_button_clicks USING ((SELECT public.is_active_admin_user((SELECT auth.uid()))));
GRANT INSERT ON public.payment_button_clicks TO anon, authenticated;

DROP POLICY IF EXISTS "System can insert changelog" ON public.sales_leads_changelog;
DROP POLICY IF EXISTS "System inserts shark_tank_audit" ON public.shark_tank_audit;
REVOKE INSERT, UPDATE, DELETE ON public.sales_leads_changelog, public.shark_tank_audit FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.sales_leads_changelog, public.shark_tank_audit TO service_role;

ALTER POLICY "Authenticated can insert phone events" ON public.phone_events WITH CHECK (agent_id = ANY (ARRAY(SELECT au.id FROM public.admin_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = true)));

CREATE OR REPLACE FUNCTION public.archive_admin_user_preserve_sales(p_admin_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_caller_role text;
BEGIN
  SELECT role::text INTO v_caller_role FROM public.admin_users
  WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'sales_manager') THEN
    RAISE EXCEPTION 'Only management can archive staff users';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE id = p_admin_user_id) THEN
    RAISE EXCEPTION 'Staff user not found';
  END IF;
  DELETE FROM public.user_presence WHERE admin_user_id = p_admin_user_id;
  DELETE FROM public.user_daily_online_time WHERE admin_user_id = p_admin_user_id;
  DELETE FROM public.agent_schedules WHERE admin_user_id = p_admin_user_id;
  DELETE FROM public.agent_distribution_caps WHERE admin_user_id = p_admin_user_id;
  DELETE FROM public.agent_daily_targets WHERE agent_id = p_admin_user_id;
  DELETE FROM public.overflow_recipients WHERE admin_user_id = p_admin_user_id;
  DELETE FROM public.lead_team_members WHERE admin_user_id = p_admin_user_id;
  UPDATE public.sales_leads SET assigned_to = NULL
   WHERE assigned_to = p_admin_user_id AND status NOT IN ('converted','upgraded','upsell');
  UPDATE public.lead_distribution_settings SET overflow_recipient_id = NULL WHERE overflow_recipient_id = p_admin_user_id;
  UPDATE public.lead_distribution_settings SET solo_agent_id = NULL WHERE solo_agent_id = p_admin_user_id;
  UPDATE public.round_robin_state SET last_assigned_user_id = NULL WHERE last_assigned_user_id = p_admin_user_id;
  UPDATE public.admin_users SET is_active = false, archived_at = COALESCE(archived_at, now()), updated_at = now()
   WHERE id = p_admin_user_id;
END; $function$;