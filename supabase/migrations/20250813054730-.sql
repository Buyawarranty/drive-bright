-- Update the policy documents email template to fix dark mode visibility and show months instead of dates
UPDATE email_templates 
SET content = jsonb_set(
  content,
  '{content}',
  '"<div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; color: #333333;\">
  <div style=\"text-align: center; margin-bottom: 30px;\">
    <h1 style=\"color: #333333; margin-bottom: 10px;\">Hi {{customerName}},</h1>
    <h2 style=\"color: #28a745; margin-bottom: 20px;\">Congratulations — Your Buyawarranty.co.uk Protection is Now Active! 🎉</h2>
  </div>

  <div style=\"background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;\">
    <h3 style=\"color: #333333; margin-top: 0;\">📄 What''s included in your documents:</h3>
    <div style=\"margin: 15px 0;\">
      <p style=\"margin: 8px 0; color: #333333;\">✅ Full warranty terms and conditions</p>
      <p style=\"margin: 8px 0; color: #333333;\">✅ Claims process information</p>
      <p style=\"margin: 8px 0; color: #333333;\">✅ Coverage details and limitations</p>
      <p style=\"margin: 8px 0; color: #333333;\">✅ Contact information for claims</p>
    </div>
  </div>

  <div style=\"background-color: #2c3e50; color: #ffffff; padding: 20px; border-radius: 8px; margin: 20px 0;\">
    <h3 style=\"color: #ffffff; margin-top: 0; display: flex; align-items: center;\">
      📋 Your Policy Details:
    </h3>
    
    <div style=\"margin: 15px 0;\">
      <p style=\"margin: 12px 0; color: #ffffff; font-weight: bold;\">
        Vehicle Registration: 
        <span style=\"display: inline-block; background: linear-gradient(to bottom, #ffeb3b 0%, #ffeb3b 30%, #ffffff 30%, #ffffff 70%, #ffeb3b 70%, #ffeb3b 100%); color: #000000 !important; font-family: ''Charles Wright'', monospace; font-weight: bold; font-size: 18px; padding: 8px 12px; border: 2px solid #333333; border-radius: 4px; letter-spacing: 2px; text-align: center; min-width: 120px; margin-left: 8px;\">{{registrationPlate}}</span>
      </p>
      <p style=\"margin: 12px 0; color: #ffffff; font-weight: bold;\">Plan Type: <span style=\"color: #f39c12;\">{{planType}}</span></p>
      <p style=\"margin: 12px 0; color: #ffffff; font-weight: bold;\">Payment Method: <span style=\"color: #f39c12;\">{{paymentType}}</span></p>
      <p style=\"margin: 12px 0; color: #ffffff; font-weight: bold;\">Coverage Period: <span style=\"color: #f39c12;\">{{coveragePeriod}}</span></p>
    </div>
  </div>

  <div style=\"text-align: center; margin: 30px 0;\">
    <p style=\"color: #333333; font-size: 16px; margin-bottom: 20px;\">You''ve made a smart choice to safeguard your vehicle and avoid unexpected repair bills. With your new warranty in place, you can drive with complete peace of mind knowing you''re covered when it matters most.</p>
  </div>

  <div style=\"background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #28a745;\">
    <h3 style=\"color: #333333; margin-top: 0;\">📞 Need help?</h3>
    <p style=\"color: #333333; margin: 8px 0;\">If you have any questions about your coverage or need to make a claim, please contact us on:</p>
    <p style=\"color: #333333; margin: 8px 0; font-weight: bold;\">Customer care: <a href=\"tel:03302295040\" style=\"color: #28a745; text-decoration: none;\">0330 229 5040</a></p>
    <p style=\"color: #333333; margin: 8px 0; font-weight: bold;\">Claims line: <a href=\"tel:03302295045\" style=\"color: #28a745; text-decoration: none;\">0330 229 5045</a></p>
  </div>

  <div style=\"background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffc107;\">
    <p style=\"color: #856404; margin: 0; font-size: 14px;\">💡 <strong>Important:</strong> We recommend keeping these documents safe and accessible - that way you''ll have everything you need right at your fingertips if you ever need to make a claim.</p>
  </div>

  <div style=\"text-align: center; margin: 30px 0;\">
    <p style=\"color: #333333; font-size: 16px;\">Drive safe and enjoy the confidence your new warranty brings!</p>
    <p style=\"color: #666666; margin-top: 20px;\">Best regards,<br>The Customer Care Team<br><strong>Buyawarranty.co.uk</strong></p>
  </div>

  <div style=\"text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dddddd;\">
    <p style=\"color: #999999; font-size: 12px; margin: 0;\">This email was sent to {{loginEmail}}. If you have any questions, please don''t hesitate to contact us.</p>
  </div>
</div>"'::jsonb
),
subject = 'Congratulations — Your Buyawarranty.co.uk Protection is Now Active!',
updated_at = now()
WHERE template_type = 'policy_documents' AND is_active = true;