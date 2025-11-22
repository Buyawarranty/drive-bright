-- Update abandoned cart email template subject
UPDATE abandoned_cart_email_templates
SET subject = 'Secure your {{plan_name}} now - Your Warranty is ready and waiting 🚗',
    updated_at = now()
WHERE trigger_type = 'immediate';