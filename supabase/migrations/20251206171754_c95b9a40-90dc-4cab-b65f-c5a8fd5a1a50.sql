-- Insert abandoned cart email template for checkout_abandoned trigger
INSERT INTO abandoned_cart_email_templates (
  name,
  trigger_type,
  subject,
  html_content,
  text_content,
  send_delay_minutes,
  is_active
) VALUES (
  'Checkout Abandoned - Complete Purchase Reminder',
  'checkout_abandoned',
  'Complete your warranty purchase',
  '<p>You were almost there! Complete your warranty purchase now.</p>',
  'You were almost there! Complete your warranty purchase now.',
  30,
  true
);