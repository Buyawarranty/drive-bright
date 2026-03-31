
DO $$
DECLARE
  dup_ids UUID[] := ARRAY['1fd81a2b-f636-43e7-ad99-3d942b4061ae', '831babd2-0057-4a29-b154-d3845fa3d33c']::UUID[];
  dup_policy_ids UUID[];
BEGIN
  -- Get all policy IDs for duplicate customers
  SELECT array_agg(id) INTO dup_policy_ids FROM customer_policies WHERE customer_id = ANY(dup_ids);
  
  -- Clean up all FK references to policies
  IF dup_policy_ids IS NOT NULL THEN
    DELETE FROM warranty_audit_log WHERE policy_id = ANY(dup_policy_ids);
    DELETE FROM trustpilot_review_emails WHERE policy_id = ANY(dup_policy_ids);
    DELETE FROM warranties_2000_audit_log WHERE policy_id = ANY(dup_policy_ids);
    DELETE FROM welcome_emails WHERE policy_id = ANY(dup_policy_ids);
    DELETE FROM customer_policies WHERE id = ANY(dup_policy_ids);
  END IF;
  
  -- Clean up all FK references to customers
  DELETE FROM admin_notes WHERE customer_id = ANY(dup_ids);
  DELETE FROM payments WHERE customer_id = ANY(dup_ids);
  DELETE FROM warranty_audit_log WHERE customer_id = ANY(dup_ids);
  DELETE FROM email_logs WHERE customer_id = ANY(dup_ids);
  DELETE FROM scheduled_emails WHERE customer_id = ANY(dup_ids);
  DELETE FROM customer_notifications WHERE customer_id = ANY(dup_ids);
  DELETE FROM customer_tag_assignments WHERE customer_id = ANY(dup_ids);
  DELETE FROM trustpilot_review_emails WHERE customer_id = ANY(dup_ids);
  DELETE FROM warranties_2000_audit_log WHERE customer_id = ANY(dup_ids);
  DELETE FROM structured_customer_notes WHERE customer_id = ANY(dup_ids);
  DELETE FROM deal_records WHERE customer_id = ANY(dup_ids);
  DELETE FROM posted_letters_log WHERE customer_id = ANY(dup_ids);
  DELETE FROM commission_claims WHERE customer_id = ANY(dup_ids);
  
  -- Delete duplicate customers
  DELETE FROM customers WHERE id = ANY(dup_ids);
END $$;
