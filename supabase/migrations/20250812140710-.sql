-- Create the missing "Policy Documents Email" template for send-policy-documents function
INSERT INTO email_templates (
  name,
  template_type,
  subject,
  from_email,
  content,
  is_active,
  created_at,
  updated_at
) VALUES (
  'Policy Documents Email',
  'policy_documents',
  'Your Warranty Documents - Policy {{policyNumber}}',
  'info@buyawarranty.co.uk',
  '{
    "greeting": "Hi {{customerName}},",
    "content": "Congratulations on your new warranty! Your policy documents are now ready for download.\n\n**Policy Details:**\n• Policy Number: {{policyNumber}}\n• Vehicle Registration: {{registrationPlate}}\n• Plan Type: {{planType}}\n• Policy Start Date: {{policyStartDate}}\n• Policy End Date: {{policyEndDate}}\n\n**Important Documents:**\nYour warranty policy and terms & conditions are attached to this email. Please keep these documents safe as you may need them when making a claim.\n\n**Customer Portal Access:**\nLog into your customer portal at: {{loginUrl}}\nEmail: {{loginEmail}}\nPassword: {{temporaryPassword}}\n\n**Need Help?**\nIf you have any questions about your warranty or need assistance, please contact our support team:\n📧 Email: info@buyawarranty.co.uk\n📞 Phone: +44 204 571 3400\n\nThank you for choosing Buy A Warranty!\n\nBest regards,\nThe Buy A Warranty Team"
  }',
  true,
  NOW(),
  NOW()
);