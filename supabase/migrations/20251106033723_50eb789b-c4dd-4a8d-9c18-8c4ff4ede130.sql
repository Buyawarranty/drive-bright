-- Update plan_selected email to also send after 5 minutes
UPDATE abandoned_cart_email_templates 
SET send_delay_minutes = 5,
    updated_at = now()
WHERE trigger_type = 'plan_selected';