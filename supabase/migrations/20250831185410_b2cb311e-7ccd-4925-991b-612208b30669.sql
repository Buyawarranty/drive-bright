-- Update customer policies to have the correct user_id for prajwalchauhan26@gmail.com
UPDATE customer_policies 
SET user_id = 'ff652f10-f975-4b5f-b6b1-11a6ae5d2ed9'
WHERE email = 'prajwalchauhan26@gmail.com';

-- Update email templates to use /customer-dashboard instead of /auth for login URLs
UPDATE email_templates 
SET content = jsonb_set(
  content, 
  '{html}', 
  to_jsonb(replace(content->>'html', '/auth', '/customer-dashboard'))
)
WHERE content->>'html' LIKE '%/auth%';

-- Also update any text content that might have /auth
UPDATE email_templates 
SET content = jsonb_set(
  content, 
  '{text}', 
  to_jsonb(replace(content->>'text', '/auth', '/customer-dashboard'))
)
WHERE content->>'text' LIKE '%/auth%';