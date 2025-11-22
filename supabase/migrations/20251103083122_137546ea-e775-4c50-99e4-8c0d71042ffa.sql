-- Update abandoned cart email template with corrected content
UPDATE abandoned_cart_email_templates
SET 
  subject = 'Complete your warranty purchase - {{plan_name}} waiting for you',
  html_content = '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Complete Your Warranty Purchase</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Your {{plan_name}} warranty is waiting for you!</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">Hi {{customer_name}},</p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                You''re just one step away from securing comprehensive warranty coverage for your <strong>{{vehicle_make}} {{vehicle_model}} ({{vehicle_reg}})</strong>.
              </p>
              
              <!-- Plan Details Box -->
              <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; margin: 0 0 30px 0;">
                <h2 style="color: #1e40af; font-size: 18px; margin: 0 0 10px 0;">Your Selected Plan:</h2>
                <p style="color: #333333; font-size: 16px; margin: 0; font-weight: bold;">{{plan_name}} Warranty - {{payment_type}}</p>
                <p style="color: #059669; font-size: 14px; margin: 10px 0 0 0; font-weight: bold;">Save a further 10% when you pay the full amount upfront!</p>
              </div>
              
              <!-- Benefits -->
              <h3 style="color: #1e40af; font-size: 20px; margin: 0 0 20px 0;">Why choose us?</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 30px 0;">
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="color: #059669; font-size: 18px; margin-right: 10px;">✓</span>
                    <span style="color: #333333; font-size: 15px;">Comprehensive cover</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="color: #059669; font-size: 18px; margin-right: 10px;">✓</span>
                    <span style="color: #333333; font-size: 15px;">Easy Claims, Fast Payouts</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="color: #059669; font-size: 18px; margin-right: 10px;">✓</span>
                    <span style="color: #333333; font-size: 15px;">Mechanical, Electrical and Labour cover</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="color: #059669; font-size: 18px; margin-right: 10px;">✓</span>
                    <span style="color: #333333; font-size: 15px;">No Hidden Fees</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="color: #059669; font-size: 18px; margin-right: 10px;">✓</span>
                    <span style="color: #333333; font-size: 15px;">12 Easy Interest-Free Payments</span>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 30px 0;">
                <tr>
                  <td align="center">
                    <a href="{{continue_url}}" style="display: inline-block; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">Complete Your Purchase</a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #666666; font-size: 14px; text-align: center; margin: 0;">
                Secure payment • Free to cancel within 14 days
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;">Questions? Reply to this email or call us at <strong>0330 229 5040</strong></p>
              <p style="color: #999999; font-size: 12px; margin: 0;">
                © 2024 Buy A Warranty. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>',
  text_content = 'Your {{plan_name}} warranty is waiting for you!

Hi {{customer_name}},

You''re just one step away from securing comprehensive warranty coverage for your {{vehicle_make}} {{vehicle_model}} ({{vehicle_reg}}).

Your Selected Plan:
{{plan_name}} Warranty - {{payment_type}}
Save a further 10% when you pay the full amount upfront!

Why choose us?
✓ Comprehensive cover
✓ Easy Claims, Fast Payouts
✓ Mechanical, Electrical and Labour cover
✓ No Hidden Fees
✓ 12 Easy Interest-Free Payments

Complete Your Purchase: {{continue_url}}

Secure payment • Free to cancel within 14 days

Questions? Reply to this email or call us at 0330 229 5040

© 2024 Buy A Warranty. All rights reserved.'
WHERE trigger_type = 'immediate';