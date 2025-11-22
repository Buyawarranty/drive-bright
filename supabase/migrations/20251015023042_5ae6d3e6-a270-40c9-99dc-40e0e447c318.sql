-- Insert the new Welcome Email v2.4 template
INSERT INTO public.email_templates (
  name,
  subject,
  from_email,
  template_type,
  content,
  is_active,
  created_at,
  updated_at
) VALUES (
  'Welcome Email v2.4 - October 2025',
  'Your Buy A Warranty Policy Is Now Active 🚗',
  'Buy A Warranty <info@buyawarranty.co.uk>',
  'welcome',
  jsonb_build_object(
    'html', '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; line-height: 1.6;">
          
          <!-- Logo -->
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://buyawarranty.co.uk/images/buyawarranty-logo.png" alt="Buy A Warranty" style="max-width: 300px; height: auto;" />
          </div>

          <div style="margin-bottom: 30px;">
            <h1 style="color: #333; font-size: 24px; margin-bottom: 20px;">Hi {{first_name}},</h1>
            
            <p style="color: #333; font-size: 16px; margin-bottom: 15px;">
              Thanks for choosing Buy A Warranty to protect your vehicle — we''re pleased to let you know that your warranty is now active!
            </p>
            
            <p style="color: #333; font-size: 16px; margin-bottom: 15px;">
              Here are your policy details:
            </p>
          </div>

          <div style="margin-bottom: 25px;">
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="margin-bottom: 8px; color: #333;">
                <strong>Policy Number:</strong> {{policy_number}}
              </li>
              <li style="margin-bottom: 8px; color: #333;">
                <strong>Plan Type:</strong> {{plan_type}}
              </li>
              <li style="margin-bottom: 8px; color: #333;">
                <strong>Registration Plate:</strong> {{registration}}
              </li>
              <li style="margin-bottom: 8px; color: #333;">
                <strong>Coverage Period:</strong> {{coverage_period}}
              </li>
              <li style="margin-bottom: 8px; color: #333;">
                <strong>Start Date:</strong> {{start_date}}
              </li>
              <li style="margin-bottom: 8px; color: #333;">
                <strong>End Date:</strong> {{end_date}}
              </li>
              <li style="margin-bottom: 8px; color: #333;">
                <strong>Payment Method:</strong> {{payment_method}}
              </li>
            </ul>
          </div>

          <div style="margin-bottom: 25px;">
            <h2 style="color: #333; font-size: 20px; margin-bottom: 15px;">🔐 Your Portal Login Details!</h2>
            
            <p style="color: #333; margin-bottom: 15px;">
              You can view your updated policy anytime via your customer portal:
            </p>
            
            <p style="margin-bottom: 15px;">
              <strong>Login:</strong> <a href="https://buyawarranty.co.uk/customer-dashboard" style="color: #ff6b35; text-decoration: none;">Customer Dashboard</a>
            </p>
            
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="margin-bottom: 8px; color: #333;">
                <strong>Email:</strong> {{customer_email}}
              </li>
              <li style="margin-bottom: 8px; color: #333;">
                <strong>Password:</strong> <code style="background-color: #f1f1f1; padding: 4px 8px; border-radius: 4px; font-weight: bold;">{{password}}</code>
              </li>
            </ul>
          </div>

          <div style="margin-bottom: 25px;">
            <h2 style="color: #333; font-size: 20px; margin-bottom: 15px;">📎 Your Documents</h2>
            
            <p style="color: #333; margin-bottom: 15px;">
              Attached to this email, you''ll find:
            </p>
            
            <ul style="color: #333; padding-left: 20px;">
              <li style="margin-bottom: 5px;">Warranty Policy Certificate</li>
              <li style="margin-bottom: 5px;">Terms & Conditions</li>
            </ul>
            
            <p style="color: #333; margin-top: 15px;">
              Please keep these safe — you''ll need them if you ever need to make a claim.
            </p>
          </div>

          <div style="margin-bottom: 25px;">
            <h2 style="color: #333; font-size: 20px; margin-bottom: 15px;">📞 Need a hand?</h2>
            
            <p style="color: #333; margin-bottom: 10px;">
              If you''ve got any questions or need help, feel free to reach out:
            </p>
            
            <div style="margin-bottom: 15px;">
              <p style="color: #333; margin-bottom: 5px;"><strong>Customer Sales and Support</strong></p>
              <p style="color: #333; margin-bottom: 3px;">
                Email: <a href="mailto:support@buyawarranty.co.uk" style="color: #ff6b35; text-decoration: none;">support@buyawarranty.co.uk</a>
              </p>
              <p style="color: #333; margin-bottom: 0;">
                Phone: <a href="tel:03302295040" style="color: #ff6b35; text-decoration: none;">0330 229 5040</a>
              </p>
            </div>
            
            <div style="margin-bottom: 15px;">
              <p style="color: #333; margin-bottom: 5px;"><strong>Claims and Repairs</strong></p>
              <p style="color: #333; margin-bottom: 3px;">
                Email: <a href="mailto:claims@buyawarranty.co.uk" style="color: #ff6b35; text-decoration: none;">claims@buyawarranty.co.uk</a>
              </p>
              <p style="color: #333; margin-bottom: 0;">
                Phone: <a href="tel:03302295045" style="color: #ff6b35; text-decoration: none;">0330 229 5045</a>
              </p>
            </div>
            
            <p style="color: #333; margin-bottom: 0;">
              <strong>Hours:</strong> Monday to Friday, 9am – 5:30pm
            </p>
          </div>

          <div style="margin-bottom: 25px; padding: 20px; background-color: #f8f9fa; border-radius: 5px;">
            <p style="color: #333; margin: 0; font-size: 16px;">
              Thanks again for choosing Buy A Warranty — we''re here to keep you covered and give you peace of mind on the road.
            </p>
          </div>

          <div style="text-align: left; margin-bottom: 25px;">
            <p style="color: #333; margin: 0; font-size: 16px;">
              Best regards,<br>
              <strong>The Buy A Warranty Team</strong>
            </p>
          </div>

          <div style="text-align: center; border-top: 1px solid #dee2e6; padding-top: 20px;">
            <p style="color: #333; margin-bottom: 10px; font-weight: bold;">buyawarranty.co.uk</p>
            <p style="color: #666; margin-bottom: 15px; font-style: italic;">Your trusted warranty partner</p>
            
            <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
            
            <p style="color: #666; font-size: 12px; line-height: 1.4; margin: 0;">
              Buyawarranty.co.uk is a trading name of One Warranty Limited. Registered in the UK under Company number: 10314863 since 2016.<br>
              Registered address: Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT, England.
            </p>
          </div>

        </div>',
    'version', '2.4',
    'description', 'Welcome email template with logo, updated content, and customer portal details - October 2025 version'
  ),
  true,
  now(),
  now()
)
ON CONFLICT DO NOTHING;