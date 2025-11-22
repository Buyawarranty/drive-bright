-- Update the feedback email template with the new Trustpilot content
UPDATE email_templates 
SET 
  subject = 'Quick favour, {{customerFirstName}}? We''d love your feedback 🚗',
  content = jsonb_build_object(
    'greeting', 'Hi {{customerFirstName}},',
    'content', 'Thank you for choosing Buy A Warranty. We hope you''re enjoying your new warranty. We''d really appreciate it if you could take a moment to share your experience on Trustpilot.

https://uk.trustpilot.com/review/buyawarranty.co.uk

Your feedback helps us improve our service for everyone.

Many thanks,
Buy-A-Warranty Team'
  ),
  updated_at = now()
WHERE template_type = 'feedback';

-- Insert reminder template if it doesn't exist
INSERT INTO email_templates (
  template_type,
  name,
  subject,
  from_email,
  content,
  is_active,
  created_at,
  updated_at
)
SELECT 
  'feedback_reminder',
  'Trustpilot Review Reminder',
  'A quick reminder – your feedback matters!',
  'support@buyawarranty.co.uk',
  jsonb_build_object(
    'greeting', 'Hi {{customerFirstName}},',
    'content', 'Just a quick note to see if you''d be willing to leave us a review on Trustpilot. Your feedback is important and helps other customers make informed decisions.

https://uk.trustpilot.com/review/buyawarranty.co.uk

Thank you for your time and support.
Best wishes,

Buy-A-Warranty Team'
  ),
  true,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM email_templates WHERE template_type = 'feedback_reminder'
);