CREATE OR REPLACE FUNCTION public.archive_admin_user_preserve_sales(p_admin_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_role text;
BEGIN
  SELECT role::text INTO v_caller_role
  FROM public.admin_users
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;

  IF v_caller_role NOT IN ('super_admin', 'admin', 'sales_manager') THEN
    RAISE EXCEPTION 'Only management can archive staff users';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE id = p_admin_user_id) THEN
    RAISE EXCEPTION 'Staff user not found';
  END IF;

  -- Remove only operational / scheduling rows. Keep every row that
  -- represents a sales record or attribution so Customer Management,
  -- commission history, deal history and audit trails stay intact.
  DELETE FROM public.user_presence WHERE admin_user_id = p_admin_user_id;
  DELETE FROM public.user_daily_online_time WHERE admin_user_id = p_admin_user_id;
  DELETE FROM public.agent_schedules WHERE admin_user_id = p_admin_user_id;
  DELETE FROM public.agent_distribution_caps WHERE admin_user_id = p_admin_user_id;
  DELETE FROM public.agent_daily_targets WHERE agent_id = p_admin_user_id;
  DELETE FROM public.sales_targets WHERE admin_user_id = p_admin_user_id;
  DELETE FROM public.overflow_recipients WHERE admin_user_id = p_admin_user_id;
  DELETE FROM public.user_badges WHERE user_id = p_admin_user_id;
  DELETE FROM public.lead_quick_notes WHERE created_by = p_admin_user_id;
  DELETE FROM public.lead_team_members WHERE admin_user_id = p_admin_user_id;

  -- Reassign live/unfinished work off the agent, but keep historical
  -- attribution (payment_confirmed_by, quote_sent_by, commission_records,
  -- deal_records, salesperson_stats, sales_leads history, etc).
  UPDATE public.sales_leads SET assigned_to = NULL WHERE assigned_to = p_admin_user_id;
  UPDATE public.lead_distribution_settings SET overflow_recipient_id = NULL WHERE overflow_recipient_id = p_admin_user_id;
  UPDATE public.lead_distribution_settings SET solo_agent_id = NULL WHERE solo_agent_id = p_admin_user_id;
  UPDATE public.round_robin_state SET last_assigned_user_id = NULL WHERE last_assigned_user_id = p_admin_user_id;

  -- Mark the account archived. Do NOT delete the admin_users row — every FK
  -- that points here must keep resolving so historical sales records still show
  -- the agent's name in Customer Management.
  UPDATE public.admin_users
     SET is_active = false,
         archived_at = COALESCE(archived_at, now()),
         updated_at = now()
   WHERE id = p_admin_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.archive_admin_user_preserve_sales(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_admin_user_preserve_sales(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_admin_user_preserve_sales(uuid) TO service_role;