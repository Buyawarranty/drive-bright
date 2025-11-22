-- Delete customer and all related data for prajwalchauhan26@gmail.com
DO $$
DECLARE
    customer_uuid UUID := 'd5d6ea4b-9f25-470c-be16-68dbf9a76417';
BEGIN
    -- Delete related records first (due to foreign key constraints)
    DELETE FROM customer_policies WHERE customer_id = customer_uuid OR email = 'prajwalchauhan26@gmail.com';
    DELETE FROM payments WHERE customer_id = customer_uuid;
    DELETE FROM admin_notes WHERE customer_id = customer_uuid;
    DELETE FROM email_logs WHERE customer_id = customer_uuid OR recipient_email = 'prajwalchauhan26@gmail.com';
    DELETE FROM welcome_emails WHERE email = 'prajwalchauhan26@gmail.com';
    DELETE FROM warranty_audit_log WHERE customer_id = customer_uuid;
    DELETE FROM discount_code_usage WHERE customer_email = 'prajwalchauhan26@gmail.com';
    DELETE FROM abandoned_carts WHERE email = 'prajwalchauhan26@gmail.com';
    DELETE FROM triggered_emails_log WHERE email = 'prajwalchauhan26@gmail.com';
    
    -- Finally delete the customer record
    DELETE FROM customers WHERE id = customer_uuid;
    
    RAISE NOTICE 'Successfully deleted customer prajwalchauhan26@gmail.com and all related data';
END $$;