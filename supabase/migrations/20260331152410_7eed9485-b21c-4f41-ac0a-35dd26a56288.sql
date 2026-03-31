
-- Clean all FK references for the duplicate Stephen Henson customer
DO $$
DECLARE
  dup_customer_id UUID := 'd58f6e77-e530-427d-99c6-da28830fb868';
  dup_policy_ids UUID[];
BEGIN
  -- Get policy IDs for this customer
  SELECT array_agg(id) INTO dup_policy_ids FROM customer_policies WHERE customer_id = dup_customer_id;
  
  -- Delete from all FK-referencing tables for policies
  IF dup_policy_ids IS NOT NULL THEN
    DELETE FROM warranty_audit_log WHERE policy_id = ANY(dup_policy_ids);
    DELETE FROM trustpilot_review_emails WHERE policy_id = ANY(dup_policy_ids);
    DELETE FROM warranties_2000_audit_log WHERE policy_id = ANY(dup_policy_ids);
    DELETE FROM welcome_emails WHERE policy_id = ANY(dup_policy_ids);
  END IF;
  
  -- Delete from all FK-referencing tables for customer
  DELETE FROM admin_notes WHERE customer_id = dup_customer_id;
  DELETE FROM payments WHERE customer_id = dup_customer_id;
  DELETE FROM warranty_audit_log WHERE customer_id = dup_customer_id;
  DELETE FROM email_logs WHERE customer_id = dup_customer_id;
  DELETE FROM scheduled_emails WHERE customer_id = dup_customer_id;
  DELETE FROM customer_notifications WHERE customer_id = dup_customer_id;
  DELETE FROM customer_tag_assignments WHERE customer_id = dup_customer_id;
  DELETE FROM trustpilot_review_emails WHERE customer_id = dup_customer_id;
  DELETE FROM warranties_2000_audit_log WHERE customer_id = dup_customer_id;
  DELETE FROM structured_customer_notes WHERE customer_id = dup_customer_id;
  DELETE FROM deal_records WHERE customer_id = dup_customer_id;
  DELETE FROM posted_letters_log WHERE customer_id = dup_customer_id;
  DELETE FROM commission_claims WHERE customer_id = dup_customer_id;
  
  -- Delete policies
  DELETE FROM customer_policies WHERE customer_id = dup_customer_id;
  
  -- Delete the duplicate customer
  DELETE FROM customers WHERE id = dup_customer_id;
END $$;

-- Add partial unique index to prevent future duplicates
CREATE UNIQUE INDEX idx_unique_active_customer_email_reg 
ON public.customers (lower(email), upper(replace(registration_plate, ' ', '')))
WHERE (is_deleted IS NULL OR is_deleted = false) 
  AND status IN ('Active', 'Pending', 'active', 'pending');
