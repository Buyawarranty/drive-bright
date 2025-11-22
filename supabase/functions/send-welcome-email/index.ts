import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-WELCOME-EMAIL] ${step}${detailsStr}`);
};

// Generate random password
const generateTempPassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const { email, planType, paymentType, policyNumber, registrationPlate, customerName } = await req.json();
    logStep("Request data", { email, planType, paymentType, policyNumber, registrationPlate, customerName });

    if (!email || !planType || !paymentType || !policyNumber) {
      logStep("Missing required parameters", { email: !!email, planType: !!planType, paymentType: !!paymentType, policyNumber: !!policyNumber });
      throw new Error("Missing required parameters: email, planType, paymentType, and policyNumber are all required");
    }

    // Fetch policy/customer data to get seasonal bonus information
    logStep("Fetching policy data for seasonal bonus");
    const { data: policyData, error: policyFetchError } = await supabaseClient
      .from('customer_policies')
      .select('seasonal_bonus_months')
      .eq('policy_number', policyNumber)
      .maybeSingle();

    const seasonalBonusMonths = policyData?.seasonal_bonus_months || 0;
    logStep("Seasonal bonus retrieved", { seasonalBonusMonths });

    // Check if welcome email already sent for this email address
    logStep("Checking for existing welcome email record");
    const { data: existingWelcomeEmail } = await supabaseClient
      .from('welcome_emails')
      .select('temporary_password, email_sent_at')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // If welcome email already sent recently (within 1 hour), skip sending another one
    if (existingWelcomeEmail) {
      const sentAt = new Date(existingWelcomeEmail.email_sent_at);
      const now = new Date();
      const hoursSinceSent = (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60);
      
      // Temporarily allowing resends after 1 hour instead of 24 hours for testing
      if (hoursSinceSent < 1) {
        logStep("Welcome email already sent recently", { 
          sentAt: existingWelcomeEmail.email_sent_at,
          hoursSinceSent 
        });
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Welcome email already sent recently',
          skipped: true
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Use existing password or generate new one
    const tempPassword = existingWelcomeEmail?.temporary_password || generateTempPassword();
    logStep(existingWelcomeEmail ? "Using existing temporary password" : "Generated new temporary password");

    // Check if user already exists first by email
    logStep("Checking if user exists");
    const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
    const userExists = existingUsers?.users?.find(u => u.email === email);
    
    let userId = null;
    
    if (userExists) {
      logStep("User already exists", { userId: userExists.id });
      userId = userExists.id;
      
      // Update existing user's password
      const { data: updateData, error: updateError } = await supabaseClient.auth.admin.updateUserById(userExists.id, {
        password: tempPassword,
        user_metadata: {
          plan_type: planType,
          policy_number: policyNumber
        }
      });

      if (updateError) {
        logStep("Failed to update user password", updateError);
        throw new Error(`Failed to update user password: ${updateError.message}`);
      }
      
      logStep("Updated existing user password and metadata", { userId: userExists.id, tempPasswordLength: tempPassword.length });
    } else {
      // Create user with Supabase Auth
      logStep("Creating new user with auth");
      const { data: userData, error: userError } = await supabaseClient.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          plan_type: planType,
          policy_number: policyNumber
        }
      });

      if (userError) {
        logStep("User creation failed", userError);
        throw new Error(`Failed to create user: ${userError.message}`);
      }

      if (!userData.user) {
        throw new Error("User creation returned no user data");
      }

      userId = userData.user.id;
      logStep("User created successfully", { userId, email, tempPasswordLength: tempPassword.length });
    }

    // Add a brief delay to ensure password is fully propagated in Supabase Auth
    logStep("Waiting for auth system to propagate password changes");
    await new Promise(resolve => setTimeout(resolve, 2000));
    logStep("Password propagation wait complete");

    // Store welcome email record for audit
    try {
      const { error: welcomeEmailError } = await supabaseClient
        .from('welcome_emails')
        .insert({
          user_id: userId,
          email: email,
          temporary_password: tempPassword,
          email_sent_at: new Date().toISOString()
        });

      if (welcomeEmailError) {
        logStep("Warning: Could not store welcome email record", welcomeEmailError);
      }
    } catch (auditError) {
      logStep("Warning: Welcome email audit failed", auditError);
    }

    // Create or update policy record
    const policyEndDate = calculatePolicyEndDate(paymentType);
    
    const { data: policyData, error: policyError } = await supabaseClient
      .from('customer_policies')
      .upsert({
        user_id: userId,
        email: email,
        plan_type: planType.toLowerCase(),
        payment_type: paymentType,
        policy_number: policyNumber,
        policy_end_date: policyEndDate,
        status: 'active',
        email_sent_status: 'sent',
        email_sent_at: new Date().toISOString()
      }, {
        onConflict: 'policy_number'
      })
      .select()
      .single();

    if (policyError) {
      logStep("Policy creation failed", policyError);
      throw new Error(`Failed to create policy: ${policyError.message}`);
    }
    logStep("Created policy record", { policyId: policyData.id });

    // Get environment variables for email
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFrom = 'Buy A Warranty <noreply@buyawarranty.co.uk>';
    
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    // Fetch documents from Supabase Storage
    logStep("Fetching documents from Supabase Storage");
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://mzlpuxzwyrcyrgrongeb.supabase.co';
    
    // Construct direct public URLs for documents in Storage
    // Always use Platinum warranty plan for all purchases
    const termsStoragePath = 'terms/Terms-and-Conditions-v2.3.pdf';
    const platinumPlanPath = 'platinum/Platinum-Warranty-Plan-v2.3.pdf';
    
    const termsDoc = {
      file_url: `${supabaseUrl}/storage/v1/object/public/policy-documents/${termsStoragePath}`,
      document_name: 'Terms-and-Conditions-v2.3.pdf'
    };
    
    const planDoc = {
      file_url: `${supabaseUrl}/storage/v1/object/public/policy-documents/${platinumPlanPath}`,
      document_name: 'Platinum-Warranty-Plan-v2.3.pdf'
    };
    
    logStep("Document URLs constructed", { 
      termsUrl: termsDoc.file_url, 
      planUrl: planDoc.file_url 
    });

    // Registration plate styling - optimized for both light and dark modes
    const regPlate = registrationPlate || 'N/A';
    const regPlateStyle = `
      display: inline-block;
      background: #1a1a1a;
      color: #ffffff;
      font-family: 'Charles Wright', monospace;
      font-weight: bold;
      font-size: 18px;
      padding: 8px 12px;
      border: 2px solid #1a1a1a;
      border-radius: 4px;
      letter-spacing: 2px;
      text-align: center;
      min-width: 120px;
      text-shadow: none;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;

    const finalCustomerName = customerName || email.split('@')[0];

    // Calculate coverage period in months and dates (including seasonal bonus)
    const baseCoverageMonths = getCoverageInMonths(paymentType);
    const totalCoverageMonths = baseCoverageMonths + seasonalBonusMonths;
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + totalCoverageMonths);

    // Format dates
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    // Load the required PDF attachments from Supabase Storage
    const attachments = [];
    
    try {
      // Load Terms and Conditions PDF from Storage
      logStep("Fetching Terms PDF", { url: termsDoc.file_url });
      const termsResponse = await fetch(termsDoc.file_url);
      if (termsResponse.ok) {
        const termsBuffer = await termsResponse.arrayBuffer();
        const termsBytes = new Uint8Array(termsBuffer);
        
        // Convert to base64 properly using a binary string approach
        let binary = '';
        for (let i = 0; i < termsBytes.length; i++) {
          binary += String.fromCharCode(termsBytes[i]);
        }
        const termsBase64 = btoa(binary);
        
        attachments.push({
          filename: termsDoc.document_name,
          content: termsBase64,
          type: 'application/pdf',
          disposition: 'attachment'
        });
        logStep("Terms PDF attached successfully", { size: termsBytes.length });
      } else {
        logStep("Terms PDF fetch failed", { status: termsResponse.status });
      }
      
      // Load Platinum Warranty Plan PDF from Storage (used for all plan types)
      logStep("Fetching Platinum Warranty Plan PDF", { url: planDoc.file_url });
      const planResponse = await fetch(planDoc.file_url);
      if (planResponse.ok) {
        const planBuffer = await planResponse.arrayBuffer();
        const planBytes = new Uint8Array(planBuffer);
        
        // Convert to base64 properly using a binary string approach
        let binary = '';
        for (let i = 0; i < planBytes.length; i++) {
          binary += String.fromCharCode(planBytes[i]);
        }
        const planBase64 = btoa(binary);
        
        attachments.push({
          filename: planDoc.document_name,
          content: planBase64,
          type: 'application/pdf',
          disposition: 'attachment'
        });
        logStep("Platinum Plan PDF attached successfully", { size: planBytes.length });
      } else {
        logStep("Platinum Plan PDF fetch failed", { status: planResponse.status });
      }
    } catch (error) {
      logStep("ERROR: Could not load PDF attachments from Storage", error);
    }

    // Send welcome email directly using Resend
    const emailPayload = {
      from: resendFrom,
      to: [email],
      subject: `Your Buy A Warranty Policy Is Now Active 🚗`,
      ...(attachments.length > 0 && { attachments }),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; color: #333333;">
          
          <!-- Logo -->
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://buyawarranty.co.uk/images/buyawarranty-logo.png" alt="Buy A Warranty" style="max-width: 300px; height: auto;" />
          </div>

          <!-- Greeting -->
          <div style="margin-bottom: 25px;">
            <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">Hi <strong>${finalCustomerName}</strong>,</p>
            <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0;">Thanks for choosing Buy A Warranty to protect your vehicle — we're pleased to let you know that your warranty is now active!</p>
          </div>

          ${seasonalBonusMonths > 0 ? `
          <!-- Seasonal Bonus Banner -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0 0 10px 0; font-size: 22px; font-weight: 700;">🎉 Special Bonus!</h2>
            <p style="color: #ffffff; font-size: 16px; margin: 0; line-height: 1.6;">
              You've received an <strong>extra ${seasonalBonusMonths} months</strong> of warranty coverage at no additional cost!
            </p>
            <p style="color: #ffffff; font-size: 14px; margin: 10px 0 0 0; opacity: 0.95;">
              Your warranty now covers you until <strong>${formatDate(endDate)}</strong>
            </p>
          </div>
          ` : ''}

          <!-- Policy Details -->
          <div style="margin-bottom: 25px;">
            <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;"><strong>Here are your policy details:</strong></p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 0; color: #555555; font-size: 15px;"><strong>Policy Number:</strong></td>
                <td style="padding: 8px 0; color: #333333; font-size: 15px;">${policyNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #555555; font-size: 15px;"><strong>Plan Type:</strong></td>
                <td style="padding: 8px 0; color: #333333; font-size: 15px;">${planType}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #555555; font-size: 15px;"><strong>Registration Plate:</strong></td>
                <td style="padding: 8px 0; color: #333333; font-size: 15px;"><span style="${regPlateStyle}">${regPlate}</span></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #555555; font-size: 15px;"><strong>Coverage Period:</strong></td>
                <td style="padding: 8px 0; color: #333333; font-size: 15px;">${totalCoverageMonths} months${seasonalBonusMonths > 0 ? ` <span style="color: #10b981; font-weight: 600;">(+${seasonalBonusMonths} bonus months!)</span>` : ''}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #555555; font-size: 15px;"><strong>Start Date:</strong></td>
                <td style="padding: 8px 0; color: #333333; font-size: 15px;">${formatDate(startDate)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #555555; font-size: 15px;"><strong>End Date:</strong></td>
                <td style="padding: 8px 0; color: #333333; font-size: 15px;">${formatDate(endDate)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #555555; font-size: 15px;"><strong>Payment Method:</strong></td>
                <td style="padding: 8px 0; color: #333333; font-size: 15px;">Stripe</td>
              </tr>
            </table>
          </div>

          <!-- Portal Login -->
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #333333; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">🔐 Your Portal Login Details!</h3>
            <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0 0 15px 0;">You can view your updated policy anytime via your customer portal:</p>
            <p style="margin: 8px 0; color: #333333; font-size: 15px;"><strong>Login:</strong> <a href="https://buyawarranty.co.uk/auth" style="color: #1a73e8; text-decoration: none;">Customer Dashboard</a></p>
            <p style="margin: 8px 0; color: #333333; font-size: 15px;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 8px 0; color: #333333; font-size: 15px;"><strong>Temporary Password:</strong> <code style="background-color: #ffffff; padding: 4px 8px; border-radius: 4px; font-family: 'Courier New', monospace; color: #333333; border: 1px solid #dee2e6;">${tempPassword}</code></p>
            <p style="margin: 8px 0; color: #555555; font-size: 13px; font-style: italic;">Use your previous password if you have one or you may reset it.</p>
          </div>

          <!-- Documents -->
          <div style="margin-bottom: 25px;">
            <h3 style="color: #333333; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">📎 Your Documents</h3>
            <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0 0 10px 0;">Attached to this email, you'll find:</p>
            <ul style="color: #333333; font-size: 15px; line-height: 1.8; margin: 0 0 10px 0; padding-left: 20px;">
              <li>Platinum Warranty Plan Certificate</li>
              <li>Terms & Conditions</li>
            </ul>
            <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0;">Please keep these safe — you'll need them if you ever need to make a claim.</p>
          </div>

          <!-- Support -->
          <div style="margin-bottom: 25px;">
            <h3 style="color: #333333; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">📞 Need a hand?</h3>
            <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0 0 15px 0;">If you've got any questions or need help, feel free to reach out:</p>
            
            <div style="margin-bottom: 15px;">
              <p style="color: #333333; font-size: 15px; margin: 0 0 5px 0;"><strong>Customer Sales and Support</strong></p>
              <p style="color: #333333; font-size: 15px; margin: 0;">Email: <a href="mailto:support@buyawarranty.co.uk" style="color: #1a73e8; text-decoration: none;">support@buyawarranty.co.uk</a></p>
              <p style="color: #333333; font-size: 15px; margin: 0;">Phone: <a href="tel:03302295040" style="color: #1a73e8; text-decoration: none;">0330 229 5040</a></p>
            </div>
            
            <div style="margin-bottom: 15px;">
              <p style="color: #333333; font-size: 15px; margin: 0 0 5px 0;"><strong>Claims and Repairs</strong></p>
              <p style="color: #333333; font-size: 15px; margin: 0;">Email: <a href="mailto:claims@buyawarranty.co.uk" style="color: #1a73e8; text-decoration: none;">claims@buyawarranty.co.uk</a></p>
              <p style="color: #333333; font-size: 15px; margin: 0;">Phone: <a href="tel:03302295045" style="color: #1a73e8; text-decoration: none;">0330 229 5045</a></p>
              <p style="color: #555555; font-size: 14px; margin: 5px 0 0 0;">Hours: Monday to Friday, 9am – 5:30pm</p>
            </div>
          </div>

          <!-- Closing -->
          <div style="margin-bottom: 25px;">
            <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0;">Thanks again for choosing Buy A Warranty — we're here to keep you covered and give you peace of mind on the road.</p>
          </div>

          <!-- Footer -->
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
            <p style="color: #333333; font-size: 15px; margin: 0 0 5px 0;"><strong>Best regards,</strong></p>
            <p style="color: #333333; font-size: 15px; margin: 0;">The Buy A Warranty Team</p>
          </div>
        </div>
      `
    };

    logStep("Sending email with attachments", { attachmentCount: attachments.length });
    
    if (attachments.length === 0) {
      logStep("WARNING: No PDF attachments loaded - email will be sent without documents");
    }
    
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      const emailResult = await response.json();

      if (!response.ok) {
        logStep("Email sending failed", { status: response.status, error: emailResult });
        throw new Error(`Email sending failed: ${emailResult.message || 'Unknown error'}`);
      }

      logStep("Welcome email sent successfully", emailResult);
    } catch (emailError) {
      logStep("Error sending welcome email", emailError);
      const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
      throw new Error(`Email sending error: ${errorMessage}`);
    }

    // Schedule Trustpilot review emails according to new schedule
    try {
      const { data: feedbackTemplate, error: templateError } = await supabaseClient
        .from('email_templates')
        .select('id')
        .eq('template_type', 'feedback')
        .eq('is_active', true)
        .single();

      if (feedbackTemplate && !templateError) {
        // Calculate first Tuesday at 10am after purchase
        const purchaseDate = new Date();
        const firstTuesday = getNextTuesday(purchaseDate);
        firstTuesday.setHours(10, 0, 0, 0); // Set to 10am

        // Schedule first review invitation
        const { error: scheduleError1 } = await supabaseClient
          .from('scheduled_emails')
          .insert({
            template_id: feedbackTemplate.id,
            customer_id: userId,
            recipient_email: email,
            scheduled_for: firstTuesday.toISOString(),
            metadata: {
              customerFirstName: finalCustomerName,
              expiryDate: calculatePolicyEndDate(paymentType),
              portalUrl: 'https://buyawarranty.co.uk/customer-dashboard',
              referralLink: `https://buyawarranty.co.uk/refer/${userId || 'guest'}`,
              emailType: 'first_invitation'
            }
          });

        if (scheduleError1) {
          logStep('Failed to schedule first Trustpilot email', { error: scheduleError1 });
        } else {
          logStep('First Trustpilot email scheduled successfully', { scheduledFor: firstTuesday });
        }

        // Calculate following Thursday at 6pm for reminder (only if no review left)
        const followingThursday = getFollowingThursday(firstTuesday);
        followingThursday.setHours(18, 0, 0, 0); // Set to 6pm

        // Get the reminder template
        const { data: reminderTemplate, error: reminderTemplateError } = await supabaseClient
          .from('email_templates')
          .select('id')
          .eq('template_type', 'feedback_reminder')
          .eq('is_active', true)
          .single();

        // Schedule reminder email if template exists
        if (reminderTemplate && !reminderTemplateError) {
          const { error: scheduleError2 } = await supabaseClient
            .from('scheduled_emails')
            .insert({
              template_id: reminderTemplate.id,
              customer_id: userId,
              recipient_email: email,
              scheduled_for: followingThursday.toISOString(),
              metadata: {
                customerFirstName: finalCustomerName,
                expiryDate: calculatePolicyEndDate(paymentType),
                portalUrl: 'https://buyawarranty.co.uk/customer-dashboard',
                referralLink: `https://buyawarranty.co.uk/refer/${userId || 'guest'}`,
                emailType: 'reminder'
              }
            });

          if (scheduleError2) {
            logStep('Failed to schedule reminder Trustpilot email', { error: scheduleError2 });
          } else {
            logStep('Reminder Trustpilot email scheduled successfully', { scheduledFor: followingThursday });
          }
        }
      }
    } catch (error) {
      logStep("Error scheduling Trustpilot emails", error);
      // Don't fail the whole process if scheduling fails
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Welcome email process completed",
      policyId: policyData.id,
      userId: userId
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    let errorMessage = 'Unknown error';
    let errorDetails = null;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    } else {
      errorMessage = String(error);
      errorDetails = error;
    }
    
    logStep("ERROR in send-welcome-email", errorDetails);
    console.error("Full error object:", JSON.stringify(errorDetails, null, 2));
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage,
      details: errorDetails
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// Centralized warranty duration utilities to ensure consistency across all systems
// This should be the single source of truth for warranty duration calculations

