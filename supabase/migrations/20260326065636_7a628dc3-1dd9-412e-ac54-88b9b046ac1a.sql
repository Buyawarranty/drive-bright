-- Add ON DELETE SET NULL/CASCADE to FKs that are missing it and cause delete failures
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_payment_confirmed_by_fkey;
ALTER TABLE customers ADD CONSTRAINT customers_payment_confirmed_by_fkey 
  FOREIGN KEY (payment_confirmed_by) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_quote_sent_by_fkey;
ALTER TABLE customers ADD CONSTRAINT customers_quote_sent_by_fkey 
  FOREIGN KEY (quote_sent_by) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE sales_leads DROP CONSTRAINT IF EXISTS sales_leads_assigned_to_fkey;
ALTER TABLE sales_leads ADD CONSTRAINT sales_leads_assigned_to_fkey 
  FOREIGN KEY (assigned_to) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE lead_activities DROP CONSTRAINT IF EXISTS lead_activities_performed_by_fkey;
ALTER TABLE lead_activities ADD CONSTRAINT lead_activities_performed_by_fkey 
  FOREIGN KEY (performed_by) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE lead_assignment_audit DROP CONSTRAINT IF EXISTS lead_assignment_audit_assigned_to_id_fkey;
ALTER TABLE lead_assignment_audit ADD CONSTRAINT lead_assignment_audit_assigned_to_id_fkey 
  FOREIGN KEY (assigned_to_id) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE lead_tag_assignments DROP CONSTRAINT IF EXISTS lead_tag_assignments_assigned_by_fkey;
ALTER TABLE lead_tag_assignments ADD CONSTRAINT lead_tag_assignments_assigned_by_fkey 
  FOREIGN KEY (assigned_by) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE lead_quick_notes DROP CONSTRAINT IF EXISTS lead_quick_notes_created_by_fkey;
ALTER TABLE lead_quick_notes ADD CONSTRAINT lead_quick_notes_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE structured_customer_notes DROP CONSTRAINT IF EXISTS structured_customer_notes_created_by_fkey;
ALTER TABLE structured_customer_notes ADD CONSTRAINT structured_customer_notes_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE structured_customer_notes DROP CONSTRAINT IF EXISTS structured_customer_notes_updated_by_fkey;
ALTER TABLE structured_customer_notes ADD CONSTRAINT structured_customer_notes_updated_by_fkey 
  FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE salesperson_stats DROP CONSTRAINT IF EXISTS salesperson_stats_user_id_fkey;
ALTER TABLE salesperson_stats ADD CONSTRAINT salesperson_stats_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE;

ALTER TABLE user_badges DROP CONSTRAINT IF EXISTS user_badges_user_id_fkey;
ALTER TABLE user_badges ADD CONSTRAINT user_badges_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE;

ALTER TABLE user_daily_online_time DROP CONSTRAINT IF EXISTS user_daily_online_time_admin_user_id_fkey;
ALTER TABLE user_daily_online_time ADD CONSTRAINT user_daily_online_time_admin_user_id_fkey 
  FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE;

ALTER TABLE selling_tips DROP CONSTRAINT IF EXISTS selling_tips_created_by_fkey;
ALTER TABLE selling_tips ADD CONSTRAINT selling_tips_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE selling_tips DROP CONSTRAINT IF EXISTS selling_tips_resolved_by_fkey;
ALTER TABLE selling_tips ADD CONSTRAINT selling_tips_resolved_by_fkey 
  FOREIGN KEY (resolved_by) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE round_robin_state DROP CONSTRAINT IF EXISTS round_robin_state_last_assigned_user_id_fkey;
ALTER TABLE round_robin_state ADD CONSTRAINT round_robin_state_last_assigned_user_id_fkey 
  FOREIGN KEY (last_assigned_user_id) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE lead_distribution_settings DROP CONSTRAINT IF EXISTS lead_distribution_settings_solo_agent_id_fkey;
ALTER TABLE lead_distribution_settings ADD CONSTRAINT lead_distribution_settings_solo_agent_id_fkey 
  FOREIGN KEY (solo_agent_id) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE lead_distribution_settings DROP CONSTRAINT IF EXISTS lead_distribution_settings_overflow_recipient_id_fkey;
ALTER TABLE lead_distribution_settings ADD CONSTRAINT lead_distribution_settings_overflow_recipient_id_fkey 
  FOREIGN KEY (overflow_recipient_id) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE agent_daily_targets DROP CONSTRAINT IF EXISTS agent_daily_targets_set_by_fkey;
ALTER TABLE agent_daily_targets ADD CONSTRAINT agent_daily_targets_set_by_fkey 
  FOREIGN KEY (set_by) REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE commission_claims DROP CONSTRAINT IF EXISTS commission_claims_reviewed_by_fkey;
ALTER TABLE commission_claims ADD CONSTRAINT commission_claims_reviewed_by_fkey 
  FOREIGN KEY (reviewed_by) REFERENCES admin_users(id) ON DELETE SET NULL;

-- Update the cascade function to be comprehensive
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