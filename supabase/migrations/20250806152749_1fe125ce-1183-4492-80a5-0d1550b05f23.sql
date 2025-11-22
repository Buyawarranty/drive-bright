-- Create feedback email template for Trustpilot reviews
INSERT INTO email_templates (
  name,
  subject,
  template_type,
  from_email,
  content,
  is_active
) VALUES (
  'Customer Feedback Request',
  'Quick favour, {{customerFirstName}}? We''d love your feedback 🚗',
  'feedback',
  'info@buyawarranty.co.uk',
  '{
    "greeting": "Hi {{customerFirstName}},",
    "content": "Hope you''re enjoying the peace of mind that comes with your car warranty!\n\nWe''d really appreciate a quick moment of your time to share your experience with us. Your feedback helps other car owners make confident decisions about protecting their vehicles.\n\n**Could you spare 2 minutes to leave us a review?**\n\nYour honest feedback means the world to us and helps us continue improving our service.\n\nThanks so much!\n\nThe buyawarranty.co.uk team\n\nP.S. If you have any questions about your warranty or need to make a claim, just reply to this email or call us on 0330 229 5040."
  }',
  true
);