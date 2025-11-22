-- Update the first abandoned cart email to send after 5 minutes
UPDATE abandoned_cart_email_templates 
SET send_delay_minutes = 5,
    updated_at = now()
WHERE trigger_type = 'pricing_page_view';