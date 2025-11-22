-- Update Email 1 (5 mins) - Pricing Page View
UPDATE abandoned_cart_email_templates 
SET 
  subject = 'Your warranty quote is still here – don''t risk costly repairs',
  html_content = '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Your Warranty Quote is Waiting</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
        <h1 style="color: #1a365d; margin-bottom: 20px;">Your warranty quote is still here</h1>
        <p>Hi {{firstName}},</p>
        <p>You left your warranty quote behind for your <strong>{{vehicleMake}} {{vehicleModel}}</strong> (Registration: <strong>{{vehicleReg}}</strong>). It''s still in your cart, ready when you are.</p>
        <p>We''ve saved everything so you can jump back in anytime.</p>
        <p style="font-weight: bold; color: #d32f2f;">Don''t risk costly repairs. Get covered today.</p>
        
        <div style="background: white; padding: 25px; border-radius: 8px; margin: 25px 0; border: 2px solid #1a365d;">
            <h3 style="margin-top: 0; color: #1a365d;">Why choose Buy A Warranty?</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
                <li>✓ Flexible cover options</li>
                <li>✓ UK-based support team</li>
                <li>✓ Fast, easy claims</li>
                <li>✓ Cancel within 14 days for a full refund</li>
                <li>✓ Get covered in 60 seconds!</li>
            </ul>
            <p style="font-weight: bold; text-align: center; color: #1a365d; margin: 20px 0;">Warranty that works when your vehicle doesn''t!</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{checkoutUrl}}" style="background: #ffd700; color: #1a365d; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 18px;">👉 Return to Your Cart</a>
        </div>
        
        <p style="margin-top: 30px;">Best regards,<br>The Buy A Warranty Team</p>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">
            <strong>Buy A Warranty</strong> | UK Vehicle Warranty & Extended Cover<br>
            📧 support@buyawarranty.co.uk<br>
            📞 0330 229 5040
        </p>
    </div>
</body>
</html>',
  text_content = 'Hi {{firstName}},

You left your warranty quote behind for your {{vehicleMake}} {{vehicleModel}} (Registration: {{vehicleReg}}). It''s still in your cart, ready when you are.

We''ve saved everything so you can jump back in anytime.

Don''t risk costly repairs. Get covered today.

Why choose Buy A Warranty?
- Flexible cover options
- UK-based support team
- Fast, easy claims
- Cancel within 14 days for a full refund
- Get covered in 60 seconds!

Warranty that works when your vehicle doesn''t!

Return to your cart: {{checkoutUrl}}

Best regards,
The Buy A Warranty Team
Buy A Warranty | UK Vehicle Warranty & Extended Cover
📧 support@buyawarranty.co.uk
📞 0330 229 5040',
  updated_at = now()
WHERE trigger_type = 'pricing_page_view';

-- Update Email 1 (5 mins) - Plan Selected
UPDATE abandoned_cart_email_templates 
SET 
  subject = 'Your warranty quote is still here – don''t risk costly repairs',
  html_content = '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Your Warranty Quote is Waiting</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
        <h1 style="color: #1a365d; margin-bottom: 20px;">Your warranty quote is still here</h1>
        <p>Hi {{firstName}},</p>
        <p>You left your warranty quote behind for your <strong>{{vehicleMake}} {{vehicleModel}}</strong> (Registration: <strong>{{vehicleReg}}</strong>). It''s still in your cart, ready when you are.</p>
        <p>We''ve saved everything so you can jump back in anytime.</p>
        <p style="font-weight: bold; color: #d32f2f;">Don''t risk costly repairs. Get covered today.</p>
        
        <div style="background: white; padding: 25px; border-radius: 8px; margin: 25px 0; border: 2px solid #1a365d;">
            <h3 style="margin-top: 0; color: #1a365d;">Why choose Buy A Warranty?</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
                <li>✓ Flexible cover options</li>
                <li>✓ UK-based support team</li>
                <li>✓ Fast, easy claims</li>
                <li>✓ Cancel within 14 days for a full refund</li>
                <li>✓ Get covered in 60 seconds!</li>
            </ul>
            <p style="font-weight: bold; text-align: center; color: #1a365d; margin: 20px 0;">Warranty that works when your vehicle doesn''t!</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{checkoutUrl}}" style="background: #ffd700; color: #1a365d; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 18px;">👉 Return to Your Cart</a>
        </div>
        
        <p style="margin-top: 30px;">Best regards,<br>The Buy A Warranty Team</p>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">
            <strong>Buy A Warranty</strong> | UK Vehicle Warranty & Extended Cover<br>
            📧 support@buyawarranty.co.uk<br>
            📞 0330 229 5040
        </p>
    </div>
