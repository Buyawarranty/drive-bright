-- Insert 24h follow-up template
INSERT INTO public.abandoned_cart_email_templates (name, trigger_type, subject, html_content, text_content, send_delay_minutes, is_active)
VALUES 
(
  'Pricing Page - 24h Follow Up',
  'pricing_page_view_24h',
  'Still thinking it over? Here''s 10% off to help decide',
  '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f5f5f5"><div style="max-width:600px;margin:0 auto;background-color:#ffffff"><div style="background-color:#1a1a1a;padding:20px;text-align:center"><h1 style="color:#ffffff;margin:0;font-size:24px">Buy A Warranty</h1></div><div style="padding:30px"><p style="font-size:16px;color:#333;margin-bottom:15px">Hi {{firstName}},</p><p style="font-size:16px;color:#333;margin-bottom:15px"><strong>Re: Your {{vehicleMake}} {{vehicleModel}} warranty quote is saved – complete it in seconds</strong></p><p style="font-size:16px;color:#333;margin-bottom:15px">We understand warranties can feel complicated. But with Buy A Warranty, it''s simple:</p><div style="background-color:#f8f9fa;padding:20px;border-radius:8px;margin:20px 0"><p style="font-size:16px;color:#333;margin-bottom:10px"><strong>Why choose Car Warranty Prices | Affordable UK Vehicle Warranties</strong></p><ul style="list-style:none;padding:0;margin:15px 0"><li style="padding:8px 0;color:#333">✓ Flexible cover options</li><li style="padding:8px 0;color:#333">✓ UK-based support team</li><li style="padding:8px 0;color:#333">✓ Fast, easy claims</li><li style="padding:8px 0;color:#333">✓ Cancel within 14 days for a full refund</li><li style="padding:8px 0;color:#333">✓ Get covered in 60 seconds!</li></ul></div><div style="background-color:#fff3cd;border-left:4px solid #ffc107;padding:15px;margin:20px 0"><p style="font-size:16px;color:#333;margin:0"><strong>Use promo code SAVE10NOW to get 10% off your warranty quote.</strong><br>Just complete your purchase within the next 24 hours.</p></div><p style="font-size:18px;color:#1a1a1a;margin:20px 0;font-weight:bold;text-align:center">If It Breaks, We''ll Fix It!</p><div style="text-align:center;margin:30px 0"><a href="{{continueUrl}}" style="display:inline-block;background-color:#e63946;color:#ffffff;text-decoration:none;padding:15px 40px;border-radius:5px;font-size:18px;font-weight:bold">👉 Return to Your Cart</a></div><p style="font-size:16px;color:#333;margin-top:30px">Best regards,<br>The Buy A Warranty Team</p></div><div style="background-color:#1a1a1a;color:#ffffff;padding:20px;text-align:center"><p style="margin:5px 0;font-size:14px"><strong>Buy A Warranty | UK Vehicle Warranty &amp; Extended Cover</strong></p><p style="margin:5px 0;font-size:14px">📧 support@buyawarranty.co.uk</p><p style="margin:5px 0;font-size:14px">📞 0330 229 5040</p></div></div></body></html>',
  'Hi {{firstName}},

Re: Your {{vehicleMake}} {{vehicleModel}} warranty quote is saved – complete it in seconds

We understand warranties can feel complicated. But with Buy A Warranty, it''s simple:

Why choose Car Warranty Prices | Affordable UK Vehicle Warranties
✓ Flexible cover options
✓ UK-based support team
✓ Fast, easy claims
✓ Cancel within 14 days for a full refund
✓ Get covered in 60 seconds!

Use promo code SAVE10NOW to get 10% off your warranty quote.
Just complete your purchase within the next 24 hours.

If It Breaks, We''ll Fix It!

👉 Return to Your Cart: {{continueUrl}}

Best regards,
The Buy A Warranty Team
Buy A Warranty | UK Vehicle Warranty & Extended Cover
📧 support@buyawarranty.co.uk
📞 0330 229 5040',
  1440,
  true
);

