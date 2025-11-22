import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-EMAIL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    const requestBody = await req.json();
    logStep("Request body received", requestBody);
    
    const { templateId, recipientEmail, variables, attachments } = requestBody;
    
    logStep("Request received", { 
      templateId, 
      recipientEmail, 
      hasVariables: !!variables,
      attachmentsCount: attachments?.length || 0
    });

    if (!recipientEmail) {
      logStep("ERROR: Missing recipient email");
      throw new Error("Recipient email is required");
    }

    // Verify Resend API key is set
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      logStep("ERROR: RESEND_API_KEY not found");
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    logStep("Resend API key found");

    // Build email subject based on template
    let subject = "Your Buy A Warranty Policy Is Now Active 🚗";
    let htmlContent = "";
    
    if (templateId === 'policy_documents' || templateId === 'welcome_email') {
      subject = `Your Buy A Warranty Policy Is Now Active 🚗`;
      
      // Extract first name from customerName
      const firstName = variables?.customerName?.split(' ')[0] || 'Valued Customer';
      
      // Build HTML email content
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
            
            <div class="header">
              <h1>Your Policy Is Now Active!</h1>
            </div>
            
            <div class="content">
              <p class="greeting">Hi ${firstName},</p>
              
              <p>Thanks for choosing Buy A Warranty to protect your vehicle — we're pleased to let you know that your warranty is now active!</p>
              
              <div class="info-box">
                <h3>Here are your policy details:</h3>
                <div class="info-row">
                  <span class="info-label">Policy Number:</span>
                  <span class="info-value">${variables?.policyNumber || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Plan Type:</span>
                  <span class="info-value">${variables?.planType || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Registration Plate:</span>
                  <span class="info-value">${variables?.registrationPlate || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Coverage Period:</span>
                  <span class="info-value">${variables?.coveragePeriod || variables?.periodInMonths + ' months' || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Start Date:</span>
                  <span class="info-value">${variables?.policyStartDate || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">End Date:</span>
                  <span class="info-value">${variables?.policyEndDate || variables?.policyExpiryDate || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Payment Method:</span>
                  <span class="info-value">${variables?.paymentMethod || variables?.paymentType || 'N/A'}</span>
                </div>
              </div>
              
              ${variables?.temporaryPassword && !variables?.isExistingCustomer ? `
              <div class="login-box">
                <h3>🔐 Your Portal Login Details!</h3>
                <p>You can view your updated policy anytime via your customer portal:</p>
                <div class="login-info">
                  <div class="info-row">
                    <span class="info-label">Login:</span>
                    <span class="info-value"><a href="${variables?.loginUrl || 'https://buyawarranty.co.uk/customer-dashboard'}" style="color: #1a365d;">Customer Dashboard</a></span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${variables?.loginEmail || recipientEmail}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Password:</span>
                    <span class="info-value"><strong>${variables?.temporaryPassword}</strong></span>
                  </div>
                </div>
                <a href="${variables?.loginUrl || 'https://buyawarranty.co.uk/customer-dashboard'}" class="button">Access Customer Portal</a>
              </div>
              ` : variables?.isExistingCustomer ? `
              <div class="login-box">
                <h3>🔐 Welcome Back!</h3>
                <p>You can access your updated policy through your existing customer portal account.</p>
                <div class="login-info">
                  <div class="info-row">
                    <span class="info-label">Login:</span>
                    <span class="info-value"><a href="${variables?.loginUrl || 'https://buyawarranty.co.uk/customer-dashboard'}" style="color: #1a365d;">Customer Dashboard</a></span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${variables?.loginEmail || recipientEmail}</span>
                  </div>
                </div>
                <p><em>${variables?.temporaryPassword || 'Use your existing password'}</em></p>
                <a href="${variables?.loginUrl || 'https://buyawarranty.co.uk/customer-dashboard'}" class="button">Access Customer Portal</a>
              </div>
              ` : ''}
              
              <div class="info-box">
                <h3>📎 Your Documents</h3>
                <p>Attached to this email, you'll find:</p>
                <div class="documents-list">
                  <ul>
                    <li>Warranty Policy Certificate</li>
                    <li>Terms & Conditions</li>
                  </ul>
                </div>
                <p style="margin-bottom: 0;"><strong>Please keep these safe</strong> — you'll need them if you ever need to make a claim.</p>
              </div>
              
              <div class="contact-section">
                <h3 style="margin-top: 0; color: #1a365d;">📞 Need a hand?</h3>
                <p>If you've got any questions or need help, feel free to reach out:</p>
                
                <div class="contact-block">
                  <div class="contact-title">Customer Sales and Support</div>
                  <div><strong>Email:</strong> support@buyawarranty.co.uk</div>
                  <div><strong>Phone:</strong> 0330 229 5040</div>
                </div>
                
                <div class="contact-block">
                  <div class="contact-title">Claims and Repairs</div>
                  <div><strong>Email:</strong> claims@buyawarranty.co.uk</div>
                  <div><strong>Phone:</strong> 0330 229 5045</div>
                </div>
                
                <div style="margin-top: 10px; color: #666;">
                  <strong>Hours:</strong> Monday to Friday, 9am – 5:30pm
                </div>
              </div>
              
              <p>Thanks again for choosing Buy A Warranty — we're here to keep you covered and give you peace of mind on the road.</p>
              
              <p style="margin-top: 30px;">Best regards,<br>
              <strong>The Buy A Warranty Team</strong></p>
            </div>
            
            <div class="footer">
              <p><strong>Buy A Warranty Ltd</strong> | Protecting Your Journey</p>
              <p>This email was sent to ${recipientEmail}</p>
              <p>&copy; ${new Date().getFullYear()} Buy A Warranty. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    // Prepare email payload
    const emailPayload: any = {
      from: "Buy A Warranty <support@buyawarranty.co.uk>",
      to: [recipientEmail],
      subject: subject,
      html: htmlContent,
    };

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      emailPayload.attachments = attachments.map((attachment: any) => {
        const attachmentData: any = {
          filename: attachment.filename,
          content: attachment.content,
          encoding: 'base64', // CRITICAL: Tell Resend this is base64 encoded
        };
        
        // Add content type if provided
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

    logStep("Sending email via Resend", { to: recipientEmail, subject });

    let data, error;
    try {
      const result = await resend.emails.send(emailPayload);
      data = result.data;
      error = result.error;
    } catch (resendError) {
      logStep("Resend API exception", { error: resendError });
      throw new Error(`Resend API exception: ${resendError.message || String(resendError)}`);
    }

    if (error) {
      logStep("Resend API error", error);
      throw new Error(`Resend API error: ${error.message || JSON.stringify(error)}`);
    }

    logStep("Email sent successfully", { messageId: data?.id });

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: data?.id,
        message: "Email sent successfully" 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
