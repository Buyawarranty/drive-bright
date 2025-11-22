-- Update the Policy Documents Email template to include period in months, start date, and expiry date
UPDATE email_templates 
SET content = jsonb_set(
  jsonb_set(
    content,
    '{content}',
    '"Congratulations on your new warranty! 🎉 We''re excited to have you covered and ready to enjoy peace of mind.

**Your policy documents are attached to this email for your records. Your policy number is: {{policyNumber}}**

📄 **What''s included in your documents:**

✅ Full warranty terms and conditions
✅ Claims process information  
✅ Coverage details and limitations
✅ Contact information for claims

📋 **Your Policy Details:**

**Vehicle Registration:** {{registrationPlate}}
**Plan Type:** {{planType}}
**Payment Method:** {{paymentType}}
**Coverage Period:** {{coveragePeriod}}
**Policy Start Date:** {{policyStartDate}}
**Policy Expiry Date:** {{policyExpiryDate}}

You''ve made a smart choice to safeguard your vehicle and avoid unexpected repair bills. With your new warranty in place, you can drive with complete peace of mind knowing you''re covered when it matters most.

**Need help?**
If you have any questions about your coverage or need to make a claim, please contact us on:
Customer care: 0330 229 5040
Claims line: 0330 229 5045

We recommend keeping these documents safe and accessible - that way you''ll have everything you need right at your fingertips if you ever need to make a claim.

Drive safe and enjoy the confidence your new warranty brings!

Best regards,
The Customer Care Team
Buyawarranty.co.uk"'
  ),
  '{greeting}',
  '"Hi {{customerName}},"'
)
WHERE name = 'Policy Documents Email' OR name = '1st Email - Policy Documents Email as soon as purchase made';