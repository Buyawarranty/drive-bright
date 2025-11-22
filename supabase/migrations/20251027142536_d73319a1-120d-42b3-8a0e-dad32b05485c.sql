-- Insert abandoned cart email template
INSERT INTO public.email_templates (name, subject, from_email, template_type, content, is_active) 
VALUES (
  'Abandoned Cart Follow-Up',
  'Your warranty quote is still here – don''t risk costly repairs',
  'support@buyawarranty.co.uk',
  'marketing',
  '{"html": "<h2>Hi {name}</h2><p>You left your warranty quote behind. It''s still in your cart, ready when you are. We''ve saved everything so you can jump back in anytime.</p><p><strong>Don''t risk costly repairs. Get covered today.</strong></p><h3>Why choose buyawarranty.co.uk</h3><ul><li>Flexible cover options</li><li>UK-based support team</li><li>Fast, easy claims</li><li>Cancel within 14 days for a full refund</li><li>Get covered in 60 seconds!</li></ul><p><strong>Warranty that works when your vehicle doesn''t!</strong></p><p>Tap below to get protected in 60 seconds.</p><p><a href=\"https://buyawarranty.co.uk\" style=\"background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;\">Protect your vehicle now 👉</a></p><p>Best regards,<br>The Buy A Warranty Team</p><hr><p style=\"font-size: 12px; color: #666;\">www.buyawarranty.co.uk<br>📧 support@buyawarranty.co.uk<br>📞 0330 229 5040</p>"}'::jsonb,
  true
)
ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  content = EXCLUDED.content,
  updated_at = now();