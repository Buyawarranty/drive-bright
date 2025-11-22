-- Insert welcome email template
INSERT INTO email_templates (
  name,
  subject,
  template_type,
  from_email,
  content,
  is_active
) VALUES (
  'Welcome Email',
  'Welcome to Buy A Warranty - Your Policy Details {{policyNumber}}',
  'welcome',
  'info@buyawarranty.co.uk',
  '{
    "html": "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Welcome to Buy A Warranty</title></head><body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;\"><div style=\"background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;\"><h1 style=\"margin: 0; font-size: 28px;\">Welcome to Buy A Warranty!</h1><p style=\"margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;\">Your comprehensive vehicle protection is now active</p></div><div style=\"background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;\"><div style=\"background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;\"><h2 style=\"color: #2c3e50; margin: 0 0 15px 0; font-size: 20px;\">Policy Information</h2><table style=\"width: 100%; border-collapse: collapse;\"><tr><td style=\"padding: 8px 0; font-weight: bold; width: 40%;\">Policy Number:</td><td style=\"padding: 8px 0;\">{{policyNumber}}</td></tr><tr><td style=\"padding: 8px 0; font-weight: bold;\">Customer Name:</td><td style=\"padding: 8px 0;\">{{customerName}}</td></tr><tr><td style=\"padding: 8px 0; font-weight: bold;\">Registration Plate:</td><td style=\"padding: 8px 0; font-weight: bold; color: #667eea;\">{{registrationPlate}}</td></tr><tr><td style=\"padding: 8px 0; font-weight: bold;\">Plan Type:</td><td style=\"padding: 8px 0;\">{{planType}}</td></tr><tr><td style=\"padding: 8px 0; font-weight: bold;\">Coverage Period:</td><td style=\"padding: 8px 0;\">{{coveragePeriod}} months</td></tr><tr><td style=\"padding: 8px 0; font-weight: bold;\">Policy Start Date:</td><td style=\"padding: 8px 0;\">{{policyStartDate}}</td></tr><tr><td style=\"padding: 8px 0; font-weight: bold;\">Policy End Date:</td><td style=\"padding: 8px 0;\">{{policyEndDate}}</td></tr></table></div><div style=\"margin-bottom: 25px;\"><h3 style=\"color: #2c3e50; margin-bottom: 15px;\">What happens next?</h3><ul style=\"padding-left: 20px;\"><li style=\"margin-bottom: 10px;\">Your policy documents will be emailed to you shortly</li><li style=\"margin-bottom: 10px;\">Keep your policy number safe for future reference</li><li style=\"margin-bottom: 10px;\">Contact us anytime for support or claims</li></ul></div><div style=\"background: #e8f4f8; padding: 20px; border-radius: 8px; margin-bottom: 25px;\"><h3 style=\"color: #2c3e50; margin: 0 0 10px 0;\">Need Help?</h3><p style=\"margin: 0;\">Our support team is here to help you. Contact us at:</p><p style=\"margin: 10px 0 0 0;\"><strong>Email:</strong> info@buyawarranty.co.uk<br><strong>Phone:</strong> [Your phone number]</p></div><div style=\"text-align: center; margin-top: 30px;\"><p style=\"color: #666; font-size: 14px; margin: 0;\">Thank you for choosing Buy A Warranty</p><p style=\"color: #666; font-size: 12px; margin: 10px 0 0 0;\">This email was sent to {{email}}. If you have any questions, please contact our support team.</p></div></div></body></html>",
    "variables": [
      {
        "name": "policyNumber",
        "description": "The policy number assigned to the customer",
        "required": true
      },
      {
        "name": "customerName", 
        "description": "Full name of the customer",
        "required": true
      },
      {
        "name": "registrationPlate",
        "description": "Vehicle registration plate",
        "required": true
      },
      {
        "name": "planType",
        "description": "Type of warranty plan (Basic, Gold, Platinum, etc.)",
        "required": true
      },
      {
        "name": "coveragePeriod",
        "description": "Coverage period in months (12, 24, 36, etc.)",
        "required": true
      },
      {
        "name": "policyStartDate",
        "description": "Policy start date",
        "required": true
      },
      {
        "name": "policyEndDate", 
        "description": "Policy end date",
        "required": true
      },
      {
        "name": "email",
        "description": "Customer email address",
        "required": true
      }
    ]
  }',
  true
) ON CONFLICT (name) DO UPDATE SET
  subject = EXCLUDED.subject,
  content = EXCLUDED.content,
  updated_at = now();