-- Update abandoned cart email templates to trigger after 2 minutes for testing
UPDATE abandoned_cart_email_templates 
SET send_delay_minutes = 2 
WHERE trigger_type IN ('pricing_page_view', 'plan_selected');