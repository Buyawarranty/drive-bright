ALTER TABLE public.admin_users ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.admin_users DROP CONSTRAINT admin_users_user_id_fkey;
ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.protect_agent_sales_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM customers WHERE assigned_to = OLD.id OR sale_credit_admin_user_id = OLD.id OR payment_confirmed_by = OLD.id OR quote_sent_by = OLD.id)
     OR EXISTS (SELECT 1 FROM commission_records WHERE admin_user_id = OLD.id)
     OR EXISTS (SELECT 1 FROM deal_records WHERE admin_user_id = OLD.id)
     OR EXISTS (SELECT 1 FROM customer_policies WHERE quote_sent_by = OLD.id) THEN
    RAISE EXCEPTION 'This staff member has sales on record and cannot be deleted — archive them instead so their sales history is kept.';
  END IF;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_agent_sales_history ON public.admin_users;
CREATE TRIGGER trg_protect_agent_sales_history BEFORE DELETE ON public.admin_users
FOR EACH ROW EXECUTE FUNCTION public.protect_agent_sales_history();

CREATE OR REPLACE FUNCTION public.delete_admin_user_cascade(p_admin_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Never strip sales attribution: archive instead of deleting.
  PERFORM public.archive_admin_user_preserve_sales(p_admin_user_id);
END; $$;

CREATE OR REPLACE FUNCTION public.archive_admin_user_preserve_sales(p_admin_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_caller_role text;
BEGIN
  SELECT role::text INTO v_caller_role FROM public.admin_users
  WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
  IF v_caller_role NOT IN ('super_admin', 'admin', 'sales_manager') THEN
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
  -- Only open leads move off the agent; converted/upgraded leads keep their name.
  UPDATE public.sales_leads SET assigned_to = NULL
   WHERE assigned_to = p_admin_user_id AND status NOT IN ('converted','upgraded','upsell');
  UPDATE public.lead_distribution_settings SET overflow_recipient_id = NULL WHERE overflow_recipient_id = p_admin_user_id;
  UPDATE public.lead_distribution_settings SET solo_agent_id = NULL WHERE solo_agent_id = p_admin_user_id;
  UPDATE public.round_robin_state SET last_assigned_user_id = NULL WHERE last_assigned_user_id = p_admin_user_id;
  UPDATE public.admin_users SET is_active = false, archived_at = COALESCE(archived_at, now()), updated_at = now()
   WHERE id = p_admin_user_id;
END; $function$;