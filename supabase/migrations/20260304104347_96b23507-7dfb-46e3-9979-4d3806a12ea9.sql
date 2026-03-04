
-- Seed the changelog with current state of all leads as baseline snapshot
INSERT INTO sales_leads_changelog (lead_id, changed_by, change_type, new_assigned_to, new_status, new_notes, new_priority, new_call_count, new_is_paid, new_payment_amount, new_next_action_type, new_next_action_date, new_record)
SELECT id, NULL, 'snapshot', assigned_to, status, notes, priority, call_count, is_paid, payment_amount, next_action_type, next_action_date, to_jsonb(sl)
FROM sales_leads sl;
