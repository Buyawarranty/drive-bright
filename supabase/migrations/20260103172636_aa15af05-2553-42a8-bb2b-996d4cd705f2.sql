-- Delete all related records first, then the customer
DELETE FROM warranty_audit_log WHERE customer_id IN (SELECT id FROM customers WHERE email = 'prajwalchauhan26@gmail.com');
DELETE FROM trustpilot_review_emails WHERE policy_id IN (SELECT id FROM customer_policies WHERE customer_id IN (SELECT id FROM customers WHERE email = 'prajwalchauhan26@gmail.com'));
DELETE FROM customer_policies WHERE customer_id IN (SELECT id FROM customers WHERE email = 'prajwalchauhan26@gmail.com');
DELETE FROM admin_notes WHERE customer_id IN (SELECT id FROM customers WHERE email = 'prajwalchauhan26@gmail.com');
DELETE FROM email_logs WHERE customer_id IN (SELECT id FROM customers WHERE email = 'prajwalchauhan26@gmail.com');
DELETE FROM customer_notifications WHERE customer_id IN (SELECT id FROM customers WHERE email = 'prajwalchauhan26@gmail.com');
DELETE FROM customer_tag_assignments WHERE customer_id IN (SELECT id FROM customers WHERE email = 'prajwalchauhan26@gmail.com');
DELETE FROM customers WHERE email = 'prajwalchauhan26@gmail.com';