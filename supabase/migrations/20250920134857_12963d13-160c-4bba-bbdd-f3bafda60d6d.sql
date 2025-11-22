-- Update the policy documents email template to be more professional and consistent
UPDATE email_templates 
SET content = jsonb_build_object(
    'content', '<div style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #ffffff; color: #1f2937;">

<!-- Header Section -->
<div style="text-align: center; padding: 40px 40px 30px 40px; background-color: #f8fafc; border-bottom: 1px solid #e5e7eb;">
    <h1 style="color: #1f2937; margin: 0 0 15px 0; font-size: 28px; font-weight: 600;">Congratulations {{customerName}}!</h1>
    <h2 style="color: #ea580c; margin: 0; font-size: 20px; font-weight: 500;">Your BuyAWarranty Protection is Now Active</h2>
</div>

<!-- Policy Details Section -->
<div style="padding: 30px 40px;">
    <div style="background-color: #f8fafc; padding: 25px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 30px;">
        <h3 style="color: #1f2937; margin: 0 0 20px 0; font-size: 18px; font-weight: 600; padding-bottom: 10px; border-bottom: 2px solid #ea580c;">Your Policy Details</h3>
        
        <div style="margin: 15px 0;">
            <p style="margin: 12px 0; color: #1f2937; font-size: 16px;"><strong>Vehicle Registration:</strong></p>
            <div style="display: inline-block; background-color: #ffffff; color: #000000; font-family: monospace; font-weight: bold; font-size: 18px; padding: 8px 16px; border: 2px solid #000000; border-radius: 4px; letter-spacing: 1px; margin: 5px 0;">{{registrationPlate}}</div>
        </div>
        
        <p style="margin: 12px 0; color: #1f2937; font-size: 16px;"><strong>Plan Type:</strong> <span style="color: #ea580c; font-weight: 600;">{{planType}}</span></p>
        <p style="margin: 12px 0; color: #1f2937; font-size: 16px;"><strong>Payment Method:</strong> <span style="color: #ea580c; font-weight: 600;">{{paymentMethod}}</span></p>
        <p style="margin: 12px 0; color: #1f2937; font-size: 16px;"><strong>Coverage Period:</strong> <span style="color: #ea580c; font-weight: 600;">{{coveragePeriod}}</span></p>
        <p style="margin: 12px 0; color: #1f2937; font-size: 16px;"><strong>Policy Number:</strong> <span style="color: #ea580c; font-weight: 600;">{{policyNumber}}</span></p>
    </div>

    <!-- Customer Portal Access -->
    <div style="background-color: #eff6ff; padding: 25px; border-radius: 8px; border: 1px solid #dbeafe; margin-bottom: 30px;">
        <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">🔐 Access Your Customer Portal</h3>
        <p style="color: #1f2937; margin: 10px 0; font-size: 16px;">Manage your warranty, view policy details, and submit claims online:</p>
        <p style="margin: 8px 0; color: #1f2937; font-size: 16px;"><strong>Portal URL:</strong> <a href="{{loginUrl}}" style="color: #ea580c; text-decoration: none; font-weight: 600;">{{loginUrl}}</a></p>
        <p style="margin: 8px 0; color: #1f2937; font-size: 16px;"><strong>Login Email:</strong> {{loginEmail}}</p>
        <p style="margin: 8px 0; color: #1f2937; font-size: 16px;"><strong>Access:</strong> {{temporaryPassword}}</p>
    </div>

    <!-- Documents Section -->  
    <div style="background-color: #f0fdf4; padding: 25px; border-radius: 8px; border: 1px solid #dcfce7; margin-bottom: 30px;">
        <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">📋 Your Policy Documents</h3>
        <p style="color: #1f2937; margin: 10px 0; font-size: 16px;">We''ve attached your complete policy documentation:</p>
        <div style="margin: 15px 0;">
            <p style="margin: 8px 0; color: #1f2937; font-size: 15px;">✓ Complete warranty terms and conditions</p>
            <p style="margin: 8px 0; color: #1f2937; font-size: 15px;">✓ Coverage details and limitations</p>
            <p style="margin: 8px 0; color: #1f2937; font-size: 15px;">✓ Claims process information</p>
            <p style="margin: 8px 0; color: #1f2937; font-size: 15px;">✓ Contact information for support</p>
        </div>
    </div>

    <!-- Support Section -->
    <div style="background-color: #fef3c7; padding: 25px; border-radius: 8px; border: 1px solid #fde68a;">
        <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">📞 Need Support?</h3>
        <p style="color: #1f2937; margin: 10px 0; font-size: 16px;">Our customer care team is here to help:</p>
        <p style="margin: 8px 0; color: #1f2937; font-size: 16px;"><strong>Customer Care:</strong> <a href="tel:03302295040" style="color: #ea580c; text-decoration: none; font-weight: 600;">0330 229 5040</a></p>
        <p style="margin: 8px 0; color: #1f2937; font-size: 16px;"><strong>Claims Line:</strong> <a href="tel:03302295045" style="color: #ea580c; text-decoration: none; font-weight: 600;">0330 229 5045</a></p>
        <p style="margin: 8px 0; color: #1f2937; font-size: 16px;"><strong>Email:</strong> <a href="mailto:info@buyawarranty.co.uk" style="color: #ea580c; text-decoration: none; font-weight: 600;">info@buyawarranty.co.uk</a></p>
    </div>

    <!-- Final Message -->
    <div style="text-align: center; margin: 40px 0 20px 0;">
        <p style="color: #1f2937; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">You''ve made a smart choice to protect your vehicle. Drive with confidence knowing you''re covered when it matters most.</p>
        <p style="color: #6b7280; margin: 0; font-size: 14px;">Best regards,<br><strong>The BuyAWarranty Team</strong></p>
    </div>
</div>

</div>',
    'greeting', 'Hi {{customerName}},'
),
updated_at = now()
WHERE template_type = 'policy_documents' AND is_active = true;