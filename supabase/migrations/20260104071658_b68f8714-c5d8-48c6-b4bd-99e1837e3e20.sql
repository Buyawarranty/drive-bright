-- Delete all related records for this customer email first
DELETE FROM warranty_audit_log WHERE customer_id IN (SELECT id FROM customers WHERE email = 'graphiqueartem@gmail.com');
DELETE FROM warranties_2000_audit_log WHERE customer_id IN (SELECT id FROM customers WHERE email = 'graphiqueartem@gmail.com');
DELETE FROM customer_notifications WHERE customer_id IN (SELECT id FROM customers WHERE email = 'graphiqueartem@gmail.com');
DELETE FROM admin_notes WHERE customer_id IN (SELECT id FROM customers WHERE email = 'graphiqueartem@gmail.com');
DELETE FROM customer_notes WHERE customer_id IN (SELECT id FROM customers WHERE email = 'graphiqueartem@gmail.com');
DELETE FROM structured_customer_notes WHERE customer_id IN (SELECT id FROM customers WHERE email = 'graphiqueartem@gmail.com');
DELETE FROM customer_tag_assignments WHERE customer_id IN (SELECT id FROM customers WHERE email = 'graphiqueartem@gmail.com');
DELETE FROM customer_policies WHERE customer_id IN (SELECT id FROM customers WHERE email = 'graphiqueartem@gmail.com');
DELETE FROM email_logs WHERE customer_id IN (SELECT id FROM customers WHERE email = 'graphiqueartem@gmail.com');
DELETE FROM payments WHERE customer_id IN (SELECT id FROM customers WHERE email = 'graphiqueartem@gmail.com');
DELETE FROM scheduled_emails WHERE customer_id IN (SELECT id FROM customers WHERE email = 'graphiqueartem@gmail.com');
DELETE FROM trustpilot_review_emails WHERE customer_id IN (SELECT id FROM customers WHERE email = 'graphiqueartem@gmail.com');
DELETE FROM mot_history WHERE customer_id IN (SELECT id FROM customers WHERE email = 'graphiqueartem@gmail.com');

-- Now delete the customer records
DELETE FROM customers WHERE email = 'graphiqueartem@gmail.com';

-- Delete admin user record
DELETE FROM admin_users WHERE email = 'graphiqueartem@gmail.com';