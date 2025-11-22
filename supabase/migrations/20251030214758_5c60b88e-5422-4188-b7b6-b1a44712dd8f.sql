-- Update abandoned cart email templates to use 2 minute delay for testing
UPDATE abandoned_cart_email_templates 
SET send_delay_minutes = 2 
WHERE send_delay_minutes > 2;