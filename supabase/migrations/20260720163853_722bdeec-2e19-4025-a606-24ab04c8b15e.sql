
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.archive_admin_user_preserve_sales(p_admin_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Remove only operational / scheduling rows. Keep every row that
  -- represents a sales record or attribution so Customer Management,
  -- commission history, deal history and audit trails stay intact.
  DELETE FROM user_presence WHERE admin_user_id = p_admin_user_id;
  DELETE FROM user_daily_online_time WHERE admin_user_id = p_admin_user_id;
  DELETE FROM agent_schedules WHERE admin_user_id = p_admin_user_id;
  DELETE FROM agent_distribution_caps WHERE admin_user_id = p_admin_user_id;
  DELETE FROM agent_daily_targets WHERE agent_id = p_admin_user_id;
  DELETE FROM sales_targets WHERE admin_user_id = p_admin_user_id;
  DELETE FROM overflow_recipients WHERE admin_user_id = p_admin_user_id;
  DELETE FROM user_badges WHERE user_id = p_admin_user_id;
  DELETE FROM lead_quick_notes WHERE created_by = p_admin_user_id;

  -- Reassign live/unfinished work off the agent, but keep historical
  -- attribution (payment_confirmed_by, quote_sent_by, commission_records,
  -- deal_records, salesperson_stats, sales_leads history, etc).
  UPDATE sales_leads SET assigned_to = NULL WHERE assigned_to = p_admin_user_id;
  UPDATE lead_distribution_settings SET overflow_recipient_id = NULL WHERE overflow_recipient_id = p_admin_user_id;
  UPDATE lead_distribution_settings SET solo_agent_id = NULL WHERE solo_agent_id = p_admin_user_id;
  UPDATE round_robin_state SET last_assigned_user_id = NULL WHERE last_assigned_user_id = p_admin_user_id;

  -- Mark the account archived. Do NOT delete the admin_users row —
  -- every FK that points here (customers.assigned_to,
  -- customers.payment_confirmed_by, customers.quote_sent_by,
  -- commission_records.admin_user_id, deal_records.admin_user_id,
  -- salesperson_stats.user_id, etc.) must keep resolving so the sales
  -- record still shows the agent's name in Customer Management.
  UPDATE admin_users
     SET is_active = false,
         archived_at = COALESCE(archived_at, now())
   WHERE id = p_admin_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_admin_user_preserve_sales(UUID) TO authenticated;