-- Insert 72h final nudge template
INSERT INTO public.abandoned_cart_email_templates (name, trigger_type, subject, html_content, text_content, send_delay_minutes, is_active)
VALUES 
(
  'Pricing Page - 72h Final Nudge',
  'pricing_page_view_72h',
  'Last chance to secure your quote – 10% off ends soon',
  '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f5f5f5"><div style="max-width:600px;margin:0 auto;background-color:#ffffff"><div style="background-color:#1a1a1a;padding:20px;text-align:center"><h1 style="color:#ffffff;margin:0;font-size:24px">Buy A Warranty</h1></div><div style="padding:30px"><p style="font-size:16px;color:#333;margin-bottom:15px">Hi {{firstName}},</p><p style="font-size:16px;color:#333;margin-bottom:15px"><strong>Re: Protect Your Vehicle Registration: {{vehicleReg}}</strong></p><p style="font-size:16px;color:#333;margin-bottom:15px">Your warranty quote is about to expire.<br>Don''t miss out on affordable cover and peace of mind.</p><div style="background-color:#f8f9fa;padding:20px;border-radius:8px;margin:20px 0"><p style="font-size:16px;color:#333;margin-bottom:10px"><strong>Why choose Car Warranty Prices | Affordable UK Vehicle Warranties</strong></p><ul style="list-style:none;padding:0;margin:15px 0"><li style="padding:8px 0;color:#333">✓ Flexible cover options</li><li style="padding:8px 0;color:#333">✓ UK-based support team</li><li style="padding:8px 0;color:#333">✓ Fast, easy claims</li><li style="padding:8px 0;color:#333">✓ Cancel within 14 days for a full refund</li><li style="padding:8px 0;color:#333">✓ Get covered in 60 seconds!</li></ul></div><div style="background-color:#fff3cd;border-left:4px solid #ffc107;padding:15px;margin:20px 0"><p style="font-size:16px;color:#333;margin:0"><strong>Use promo code SAVE10NOW to get 10% off before it''s gone.</strong></p></div><p style="font-size:18px;color:#1a1a1a;margin:20px 0;font-weight:bold;text-align:center">Warranty that works when your car doesn''t!</p><div style="text-align:center;margin:30px 0"><a href="{{continueUrl}}" style="display:inline-block;background-color:#e63946;color:#ffffff;text-decoration:none;padding:15px 40px;border-radius:5px;font-size:18px;font-weight:bold">👉 Return to Your Cart</a></div><p style="font-size:16px;color:#333;margin-top:20px">Still have questions? Just reply to this email or get in touch.</p><p style="font-size:16px;color:#333;margin-top:30px">Best regards,<br>The Buy A Warranty Team</p></div><div style="background-color:#1a1a1a;color:#ffffff;padding:20px;text-align:center"><p style="margin:5px 0;font-size:14px"><strong>Buy A Warranty | UK Vehicle Warranty &amp; Extended Cover</strong></p><p style="margin:5px 0;font-size:14px">📧 support@buyawarranty.co.uk</p><p style="margin:5px 0;font-size:14px">📞 0330 229 5040</p></div></div></body></html>',
  'Hi {{firstName}},

Re: Protect Your Vehicle Registration: {{vehicleReg}}

Your warranty quote is about to expire.
Don''t miss out on affordable cover and peace of mind.

Why choose Car Warranty Prices | Affordable UK Vehicle Warranties
✓ Flexible cover options
✓ UK-based support team
✓ Fast, easy claims
✓ Cancel within 14 days for a full refund
✓ Get covered in 60 seconds!

Use promo code SAVE10NOW to get 10% off before it''s gone.

Warranty that works when your car doesn''t!

👉 Return to Your Cart: {{continueUrl}}

Still have questions? Just reply to this email or get in touch.

Best regards,
The Buy A Warranty Team
Buy A Warranty | UK Vehicle Warranty & Extended Cover
📧 support@buyawarranty.co.uk
📞 0330 229 5040',
  4320,
  true
);