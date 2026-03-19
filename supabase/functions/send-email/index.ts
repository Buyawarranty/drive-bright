import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-EMAIL] ${step}${detailsStr}`);
};

// Convert markdown-like content to HTML
const markdownToHtml = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #1a365d;">$1</a>')
    .replace(/^### (.*$)/gm, '<h3 style="color: #1a365d; margin: 16px 0 8px;">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 style="color: #1a365d; margin: 20px 0 10px;">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 style="color: #1a365d; margin: 24px 0 12px;">$1</h1>')
    .replace(/^(\d+)\. (.*)$/gm, '<li style="margin: 4px 0;">$2</li>')
    .replace(/^[•\-] (.*)$/gm, '<li style="margin: 4px 0;">$1</li>')
    .replace(/\n\n/g, '</p><p style="margin: 12px 0;">')
    .replace(/\n/g, '<br/>');
};

// Build a generic HTML email wrapper from template content
const buildTemplateHtml = (greeting: string, content: string, recipientEmail: string, variables: Record<string, string>): string => {
  // Replace template variables like {{customerFirstName}}
  let processedGreeting = greeting || 'Hi there,';
  let processedContent = content || '';
  
  for (const [key, value] of Object.entries(variables || {})) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    processedGreeting = processedGreeting.replace(regex, value || '');
    processedContent = processedContent.replace(regex, value || '');
  }
  
  // Also replace common variable patterns
  const varMap: Record<string, string> = {
    'customerFirstName': variables?.firstName || variables?.customerName?.split(' ')[0] || 'Valued Customer',
    'customerName': variables?.customerName || 'Valued Customer',
    'firstName': variables?.firstName || variables?.customerName?.split(' ')[0] || 'Valued Customer',
    'policyNumber': variables?.policyNumber || '',
    'planType': variables?.planType || '',
    'vehicleReg': variables?.vehicleReg || '',
    'portalUrl': variables?.portalUrl || 'https://buyawarranty.co.uk/customer-dashboard',
    'renewalUrl': variables?.renewalUrl || 'https://buyawarranty.co.uk',
    'expiryDate': variables?.expiryDate || '',
  };
  
  for (const [key, value] of Object.entries(varMap)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    processedGreeting = processedGreeting.replace(regex, value);
    processedContent = processedContent.replace(regex, value);
  }

  const htmlContent = markdownToHtml(processedContent);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; }
    .logo-header { background: #ffffff; padding: 30px; text-align: center; border-bottom: 3px solid #1a365d; }
    .logo-header img { max-width: 250px; height: auto; }
    .content { background: #f8f9fa; padding: 30px; }
    .greeting { font-size: 16px; margin-bottom: 20px; }
    .body-content { font-size: 14px; line-height: 1.8; }
    .body-content p { margin: 12px 0; }
    .body-content ul, .body-content ol { padding-left: 20px; margin: 12px 0; }
    .contact-section { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1a365d; }
    .trustpilot-section { text-align: center; padding: 20px; margin: 20px 0; background: white; border-radius: 8px; }
    .trustpilot-section img { max-width: 140px; height: auto; }
    .trustpilot-stars { color: #00b67a; font-size: 24px; letter-spacing: 2px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f1f1f1; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-header">
      <img src="https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/buy-a-warranty-logo.png" alt="Buy A Warranty" />
    </div>
    <div class="content">
      <p class="greeting">${processedGreeting}</p>
      <div class="body-content">
        <p>${htmlContent}</p>
      </div>
      <div class="contact-section">
        <p style="margin: 0 0 8px; font-weight: bold; color: #1a365d;">Need help?</p>
        <p style="margin: 4px 0;"><strong>Sales & Support:</strong> support@buyawarranty.co.uk | 0330 229 5040</p>
        <p style="margin: 4px 0;"><strong>Claims:</strong> claims@buyawarranty.co.uk | 0330 229 5045</p>
        <p style="margin: 4px 0; color: #666;">Monday to Friday, 9am – 5:30pm</p>
      </div>
      <div class="trustpilot-section">
        <p style="margin: 0 0 8px; font-weight: bold; color: #1a365d;">Trusted by thousands of drivers</p>
        <div class="trustpilot-stars">★★★★★</div>
        <p style="margin: 8px 0 4px; font-size: 14px; color: #333;"><strong>Excellent</strong> on Trustpilot</p>
        <p style="margin: 0; font-size: 12px; color: #666;">See our reviews at <a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" style="color: #00b67a;">trustpilot.com</a></p>
      </div>
    </div>
    <div class="footer">
      <p><strong>Buy A Warranty Ltd</strong> | Protecting Your Journey</p>
      <p>This email was sent to ${recipientEmail}</p>
      <p>&copy; ${new Date().getFullYear()} Buy A Warranty. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    const requestBody = await req.json();
    logStep("Request body received", requestBody);
    
    // Normalize empty strings to undefined so falsy checks work correctly
    const templateId = requestBody.templateId || undefined;
    const templateDbId = requestBody.templateDbId || undefined;
    const { recipientEmail, variables, attachments, customSubject, customHtml } = requestBody;
    
    logStep("Request received", { 
      templateId, 
      recipientEmail, 
      hasVariables: !!variables,
      hasCustomHtml: !!customHtml,
      attachmentsCount: attachments?.length || 0
    });

    if (!recipientEmail) {
      logStep("ERROR: Missing recipient email");
      throw new Error("Recipient email is required");
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      logStep("ERROR: RESEND_API_KEY not found");
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    logStep("Resend API key found");

    let subject = customSubject || "Your Buy A Warranty Policy Is Now Active 🚗";
    let htmlContent = customHtml || "";
    
    if (templateId === 'policy_documents' || templateId === 'welcome_email') {
      const firstName = variables?.customerName?.split(' ')[0] || variables?.firstName || 'Valued Customer';
      const isFutureActivation = variables?.isFutureActivation === 'true' || variables?.isFutureActivation === true;
      
      subject = customSubject || (isFutureActivation 
        ? `Your Buy A Warranty Policy – Future Activation Confirmed 🚗`
        : `Your Buy A Warranty Policy Is Now Active 🚗`);
      
      const headerText = isFutureActivation ? 'Future Activation Confirmed!' : 'Your Policy Is Now Active!';
      const introText = isFutureActivation
        ? `Thanks for choosing Buy A Warranty to protect your vehicle — we're pleased to confirm your warranty has been set up and will activate on <strong>${variables?.policyStartDate || 'N/A'}</strong>.`
        : `Thanks for choosing Buy A Warranty to protect your vehicle — we're pleased to let you know that your warranty is now active!`;
      const startDateLabel = isFutureActivation ? 'Activation Date' : 'Start Date';
      const endDateLabel = isFutureActivation ? 'Expiry Date' : 'End Date';
      
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 0; }
            .logo-header { background: #ffffff; padding: 30px; text-align: center; border-bottom: 3px solid #1a365d; }
            .logo-header img { max-width: 250px; height: auto; }
            .header { background: #1a365d; color: white; padding: 20px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 22px; }
            .content { background: #f8f9fa; padding: 30px; }
            .greeting { font-size: 16px; margin-bottom: 20px; }
            .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #1a365d; }
            .info-box h3 { margin-top: 0; color: #1a365d; font-size: 16px; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
            .info-row:last-child { border-bottom: none; }
            .info-label { font-weight: bold; color: #1a365d; }
            .info-value { color: #333; text-align: right; }
            .login-box { background: #e8f4f8; padding: 20px; margin: 20px 0; border-radius: 8px; border: 2px solid #1a365d; }
            .login-box h3 { margin-top: 0; color: #1a365d; font-size: 16px; }
            .login-info { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .button { display: inline-block; padding: 12px 30px; background: #1a365d; color: white !important; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            .documents-list { background: white; padding: 15px; border-radius: 5px; }
            .documents-list ul { margin: 10px 0; padding-left: 20px; }
            .contact-section { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .contact-block { margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #e5e7eb; }
            .contact-block:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
            .contact-title { font-weight: bold; color: #1a365d; font-size: 15px; margin-bottom: 8px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f1f1f1; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo-header">
              <img src="https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/buy-a-warranty-logo.png" alt="Buy A Warranty" />
            </div>
            <div class="header"><h1>${headerText}</h1></div>
            <div class="content">
              <p class="greeting">Hi ${firstName},</p>
              <p>${introText}</p>
              <div class="info-box">
                <h3>Here are your policy details:</h3>
                <div class="info-row"><span class="info-label">Policy Number:</span><span class="info-value">${variables?.policyNumber || 'N/A'}</span></div>
                <div class="info-row"><span class="info-label">Plan Type:</span><span class="info-value">${variables?.planType || 'N/A'}</span></div>
                <div class="info-row"><span class="info-label">Registration Plate:</span><span class="info-value">${variables?.registrationPlate || 'N/A'}</span></div>
                <div class="info-row"><span class="info-label">Coverage Period:</span><span class="info-value">${variables?.coveragePeriod || (variables?.periodInMonths ? variables.periodInMonths + ' months' : 'N/A')}</span></div>
                <div class="info-row"><span class="info-label">${startDateLabel}:</span><span class="info-value">${variables?.policyStartDate || 'N/A'}</span></div>
                <div class="info-row"><span class="info-label">${endDateLabel}:</span><span class="info-value">${variables?.policyEndDate || variables?.policyExpiryDate || 'N/A'}</span></div>
                <div class="info-row"><span class="info-label">Claim Limit:</span><span class="info-value">${variables?.claimLimitDisplay || 'N/A'}</span></div>
                <div class="info-row"><span class="info-label">Voluntary Excess:</span><span class="info-value">${variables?.voluntaryExcessDisplay || 'N/A'}</span></div>
                <div class="info-row"><span class="info-label">Labour Rate:</span><span class="info-value">${variables?.labourRateDisplay || 'N/A'}</span></div>
                <div class="info-row"><span class="info-label">Payment Method:</span><span class="info-value">${variables?.paymentMethod || variables?.paymentType || 'N/A'}</span></div>
              </div>
              ${variables?.temporaryPassword && !variables?.isExistingCustomer ? `
              <div class="login-box">
                <h3>🔐 Your Portal Login Details!</h3>
                <p>You can view your updated policy anytime via your customer portal:</p>
                <div class="login-info">
                  <div class="info-row"><span class="info-label">Login:</span><span class="info-value"><a href="${variables?.loginUrl || 'https://buyawarranty.co.uk/customer-dashboard'}" style="color: #1a365d;">Customer Dashboard</a></span></div>
                  <div class="info-row"><span class="info-label">Email:</span><span class="info-value">${variables?.loginEmail || recipientEmail}</span></div>
                  <div class="info-row"><span class="info-label">Password:</span><span class="info-value"><strong>${variables?.temporaryPassword}</strong></span></div>
                </div>
                <a href="${variables?.loginUrl || 'https://buyawarranty.co.uk/customer-dashboard'}" class="button">Access Customer Portal</a>
              </div>` : variables?.isExistingCustomer ? `
              <div class="login-box">
                <h3>🔐 Welcome Back!</h3>
                <p>You can access your updated policy through your existing customer portal account.</p>
                <div class="login-info">
                  <div class="info-row"><span class="info-label">Login:</span><span class="info-value"><a href="${variables?.loginUrl || 'https://buyawarranty.co.uk/customer-dashboard'}" style="color: #1a365d;">Customer Dashboard</a></span></div>
                  <div class="info-row"><span class="info-label">Email:</span><span class="info-value">${variables?.loginEmail || recipientEmail}</span></div>
                </div>
                <p><em>${variables?.temporaryPassword || 'Use your existing password'}</em></p>
                <a href="${variables?.loginUrl || 'https://buyawarranty.co.uk/customer-dashboard'}" class="button">Access Customer Portal</a>
              </div>` : ''}
              <div class="info-box">
                <h3>📎 Your Documents</h3>
                <p>Attached to this email, you'll find:</p>
                <div class="documents-list"><ul><li>Warranty Policy Certificate</li><li>Terms & Conditions</li></ul></div>
                <p style="margin-bottom: 0;"><strong>Please keep these safe</strong> — you'll need them if you ever need to make a claim.</p>
              </div>
              <div class="contact-section">
                <h3 style="margin-top: 0; color: #1a365d;">📞 Need a hand?</h3>
                <p>If you've got any questions or need help, feel free to reach out:</p>
                <div class="contact-block"><div class="contact-title">Customer Sales and Support</div><div><strong>Email:</strong> support@buyawarranty.co.uk</div><div><strong>Phone:</strong> 0330 229 5040</div></div>
                <div class="contact-block"><div class="contact-title">Claims and Repairs</div><div><strong>Email:</strong> claims@buyawarranty.co.uk</div><div><strong>Phone:</strong> 0330 229 5045</div></div>
                <div style="margin-top: 10px; color: #666;"><strong>Hours:</strong> Monday to Friday, 9am – 5:30pm</div>
              </div>
              <p>Thanks again for choosing Buy A Warranty — we're here to keep you covered and give you peace of mind on the road.</p>
              <p style="margin-top: 30px;">Best regards,<br><strong>The Buy A Warranty Team</strong></p>
            </div>
            <div class="footer">
              <p><strong>Buy A Warranty Ltd</strong> | Protecting Your Journey</p>
              <p>This email was sent to ${recipientEmail}</p>
              <p>&copy; ${new Date().getFullYear()} Buy A Warranty. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>`;
    } else if (!customHtml && (templateId || templateDbId)) {
      // Fetch template from database and render it
      logStep("Fetching template from database", { templateId, templateDbId });
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseClient = createClient(supabaseUrl, supabaseKey);
      
      let template = null;
      let templateError = null;

      // Try lookup by DB id first, then by template_type
      if (templateDbId) {
        const result = await supabaseClient
          .from('email_templates')
          .select('*')
          .eq('id', templateDbId)
          .maybeSingle();
        template = result.data;
        templateError = result.error;
      }
      
      if (!template && templateId) {
        const result = await supabaseClient
          .from('email_templates')
          .select('*')
          .eq('template_type', templateId)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        template = result.data;
        templateError = result.error;
      }
      
      if (templateError) {
        logStep("Template fetch error", templateError);
      }
      
      if (template) {
        logStep("Template found", { name: template.name, subject: template.subject });
        subject = customSubject || template.subject || subject;
        
        const templateContent = typeof template.content === 'string' 
          ? JSON.parse(template.content) 
          : template.content;
        
        const greeting = templateContent?.greeting || 'Hi there,';
        const bodyContent = templateContent?.content || '';
        
        htmlContent = buildTemplateHtml(greeting, bodyContent, recipientEmail, variables || {});
      } else {
        // Fallback: generate a simple HTML email with the variables
        logStep("No template found, using fallback HTML");
        const firstName = variables?.firstName || variables?.customerName?.split(' ')[0] || 'Valued Customer';
        htmlContent = buildTemplateHtml(
          `Hi ${firstName},`,
          'Thank you for contacting Buy A Warranty. We wanted to reach out regarding your vehicle warranty.\n\nIf you have any questions, please don\'t hesitate to contact us.',
          recipientEmail,
          variables || {}
        );
      }
    }

    // Final safety check - ensure we have HTML content
    if (!htmlContent || htmlContent.trim() === '') {
      logStep("WARNING: Empty HTML content, generating fallback");
      const firstName = variables?.firstName || variables?.customerName?.split(' ')[0] || 'Valued Customer';
      htmlContent = buildTemplateHtml(
        `Hi ${firstName},`,
        'Thank you for your interest in Buy A Warranty. We are here to help protect your vehicle.',
        recipientEmail,
        variables || {}
      );
    }

    // Prepare email payload
    // Add Trustpilot BCC for welcome/policy emails only
    const isWelcomeEmail = templateId === 'policy_documents' || templateId === 'welcome_email';
    const emailPayload: any = {
      from: "BuyaWarranty Team <support@buyawarranty.co.uk>",
      to: [recipientEmail],
      ...(isWelcomeEmail && { bcc: ['buyawarranty.co.uk+8fc526946e@invite.trustpilot.com'] }),
      subject: subject,
      html: htmlContent,
    };

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      emailPayload.attachments = attachments.map((attachment: any) => {
        const attachmentData: any = {
          filename: attachment.filename,
          content: attachment.content,
          encoding: 'base64',
        };
        if (attachment.type) {
          attachmentData.contentType = attachment.type;
        }
        return attachmentData;
      });
      logStep("Added attachments to email", { 
        count: attachments.length,
        filenames: attachments.map((a: any) => a.filename)
      });
    }

    logStep("Sending email via Resend", { to: recipientEmail, subject, htmlLength: htmlContent.length });

    let data, error;
    try {
      const result = await resend.emails.send(emailPayload);
      data = result.data;
      error = result.error;
    } catch (resendError) {
      logStep("Resend API exception", { error: resendError });
      const errorMsg = resendError instanceof Error ? resendError.message : String(resendError);
      throw new Error(`Resend API exception: ${errorMsg}`);
    }

    if (error) {
      logStep("Resend API error", error);
      throw new Error(`Resend API error: ${error.message || JSON.stringify(error)}`);
    }

    logStep("Email sent successfully", { messageId: data?.id });

    // Log the email to email_logs table for delivery tracking
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const logClient = createClient(supabaseUrl, supabaseKey);
      
      await logClient.from('email_logs').insert({
        recipient_email: recipientEmail,
        recipient_name: variables?.customerName || variables?.firstName || null,
        subject: subject,
        status: 'sent',
        delivery_status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: {
          template_id: templateId || 'custom',
          resend_message_id: data?.id,
          has_attachments: (attachments?.length || 0) > 0
        }
      });
      logStep("Email logged to email_logs table");
    } catch (logError) {
      logStep("WARNING: Failed to log email", { error: logError });
      // Don't fail the response if logging fails
    }

    return new Response(
      JSON.stringify({ success: true, messageId: data?.id, message: "Email sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
