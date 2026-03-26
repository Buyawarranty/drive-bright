CREATE OR REPLACE FUNCTION public.delete_admin_user_cascade(p_admin_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Nullify all references first
  UPDATE customers SET assigned_to = NULL WHERE assigned_to = p_admin_user_id;
  UPDATE customers SET quote_sent_by = NULL WHERE quote_sent_by = p_admin_user_id;
  UPDATE customers SET payment_confirmed_by = NULL WHERE payment_confirmed_by = p_admin_user_id;
  UPDATE customer_policies SET quote_sent_by = NULL WHERE quote_sent_by = p_admin_user_id;
  UPDATE sales_leads SET assigned_to = NULL WHERE assigned_to = p_admin_user_id;
  UPDATE lead_distribution_settings SET overflow_recipient_id = NULL WHERE overflow_recipient_id = p_admin_user_id;
  UPDATE lead_distribution_settings SET solo_agent_id = NULL WHERE solo_agent_id = p_admin_user_id;
  UPDATE round_robin_state SET last_assigned_user_id = NULL WHERE last_assigned_user_id = p_admin_user_id;
  UPDATE commission_records SET admin_user_id = NULL WHERE admin_user_id = p_admin_user_id;
  UPDATE deal_records SET admin_user_id = NULL WHERE admin_user_id = p_admin_user_id;
  UPDATE user_activity_log SET admin_user_id = NULL WHERE admin_user_id = p_admin_user_id;
  UPDATE staff_timesheets SET admin_user_id = NULL WHERE admin_user_id = p_admin_user_id;
  UPDATE lead_call_logs SET agent_id = NULL WHERE agent_id = p_admin_user_id;
  UPDATE selling_tips SET created_by = NULL WHERE created_by = p_admin_user_id;
  UPDATE selling_tips SET resolved_by = NULL WHERE resolved_by = p_admin_user_id;
  UPDATE timesheet_bonuses SET admin_user_id = NULL WHERE admin_user_id = p_admin_user_id;
  UPDATE timesheet_bonuses SET reviewed_by = NULL WHERE reviewed_by = p_admin_user_id;
  UPDATE timesheet_comments SET author_id = NULL WHERE author_id = p_admin_user_id;
  UPDATE agent_daily_targets SET set_by = NULL WHERE set_by = p_admin_user_id;
  UPDATE commission_claims SET reviewed_by = NULL WHERE reviewed_by = p_admin_user_id;
  UPDATE lead_activities SET performed_by = NULL WHERE performed_by = p_admin_user_id;
  UPDATE lead_assignment_audit SET assigned_to_id = NULL WHERE assigned_to_id = p_admin_user_id;
  UPDATE lead_tag_assignments SET assigned_by = NULL WHERE assigned_by = p_admin_user_id;
  UPDATE structured_customer_notes SET created_by = NULL WHERE created_by = p_admin_user_id;
  UPDATE structured_customer_notes SET updated_by = NULL WHERE updated_by = p_admin_user_id;
  UPDATE lead_access_requests SET approved_by = NULL WHERE approved_by = p_admin_user_id;

  -- Delete dependent records
  DELETE FROM overflow_recipients WHERE admin_user_id = p_admin_user_id;
  DELETE FROM lead_quick_notes WHERE created_by = p_admin_user_id;
  DELETE FROM salesperson_stats WHERE user_id = p_admin_user_id;
  DELETE FROM user_badges WHERE user_id = p_admin_user_id;
  DELETE FROM user_daily_online_time WHERE admin_user_id = p_admin_user_id;
  DELETE FROM timesheet_comments WHERE admin_user_id = p_admin_user_id;
  DELETE FROM agent_distribution_caps WHERE admin_user_id = p_admin_user_id;
  DELETE FROM agent_daily_targets WHERE agent_id = p_admin_user_id;
  DELETE FROM agent_schedules WHERE admin_user_id = p_admin_user_id;
  DELETE FROM user_presence WHERE admin_user_id = p_admin_user_id;
  DELETE FROM sales_targets WHERE admin_user_id = p_admin_user_id;
  DELETE FROM commission_claims WHERE agent_id = p_admin_user_id;
  DELETE FROM lead_access_requests WHERE requested_by = p_admin_user_id;

  -- Finally delete the admin user
  DELETE FROM admin_users WHERE id = p_admin_user_id;
END;
$$;