-- Update abandoned cart email templates to trigger after 30 minutes
UPDATE abandoned_cart_email_templates 
SET send_delay_minutes = 30 
WHERE trigger_type IN ('pricing_page_view', 'plan_selected');