</body>
</html>',
  text_content = 'Hi {{firstName}},

You left your warranty quote behind for your {{vehicleMake}} {{vehicleModel}} (Registration: {{vehicleReg}}). It''s still in your cart, ready when you are.

We''ve saved everything so you can jump back in anytime.

Don''t risk costly repairs. Get covered today.

Why choose Buy A Warranty?
- Flexible cover options
- UK-based support team
- Fast, easy claims
- Cancel within 14 days for a full refund
- Get covered in 60 seconds!

Warranty that works when your vehicle doesn''t!

Return to your cart: {{checkoutUrl}}

Best regards,
The Buy A Warranty Team
Buy A Warranty | UK Vehicle Warranty & Extended Cover
📧 support@buyawarranty.co.uk
📞 0330 229 5040',
  updated_at = now()
WHERE trigger_type = 'plan_selected';

-- Update Email 2 (24 hours)
UPDATE abandoned_cart_email_templates 
SET 
  subject = 'Still thinking it over? Here''s 10% off to help decide',
  html_content = '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Get 10% Off Your Warranty</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
        <h1 style="color: #1a365d; margin-bottom: 20px;">Still thinking it over?</h1>
        <p>Hi {{firstName}},</p>
        <p><strong>Re: Your {{vehicleMake}} {{vehicleModel}} warranty quote is saved – complete it in seconds</strong></p>
        <p>We understand warranties can feel complicated. But with Buy A Warranty, it''s simple:</p>
        
        <div style="background: white; padding: 25px; border-radius: 8px; margin: 25px 0; border: 2px solid #1a365d;">
            <h3 style="margin-top: 0; color: #1a365d;">Why choose Buy A Warranty?</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
                <li>✓ Flexible cover options</li>
                <li>✓ UK-based support team</li>
                <li>✓ Fast, easy claims</li>
                <li>✓ Cancel within 14 days for a full refund</li>
                <li>✓ Get covered in 60 seconds!</li>
            </ul>
        </div>
        
        <div style="background: #ffd700; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
            <h3 style="margin-top: 0; color: #1a365d;">Special Offer: 10% OFF</h3>
            <p style="font-size: 18px; font-weight: bold; color: #1a365d; margin: 10px 0;">Use promo code: <span style="background: white; padding: 5px 15px; border-radius: 5px;">SAVE10NOW</span></p>
            <p style="margin: 10px 0; color: #1a365d;">Complete your purchase within the next 24 hours</p>
        </div>
        
        <p style="font-weight: bold; text-align: center; font-size: 18px; color: #d32f2f; margin: 20px 0;">If It Breaks, We''ll Fix It!</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{checkoutUrl}}" style="background: #ffd700; color: #1a365d; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 18px;">👉 Return to Your Cart</a>
        </div>
        
        <p style="margin-top: 30px;">Best regards,<br>The Buy A Warranty Team</p>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">
            <strong>Buy A Warranty</strong> | UK Vehicle Warranty & Extended Cover<br>
            📧 support@buyawarranty.co.uk<br>
            📞 0330 229 5040
        </p>
    </div>
</body>
</html>',
  text_content = 'Hi {{firstName}},

Re: Your {{vehicleMake}} {{vehicleModel}} warranty quote is saved – complete it in seconds

We understand warranties can feel complicated. But with Buy A Warranty, it''s simple:

