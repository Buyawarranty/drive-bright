-- Fix the Welcome Email portal signup link
UPDATE email_templates 
SET content = jsonb_set(
  content,
  '{content}',
  '"Welcome to Buyawarranty.co.uk – we''re delighted to have you on board! 🚗\n\nYou''re now part of a growing community of smart drivers who value peace of mind on the road. To get the most from your warranty, we recommend registering on your online portal, where you can:\n\n✅ View your policy documents\n✅ Track claims and updates\n✅ Renew or upgrade your warranty anytime\n\n👉 **[Click here to sign up now]({{portalLink}})** – it only takes a minute.\n\nIf you have any questions or need help getting started, just hit reply or call us on 0330 229 5040.\n\nHappy motoring,\nThe Customer Care Team\nBuyawarranty.co.uk"'
)
WHERE name = 'Welcome Email - Portal Signup';

-- Also ensure the portal link variable in the send-welcome-email function points to the auth page
-- This will be handled by updating the edge function to use the correct URL