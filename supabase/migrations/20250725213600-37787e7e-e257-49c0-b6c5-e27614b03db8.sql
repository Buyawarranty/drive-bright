-- Insert the 6 email templates for the warranty business

-- 1. Welcome Email (with Portal Sign-up)
INSERT INTO public.email_templates (
  name,
  subject,
  template_type,
  from_email,
  content,
  is_active
) VALUES (
  'Welcome Email - Portal Signup',
  'Welcome to Buyawarranty.co.uk – Let''s Get You Started',
  'welcome',
  'info@buyawarranty.co.uk',
  '{
    "greeting": "Hi {{customer_name}},",
    "content": "Welcome to Buyawarranty.co.uk – we''re delighted to have you on board! 🚗\n\nYou''re now part of a growing community of smart drivers who value peace of mind on the road. To get the most from your warranty, we recommend registering on your online portal, where you can:\n✅ View your policy documents\n✅ Track claims and updates\n✅ Renew or upgrade your warranty anytime\n\n👉 **[Click here to sign up now]({{portal_link}})** – it only takes a minute.\n\nIf you have any questions or need help getting started, just hit reply or call us on 0330 229 5040.\n\nHappy motoring,\nThe Customer Care Team\nBuyawarranty.co.uk"
  }',
  true
);

-- 2. Renewal Reminder (30 days before)
INSERT INTO public.email_templates (
  name,
  subject,
  template_type,
  from_email,
  content,
  is_active
) VALUES (
  'Renewal Reminder - 30 Days',
  'Your Warranty Ends Soon – Don''t Risk Driving Unprotected',
  'renewal_30',
  'info@buyawarranty.co.uk',
  '{
    "greeting": "Hi {{customer_name}},",
    "content": "Your vehicle warranty is due to expire on **{{expiry_date}}**, and we''d hate to see you unprotected. Avoid costly repair bills and keep that peace of mind going with a quick renewal.\n\nWe''ve made it simple:\n🔄 Renew online in under 60 seconds\n🔧 Enjoy continuous protection with no gaps\n💸 Keep your existing loyalty rate (if eligible)\n\n👉 **[Click here to renew now]({{renewal_link}})**\n\nIf you''d prefer to renew over the phone or discuss your options, give us a ring on 0330 229 5040.\n\nAll the best,\nSales & Customer Support Team\nBuyawarranty.co.uk\ninfo@buyawarranty.co.uk"
  }',
  true
);

-- 3. Renewal Reminder (7 days before)
INSERT INTO public.email_templates (
  name,
  subject,
  template_type,
  from_email,
  content,
  is_active
) VALUES (
  'Renewal Reminder - 7 Days',
  'Final Reminder: Your Warranty Expires in 7 Days',
  'renewal_7',
  'info@buyawarranty.co.uk',
  '{
    "greeting": "Hi {{customer_name}},",
    "content": "This is your final reminder that your vehicle warranty expires on **{{expiry_date}}** – that''s just 7 days away!\n\nDon''t leave yourself exposed to unexpected repair costs:\n🔄 Renew online in under 60 seconds\n🔧 Enjoy continuous protection with no gaps\n💸 Keep your existing loyalty rate (if eligible)\n\n👉 **[Click here to renew now]({{renewal_link}})**\n\nIf you''d prefer to renew over the phone or discuss your options, give us a ring on 0330 229 5040.\n\nAll the best,\nSales & Customer Support Team\nBuyawarranty.co.uk\ninfo@buyawarranty.co.uk"
  }',
  true
);

-- 4. Abandoned Cart Email (1 hour)
INSERT INTO public.email_templates (
  name,
  subject,
  template_type,
  from_email,
  content,
  is_active
) VALUES (
  'Abandoned Cart - 1 Hour',
  'Forgot Something? Your Warranty Quote is Waiting 🚗',
  'abandoned_cart_1h',
  'info@buyawarranty.co.uk',
  '{
    "greeting": "Hi {{customer_name}},",
    "content": "We noticed you started creating a warranty plan for your vehicle but didn''t quite finish. No worries – your quote is still saved and ready when you are.\n\nHere''s what you get with Buyawarranty.co.uk:\n✔️ Flexible, affordable cover\n✔️ Quick and easy claims process\n✔️ UK-based support team\n✔️ No nasty surprises – just great protection\n\n👉 **[Resume your quote now]({{quote_link}})** – it only takes a minute to complete!\n\nNeed help choosing the right plan? Just reply to this email or give us a ring on 0330 229 5040.\n\nKind regards,\nSales & Customer Support Team\nBuyawarranty.co.uk\ninfo@buyawarranty.co.uk"
  }',
  true
);