Why choose Buy A Warranty?
- Flexible cover options
- UK-based support team
- Fast, easy claims
- Cancel within 14 days for a full refund
- Get covered in 60 seconds!

Special Offer: Use promo code SAVE10NOW to get 10% off your warranty quote.
Just complete your purchase within the next 24 hours.

If It Breaks, We''ll Fix It!

Return to your cart: {{checkoutUrl}}

Best regards,
The Buy A Warranty Team
Buy A Warranty | UK Vehicle Warranty & Extended Cover
📧 support@buyawarranty.co.uk
📞 0330 229 5040',
  updated_at = now()
WHERE trigger_type = 'pricing_page_view_24h';

-- Update Email 3 (72 hours)
UPDATE abandoned_cart_email_templates 
SET 
  subject = 'Last chance to secure your quote – 10% off ends soon',
  html_content = '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Last Chance - 10% Off Ends Soon</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
        <h1 style="color: #d32f2f; margin-bottom: 20px;">⚠️ Last chance to secure your quote</h1>
        <p>Hi {{firstName}},</p>
        <p><strong>Re: Protect Your Vehicle Registration: {{vehicleReg}}</strong></p>
        <p style="font-size: 16px;">Your warranty quote is about to expire.<br>Don''t miss out on affordable cover and peace of mind.</p>
        
        <div style="background: white; padding: 25px; border-radius: 8px; margin: 25px 0; border: 2px solid #1a365d;">
            <h3 style="margin-top: 0; color: #1a365d;">Why choose Buy A Warranty?</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
                <li>✓ Flexible cover options</li>
                <li>✓ UK-based support team</li>
                <li>✓ Fast, easy claims</li>
                <li>✓ Cancel within 14 days for a full refund</li>
                <li>✓ Get covered in 60 seconds!</li>
            </ul>
        </div>
        
        <div style="background: #d32f2f; color: white; padding: 20px; border-radius: 8px; margin: 25px 0; text-align: center;">
            <h3 style="margin-top: 0; color: white;">⏰ Final Offer: 10% OFF</h3>
            <p style="font-size: 18px; font-weight: bold; margin: 10px 0;">Use promo code: <span style="background: white; color: #d32f2f; padding: 5px 15px; border-radius: 5px;">SAVE10NOW</span></p>
            <p style="margin: 10px 0;">Before it''s gone!</p>
        </div>
        
        <p style="font-weight: bold; text-align: center; font-size: 18px; color: #1a365d; margin: 20px 0;">Warranty that works when your car doesn''t!</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{checkoutUrl}}" style="background: #ffd700; color: #1a365d; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 18px;">👉 Return to Your Cart</a>
        </div>
        
        <p style="text-align: center; color: #666;">Still have questions? Just reply to this email or get in touch.</p>
        
        <p style="margin-top: 30px;">Best regards,<br>The Buy A Warranty Team</p>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">
            <strong>Buy A Warranty</strong> | UK Vehicle Warranty & Extended Cover<br>
            📧 support@buyawarranty.co.uk<br>
            📞 0330 229 5040
        </p>
    </div>
</body>
</html>',
  text_content = 'Hi {{firstName}},

⚠️ Last chance to secure your quote

Re: Protect Your Vehicle Registration: {{vehicleReg}}

Your warranty quote is about to expire.
Don''t miss out on affordable cover and peace of mind.

Why choose Buy A Warranty?
- Flexible cover options
- UK-based support team
- Fast, easy claims
- Cancel within 14 days for a full refund
- Get covered in 60 seconds!

⏰ Final Offer: Use promo code SAVE10NOW to get 10% off before it''s gone.

Warranty that works when your car doesn''t!

Return to your cart: {{checkoutUrl}}

Still have questions? Just reply to this email or get in touch.

Best regards,
The Buy A Warranty Team
Buy A Warranty | UK Vehicle Warranty & Extended Cover
📧 support@buyawarranty.co.uk
📞 0330 229 5040',
  updated_at = now()
WHERE trigger_type = 'pricing_page_view_72h';