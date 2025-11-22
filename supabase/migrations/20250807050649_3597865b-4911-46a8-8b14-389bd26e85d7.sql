-- Update Renewal Reminder - 7 Days email template
UPDATE email_templates 
SET content = '{
  "greeting": "Hi {{customer_name}},",
  "content": "This is your final reminder that your vehicle warranty expires on **{{expiry_date}}** – that\''s just 7 days away!\n\nDon\''t leave yourself exposed to unexpected repair costs:\n🔄 Renew online in under 60 seconds\n🔧 Enjoy continuous protection with no gaps\n💸 Keep your existing loyalty rate (if eligible)\n\n**🎉 SPECIAL OFFER: Save 10% on your renewal with discount code RENEWAL10** 🎉\n\n👉 **[Click here to renew now]({{renewal_link}})**\n\nSimply enter code **RENEWAL10** at checkout to claim your 10% discount!\n\nIf you\''d prefer to renew over the phone or discuss your options, give us a ring on 0330 229 5040 and mention your discount code.\n\nAll the best,\nSales & Customer Support Team\nBuyawarranty.co.uk\ninfo@buyawarranty.co.uk"
}'::jsonb
WHERE name = 'Renewal Reminder - 7 Days';

-- Update Expiry Follow-Up - 2 Days email template
UPDATE email_templates 
SET content = '{
  "greeting": "Hi {{customer_name}},",
  "content": "Your vehicle warranty expired on **{{expiry_date}}**, which means you\''re currently driving without protection against unexpected repair bills.\n\nWe\''re here to help you get covered again – quickly and easily:\n🔧 No vehicle inspection needed (within grace period)\n💷 Protection from major repair costs\n📄 Hassle-free claims process\n\n**🎉 SPECIAL OFFER: Save 10% on your new policy with discount code RENEWAL10** 🎉\n\n👉 **[Reinstate your warranty now]({{reinstate_link}})**\n\nSimply enter code **RENEWAL10** at checkout to claim your 10% discount!\n\nStill have questions? We\''re here to help. Just reply to this email or call us on 0330 229 5040 and mention your discount code.\n\nDrive safe,\nSales & Customer Support Team\nBuyawarranty.co.uk\ninfo@buyawarranty.co.uk"
}'::jsonb
WHERE name = 'Expiry Follow-Up - 2 Days';

-- Update Expiry Follow-Up - 7 Days email template
UPDATE email_templates 
SET content = '{
  "greeting": "Hi {{customer_name}},",
  "content": "It\''s been a week since your warranty expired on **{{expiry_date}}**. Every day without cover puts you at risk of costly repair bills.\n\nThis is your final opportunity to reinstate without inspection:\n🔧 Quick reinstatement process\n💷 Protection from major repair costs\n📄 Hassle-free claims process\n⏰ Grace period expires soon\n\n**🎉 LAST CHANCE: Save 10% on your new policy with discount code RENEWAL10** 🎉\n\n👉 **[Reinstate your warranty now]({{reinstate_link}})**\n\nSimply enter code **RENEWAL10** at checkout to claim your 10% discount!\n\nDon\''t wait – call us on 0330 229 5040 to discuss your options and mention your discount code.\n\nDrive safe,\nSales & Customer Support Team\nBuyawarranty.co.uk\ninfo@buyawarranty.co.uk"
}'::jsonb
WHERE name = 'Expiry Follow-Up - 7 Days';