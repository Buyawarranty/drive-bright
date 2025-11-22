-- Delete customer and all related data for prajwalchauhan26@gmail.com
DO $$
DECLARE
    customer_uuid UUID := 'd5d6ea4b-9f25-470c-be16-68dbf9a76417';
    policy_ids UUID[];
BEGIN
    -- First get all policy IDs for this customer
    SELECT ARRAY(SELECT id FROM customer_policies WHERE customer_id = customer_uuid OR email = 'prajwalchauhan26@gmail.com') INTO policy_ids;
    
    -- Delete warranty audit logs that reference these policies
    DELETE FROM warranty_audit_log WHERE policy_id = ANY(policy_ids) OR customer_id = customer_uuid;
    
    -- Delete other related records
    DELETE FROM customer_policies WHERE customer_id = customer_uuid OR email = 'prajwalchauhan26@gmail.com';
    DELETE FROM payments WHERE customer_id = customer_uuid;
    DELETE FROM admin_notes WHERE customer_id = customer_uuid;
    DELETE FROM email_logs WHERE customer_id = customer_uuid OR recipient_email = 'prajwalchauhan26@gmail.com';
    DELETE FROM welcome_emails WHERE email = 'prajwalchauhan26@gmail.com';
    DELETE FROM discount_code_usage WHERE customer_email = 'prajwalchauhan26@gmail.com';
    DELETE FROM abandoned_carts WHERE email = 'prajwalchauhan26@gmail.com';
    DELETE FROM triggered_emails_log WHERE email = 'prajwalchauhan26@gmail.com';
    
    -- Finally delete the customer record
    DELETE FROM customers WHERE id = customer_uuid;
    
    RAISE NOTICE 'Successfully deleted customer prajwalchauhan26@gmail.com and all related data';
END $$;