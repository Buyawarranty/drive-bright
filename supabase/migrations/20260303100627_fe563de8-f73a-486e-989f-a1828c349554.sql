
-- Clean up test debug leads
DELETE FROM sales_leads WHERE first_name = 'DEBUG_TEST';
DELETE FROM sales_leads WHERE email LIKE '%_test_%@test.com';
