UPDATE email_templates 
SET 
  subject = '🎉 Congratulations — Your Buyawarranty.co.uk Protection is Now Registered! ✅',
  content = jsonb_build_object(
    'html', '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Your Buyawarranty.co.uk Protection is Now Registered!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 28px;">🎉 Congratulations — Your Buyawarranty.co.uk Protection is Now Registered! ✅</h1>
    </div>
    
    <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Hi {{customerName}},</p>
        
        <p style="font-size: 16px; margin-bottom: 20px;">Congratulations on your new warranty! We''re excited to have you covered and ready to enjoy peace of mind.</p>
        
        <p style="font-size: 16px; margin-bottom: 20px;">Your policy documents are attached to this email for your records. Your policy number is: <strong>{{policyNumber}}</strong></p>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #2c3e50; margin: 0 0 15px 0;">What''s included in your documents:</h3>
            <ul style="padding-left: 20px; margin: 0;">
                <li style="margin-bottom: 8px;">Full warranty terms and conditions</li>
                <li style="margin-bottom: 8px;">Claims process information</li>
                <li style="margin-bottom: 8px;">Coverage details and limitations</li>
                <li style="margin-bottom: 8px;">Contact information for claims</li>
            </ul>
        </div>
        
        <div style="text-align: center; margin: 25px 0;">
            <p style="font-size: 18px; margin-bottom: 15px;">🛡️ You''ve made a smart choice to safeguard your vehicle and avoid unexpected repair bills.</p>
            <p style="font-size: 18px; margin-bottom: 15px;">🚗 With your new warranty in place, you can drive with complete peace of mind knowing you''re covered when it matters most. ✅</p>
        </div>
        
        <div style="background: #e8f4f8; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #2c3e50; margin: 0 0 15px 0;">Your Policy Details:</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; width: 40%;">Vehicle Registration:</td>
                    <td style="padding: 8px 0; color: #667eea; font-weight: bold;">{{registrationPlate}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Plan Type:</td>
                    <td style="padding: 8px 0;">{{planType}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Payment Method:</td>
                    <td style="padding: 8px 0;">{{paymentMethod}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Coverage Period:</td>
                    <td style="padding: 8px 0;">{{coveragePeriod}}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Policy End Date:</td>
                    <td style="padding: 8px 0;">{{policyEndDate}}</td>
                </tr>
            </table>
        </div>
        
        <div style="text-align: center; margin: 25px 0;">
            <a href="{{policyDocumentUrl}}" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 0 10px 10px 0;">View Your Policy</a>
            <a href="https://buyawarranty.co.uk/terms" style="display: inline-block; background: #764ba2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">Terms & Conditions</a>
        </div>
        
        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #ffc107;">
            <h3 style="color: #856404; margin: 0 0 10px 0;">Need help?</h3>
            <p style="margin: 0 0 10px 0; color: #856404;">If you have any questions about your coverage or need to make a claim, please contact us on:</p>
            <p style="margin: 0; color: #856404;">
                <strong>Customer care:</strong> 0330 229 5040<br>
                <strong>Claims line:</strong> 0330 229 5045
            </p>
        </div>
        
        <div style="background: #d1ecf1; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
            <p style="margin: 0; font-style: italic; color: #0c5460;"><strong>Tip:</strong> We recommend keeping these documents safe and accessible - that way you''ll have everything you need right at your fingertips if you ever need to make a claim.</p>
        </div>
        
        <p style="font-size: 16px; text-align: center; margin-bottom: 20px;">Drive safe and enjoy the confidence your new warranty brings!</p>
        
        <div style="text-align: center; margin-top: 30px;">
            <p style="color: #666; font-size: 14px; margin: 0;">Best regards,<br>The Customer Care Team<br>Buyawarranty.co.uk</p>
            <p style="color: #666; font-size: 12px; margin: 10px 0 0 0;">If you have any questions, please contact us at info@buyawarranty.co.uk</p>
        </div>
    </div>
</body>
</html>',
    'variables', '[
      {"name": "customerName", "description": "Full name of the customer", "required": true},
      {"name": "policyNumber", "description": "The policy number assigned to the customer", "required": true},
      {"name": "registrationPlate", "description": "Vehicle registration plate", "required": true},
      {"name": "planType", "description": "Type of warranty plan (Basic, Gold, Platinum, etc.)", "required": true},
      {"name": "paymentMethod", "description": "Payment method used (Stripe, Bumper, etc.)", "required": true},
      {"name": "coveragePeriod", "description": "Coverage period (12 months, 24 months, etc.)", "required": true},
      {"name": "policyEndDate", "description": "Policy end date", "required": true},
      {"name": "policyDocumentUrl", "description": "URL to the policy document", "required": true}
    ]'::jsonb
  ),
  updated_at = now()
WHERE template_type = 'welcome';