-- 5. Abandoned Cart Email (24 hours)
INSERT INTO public.email_templates (
  name,
  subject,
  template_type,
  from_email,
  content,
  is_active
) VALUES (
  'Abandoned Cart - 24 Hours',
  'Last Chance: Your Quote Expires Soon',
  'abandoned_cart_24h',
  'info@buyawarranty.co.uk',
  '{
    "greeting": "Hi {{customer_name}},",
    "content": "Your warranty quote is still waiting, but we can only hold your rate for a limited time.\n\nDon''t miss out on:\n✔️ Your personalized quote\n✔️ Flexible, affordable cover\n✔️ Quick and easy claims process\n✔️ UK-based support team\n\n👉 **[Complete your purchase now]({{quote_link}})** – we''ll hold your loyalty rate for just 24 more hours.\n\nNeed help choosing the right plan? Just reply to this email or give us a ring on 0330 229 5040.\n\nKind regards,\nSales & Customer Support Team\nBuyawarranty.co.uk\ninfo@buyawarranty.co.uk"
  }',
  true
);

-- 6. Expiry Follow-Up (2 days after)
INSERT INTO public.email_templates (
  name,
  subject,
  template_type,
  from_email,
  content,
  is_active
) VALUES (
  'Expiry Follow-Up - 2 Days',
  'Your Warranty Has Expired – Act Now to Regain Cover',
  'expired_2d',
  'info@buyawarranty.co.uk',
  '{
    "greeting": "Hi {{customer_name}},",
    "content": "Your vehicle warranty expired on **{{expiry_date}}**, which means you''re currently driving without protection against unexpected repair bills.\n\nWe''re here to help you get covered again – quickly and easily:\n🔧 No vehicle inspection needed (within grace period)\n💷 Protection from major repair costs\n📄 Hassle-free claims process\n\n👉 **[Reinstate your warranty now]({{reinstate_link}})**\n\nStill have questions? We''re here to help. Just reply to this email or call us on 0330 229 5040.\n\nDrive safe,\nSales & Customer Support Team\nBuyawarranty.co.uk\ninfo@buyawarranty.co.uk"
  }',
  true
);

-- 7. Expiry Follow-Up (7 days after)
INSERT INTO public.email_templates (
  name,
  subject,
  template_type,
  from_email,
  content,
  is_active
) VALUES (
  'Expiry Follow-Up - 7 Days',
  'Final Notice: Reinstate Your Warranty Before It''s Too Late',
  'expired_7d',
  'info@buyawarranty.co.uk',
  '{
    "greeting": "Hi {{customer_name}},",
    "content": "It''s been a week since your warranty expired on **{{expiry_date}}**. Every day without cover puts you at risk of costly repair bills.\n\nThis is your final opportunity to reinstate without inspection:\n🔧 Quick reinstatement process\n💷 Protection from major repair costs\n📄 Hassle-free claims process\n⏰ Grace period expires soon\n\n👉 **[Reinstate your warranty now]({{reinstate_link}})**\n\nDon''t wait – call us on 0330 229 5040 to discuss your options.\n\nDrive safe,\nSales & Customer Support Team\nBuyawarranty.co.uk\ninfo@buyawarranty.co.uk"
  }',
  true
);

-- 8. Sales Inquiry Reply Email
INSERT INTO public.email_templates (
  name,
  subject,
  template_type,
  from_email,
  content,
  is_active
) VALUES (
  'Sales Inquiry Reply',
  'Thanks for Your Interest – Let''s Find the Right Warranty for You',
  'sales_inquiry',
  'info@buyawarranty.co.uk',
  '{
    "greeting": "Hi {{customer_name}},",
    "content": "Thanks for reaching out to Buyawarranty.co.uk! We''d love to help you find the perfect protection for your vehicle.\n\nTo get started, please answer the following quick questions:\n1. Your vehicle registration\n2. Approximate mileage\n3. Preferred level of cover (Basic / Standard / Premium)\n\nAlternatively, you can get an instant quote right here:\n👉 **[Get a Quote]({{quote_link}})**\n\nFeel free to call us directly on 0330 229 5040 if you''d prefer to chat things through.\n\nSpeak soon,\nSales & Customer Support Team\nBuyawarranty.co.uk\ninfo@buyawarranty.co.uk"
  }',
  true
);

-- 9. Refer-a-Friend Campaign
INSERT INTO public.email_templates (
  name,
  subject,
  template_type,
  from_email,
  content,
  is_active
) VALUES (
  'Refer-a-Friend Campaign',
  'Share the Love – Get £20 for Every Friend You Refer 🚘',
  'referral',
  'info@buyawarranty.co.uk',
  '{
    "greeting": "Hi {{customer_name}},",
    "content": "Love your warranty? Your friends will too.\n\nRefer a friend to Buyawarranty.co.uk and you''ll both get **£20 off** when they buy a policy. It''s that easy.\n\nHere''s how it works:\n1. Share your unique link: {{referral_link}}\n2. Your friend gets £20 off their warranty\n3. You get a £20 amazon voucher 🎉\n\n👉 **[Start referring today]({{referral_link}})**\n\nThanks for spreading the word!\nMarketing Team\nBuyawarranty.co.uk\ninfo@buyawarranty.co.uk"
  }',
  true
);