/**
 * Get warranty duration in months based on payment type
 * This is the MASTER function for warranty duration calculation
 */
function getWarrantyDurationInMonths(paymentType: string): number {
  const normalizedPaymentType = paymentType?.toLowerCase().replace(/[_-]/g, '').trim();
  
  switch (normalizedPaymentType) {
    case 'monthly':
    case '1month':
    case 'month':
    case '12months':
    case '12month':
    case 'yearly':
    case '1year':
    case 'year':
      return 12;
    case '24months':
    case '24month':
    case 'twomonthly':
    case '2monthly':
    case 'twoyearly':
    case '2year':
    case 'twoyear':
      return 24;
    case '36months':
    case '36month':
    case 'threemonthly':
    case '3monthly':
    case 'threeyearly':
    case '3year':
    case 'threeyear':
      return 36;
    case '48months':
    case '48month':
    case 'fourmonthly':
    case '4monthly':
      return 48;
    case '60months':
    case '60month':
    case 'fivemonthly':
    case '5monthly':
      return 60;
    default:
      console.warn(`[SEND-WELCOME-EMAIL] Unknown payment type: ${paymentType}, defaulting to 12 months`);
      return 12;
  }
}
// Helper function to get coverage period in months - updated to use centralized logic
function getCoverageInMonths(paymentType: string): number {
  return getWarrantyDurationInMonths(paymentType);
}

// Helper function to calculate policy end date - updated to use centralized logic
function calculatePolicyEndDate(paymentType: string): string {
  const startDate = new Date();
  const months = getWarrantyDurationInMonths(paymentType);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + months);
  return endDate.toISOString();
}

// Helper function to get next Tuesday after a given date
function getNextTuesday(fromDate: Date): Date {
  const result = new Date(fromDate);
  const dayOfWeek = result.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysUntilTuesday = (2 - dayOfWeek + 7) % 7; // 2 = Tuesday
  
  // If today is Tuesday, get next Tuesday
  if (daysUntilTuesday === 0) {
    result.setDate(result.getDate() + 7);
  } else {
    result.setDate(result.getDate() + daysUntilTuesday);
  }
  
  return result;
}

// Helper function to get the Thursday following a given Tuesday
function getFollowingThursday(tuesday: Date): Date {
  const result = new Date(tuesday);
  result.setDate(result.getDate() + 2); // Tuesday + 2 days = Thursday
  return result;
}