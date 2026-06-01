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

    const { email, planType, paymentType, policyNumber, registrationPlate, customerName, labourRate } = await req.json();
    logStep("Request data", { email, planType, paymentType, policyNumber, registrationPlate, customerName, labourRate });

    if (!email || !planType || !paymentType || !policyNumber) {
      logStep("Missing required parameters", { email: !!email, planType: !!planType, paymentType: !!paymentType, policyNumber: !!policyNumber });
      throw new Error("Missing required parameters: email, planType, paymentType, and policyNumber are all required");
    }

    // Fetch policy/customer data to get seasonal bonus information
    logStep("Fetching policy data for seasonal bonus");
    const { data: existingPolicyData, error: policyFetchError } = await supabaseClient
      .from('customer_policies')
      .select('seasonal_bonus_months')
      .eq('policy_number', policyNumber)
      .maybeSingle();

    const seasonalBonusMonths = existingPolicyData?.seasonal_bonus_months || 0;
    logStep("Seasonal bonus retrieved", { seasonalBonusMonths });

    // Check if welcome email already sent for this email address
    logStep("Checking for existing welcome email record");
    const { data: existingWelcomeEmail } = await supabaseClient
      .from('welcome_emails')
      .select('temporary_password, email_sent_at, password_reset_by_user')
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
    const userHasResetPassword = existingWelcomeEmail?.password_reset_by_user === true;
    logStep(existingWelcomeEmail ? "Using existing temporary password" : "Generated new temporary password");

    // Check if user already exists first by email (paginate to avoid missing users beyond first 1000)
    logStep("Checking if user exists");
    let userExists: { id: string; email?: string | null; user_metadata?: Record<string, any> } | undefined;
    let page = 1;
    const perPage = 1000;

    while (!userExists && page <= 20) {
      const { data: existingUsers, error: listUsersError } = await supabaseClient.auth.admin.listUsers({ page, perPage });

      if (listUsersError) {
        logStep("Failed to list users", listUsersError);
        throw new Error(`Failed to list users: ${listUsersError.message}`);
      }

      const batch = existingUsers?.users ?? [];
      userExists = batch.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (batch.length < perPage) {
        break;
      }

      page += 1;
    }
    
    let userId = null;
    
    if (userExists) {
      logStep("User already exists", { userId: userExists.id });
      userId = userExists.id;
      
      // Only update password if user hasn't reset it themselves
      if (userHasResetPassword) {
        logStep("Skipping password update - user has already set their own password", { userId: userExists.id });
      } else {
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
      }
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
          email_sent_at: new Date().toISOString(),
          password_reset_by_user: userHasResetPassword
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
        warranty_number: policyNumber, // Use same reference to prevent trigger from generating a duplicate
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
    
    if (!policyData) {
      throw new Error("Policy creation returned no data");
    }
    
    logStep("Created policy record", { policyId: policyData.id });

    // Get environment variables for email
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFrom = 'Buyawarranty Customer Care <noreply@buyawarranty.co.uk>';
    
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    // Fetch documents from Supabase Storage
    logStep("Fetching documents from Supabase Storage");
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://mzlpuxzwyrcyrgrongeb.supabase.co';
    
    // Construct direct public URLs for documents in Storage
    // Always use Platinum warranty plan v3.3 for all purchases
    const termsStoragePath = 'terms/terms-and-conditions-v3.4-2026-06.pdf';
    const platinumPlanPath = 'platinum/platinum-warranty-plan-v3.4-2026-06.pdf';
    
    const termsDoc = {
      file_url: `${supabaseUrl}/storage/v1/object/public/policy-documents/${termsStoragePath}`,
      document_name: 'Terms-and-Conditions-v3.3.pdf'
    };
    
    const planDoc = {
      file_url: `${supabaseUrl}/storage/v1/object/public/policy-documents/${platinumPlanPath}`,
      document_name: 'Platinum-Warranty-Plan-v3.3.pdf'
    };
    
    logStep("Document URLs constructed", { 
      termsUrl: termsDoc.file_url, 
      planUrl: planDoc.file_url 
    });

    // Registration plate styling - UK-style yellow background with black text
    const regPlate = registrationPlate || 'N/A';
    const regPlateStyle = `
      display: inline-block;
      background: #FFD700;
      color: #000000;
      font-family: 'Charles Wright', monospace;
      font-weight: bold;
      font-size: 18px;
      padding: 8px 16px;
      border: 2px solid #000000;
      border-radius: 4px;
      letter-spacing: 2px;
      text-align: center;
      min-width: 120px;
      text-shadow: none;
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
    // Note: Subject line optimized for Primary inbox - no emojis, conversational tone
    const emailPayload = {
      from: resendFrom,
      to: [email],
      bcc: ['buyawarranty.co.uk+8fc526946e@invite.trustpilot.com'],
      reply_to: 'support@buyawarranty.co.uk',
      subject: `${finalCustomerName}, your warranty is now active`,
      headers: {
        'X-Entity-Ref-ID': `welcome-${policyNumber}-${Date.now()}`,
      },
      ...(attachments.length > 0 && { attachments }),
      html: `
        <style>
          @media only screen and (max-width: 600px) {
            .baw-wrap { padding: 16px 10px !important; }
            .baw-card { padding: 22px 18px !important; }
            .baw-card-sm { padding: 18px !important; }
            .baw-h1 { font-size: 20px !important; }
            .baw-h2 { font-size: 17px !important; }
            .baw-cta { padding: 13px 24px !important; font-size: 15px !important; display: block !important; }
            .baw-contact-cell { display: block !important; width: 100% !important; box-sizing: border-box; margin-bottom: 10px; }
            .baw-row-label, .baw-row-value { font-size: 13px !important; }
            .baw-portal-cell { padding: 12px 14px !important; font-size: 13px !important; }
          }
        </style>
        <div class="baw-wrap" style="background-color: #f5f6f8; padding: 30px 15px; font-family: Arial, Helvetica, sans-serif; color: #1f2937;">
          <div style="max-width: 600px; margin: 0 auto;">

            <!-- Header / Logo -->
            <div style="text-align: center; padding: 10px 0 25px;">
              <img src="https://buyawarranty.co.uk/images/buyawarranty-logo.png" alt="buyawarranty.co.uk" style="max-width: 240px; height: auto; display: inline-block;" />
            </div>

            <!-- Hero Card -->
            <div class="baw-card" style="background-color: #ffffff; border-radius: 8px; padding: 35px 30px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
              <div style="text-align: center; margin: -10px 0 18px 0;">
                <img src="https://buyawarranty.co.uk/images/welcome-panda-claim.jpg" alt="Buy a Warranty - your protection is active" width="520" style="width: 100%; max-width: 520px; height: auto; display: block; margin: 0 auto; border: 0; outline: none; text-decoration: none;" />
              </div>
              <h1 class="baw-h1" style="color: #1d3a8a; font-size: 24px; font-weight: 700; margin: 0 0 8px 0; line-height: 1.3;">Your Buy a Warranty protection is now active</h1>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 16px 0 0 0;">Hi <strong>${finalCustomerName}</strong>,</p>
              <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 12px 0 0 0;">Congratulations and thank you for choosing Buy a Warranty. Your protection plan is now active and your policy documents are attached to this email for your records.</p>

              <div style="margin-top: 24px; padding: 16px 20px; background-color: #f9fafb; border-left: 4px solid #eb6b1f; border-radius: 4px;">
                <p style="margin: 0; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Policy Number</p>
                <p style="margin: 4px 0 0 0; color: #1d3a8a; font-size: 20px; font-weight: 700;">${policyNumber}</p>
              </div>
            </div>

            ${seasonalBonusMonths > 0 ? `
            <!-- Seasonal Bonus -->
            <div class="baw-card-sm" style="background-color: #ffffff; border-radius: 8px; padding: 20px 30px; margin-bottom: 16px; border: 1px solid #e5e7eb; border-top: 3px solid #eb6b1f;">
              <p class="baw-h2" style="margin: 0; color: #1d3a8a; font-size: 16px; font-weight: 700;">Bonus coverage included</p>
              <p style="margin: 6px 0 0 0; color: #4b5563; font-size: 15px; line-height: 1.5;">You've received an extra <strong>${seasonalBonusMonths} months</strong> of coverage at no additional cost. Your protection now runs until <strong>${formatDate(endDate)}</strong>.</p>
            </div>
            ` : ''}

            <!-- Policy Summary -->
            <div class="baw-card" style="background-color: #ffffff; border-radius: 8px; padding: 30px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
              <h2 class="baw-h2" style="color: #1d3a8a; font-size: 18px; font-weight: 700; margin: 0 0 20px 0;">Your policy summary</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6; width: 45%;">Vehicle Registration</td>
                  <td style="padding: 12px 0; color: #1f2937; font-size: 14px; border-bottom: 1px solid #f3f4f6; font-weight: 600; text-align: right;"><span style="${regPlateStyle}">${regPlate}</span></td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Plan Type</td>
                  <td style="padding: 12px 0; color: #1f2937; font-size: 14px; border-bottom: 1px solid #f3f4f6; font-weight: 600; text-align: right;">${planType}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Coverage Period</td>
                  <td style="padding: 12px 0; color: #1f2937; font-size: 14px; border-bottom: 1px solid #f3f4f6; font-weight: 600; text-align: right;">${totalCoverageMonths} months</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Start Date</td>
                  <td style="padding: 12px 0; color: #1f2937; font-size: 14px; border-bottom: 1px solid #f3f4f6; font-weight: 600; text-align: right;">${formatDate(startDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; color: #6b7280; font-size: 14px; border-bottom: 1px solid #f3f4f6;">Policy End Date</td>
                  <td style="padding: 12px 0; color: #1f2937; font-size: 14px; border-bottom: 1px solid #f3f4f6; font-weight: 600; text-align: right;">${formatDate(endDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; color: #6b7280; font-size: 14px;">Payment Method</td>
                  <td style="padding: 12px 0; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">Stripe</td>
                </tr>
              </table>
            </div>

            <!-- Customer Portal -->
            <div class="baw-card" style="background-color: #ffffff; border-radius: 8px; padding: 30px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
              <h2 class="baw-h2" style="color: #1d3a8a; font-size: 18px; font-weight: 700; margin: 0 0 12px 0;">Access your customer portal</h2>
              <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 8px 0;">Log in to your customer portal to:</p>
              <ul style="color: #4b5563; font-size: 15px; line-height: 1.8; margin: 0 0 20px 0; padding-left: 20px;">
                <li>View your policy documents</li>
                <li>Check your coverage details</li>
                <li>Manage your account information</li>
                <li>Access support when needed</li>
              </ul>

              <div style="text-align: center; margin: 24px 0;">
                <a href="https://buyawarranty.co.uk/auth" class="baw-cta" style="display: inline-block; background-color: #eb6b1f; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-size: 16px; font-weight: 700;">Log in to your portal</a>
              </div>

              <table style="width: 100%; border-collapse: collapse; margin-top: 16px; background-color: #f9fafb; border-radius: 6px;">
                <tr>
                  <td style="padding: 14px 18px; color: #6b7280; font-size: 14px; width: 45%;">Portal Email</td>
                  <td style="padding: 14px 18px; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right;">${email}</td>
                </tr>
                ${userHasResetPassword ? `
                <tr>
                  <td colspan="2" style="padding: 0 18px 14px; color: #6b7280; font-size: 13px; font-style: italic; border-top: 1px solid #f3f4f6;">You have already set your dashboard password. Use your existing password to log in, or reset it from the login page if needed.</td>
                </tr>
                ` : `
                <tr>
                  <td style="padding: 14px 18px; color: #6b7280; font-size: 14px; border-top: 1px solid #f3f4f6;">Temporary Password</td>
                  <td style="padding: 14px 18px; color: #1f2937; font-size: 14px; font-weight: 600; text-align: right; border-top: 1px solid #f3f4f6;"><code style="background-color: #ffffff; padding: 4px 10px; border-radius: 4px; font-family: 'Courier New', monospace; color: #1f2937; border: 1px solid #d1d5db;">${tempPassword}</code></td>
                </tr>
                <tr>
                  <td colspan="2" style="padding: 0 18px 14px; color: #6b7280; font-size: 13px; font-style: italic;">For security, we recommend changing your password after your first login.</td>
                </tr>
                `}
              </table>
            </div>

            <!-- Documents Include -->
            <div class="baw-card" style="background-color: #ffffff; border-radius: 8px; padding: 30px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
              <h2 class="baw-h2" style="color: #1d3a8a; font-size: 18px; font-weight: 700; margin: 0 0 16px 0;">Your documents include</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #4b5563; font-size: 15px; line-height: 1.6;"><span style="color: #eb6b1f; font-weight: 700; margin-right: 8px;">✓</span>Warranty terms and conditions</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #4b5563; font-size: 15px; line-height: 1.6;"><span style="color: #eb6b1f; font-weight: 700; margin-right: 8px;">✓</span>Coverage information and limitations</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #4b5563; font-size: 15px; line-height: 1.6;"><span style="color: #eb6b1f; font-weight: 700; margin-right: 8px;">✓</span>Claims contact details</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #4b5563; font-size: 15px; line-height: 1.6;"><span style="color: #eb6b1f; font-weight: 700; margin-right: 8px;">✓</span>Important policy information</td>
                </tr>
              </table>
            </div>

            <!-- Need help -->
            <div class="baw-card" style="background-color: #ffffff; border-radius: 8px; padding: 30px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
              <h2 class="baw-h2" style="color: #1d3a8a; font-size: 18px; font-weight: 700; margin: 0 0 8px 0;">Need help?</h2>
              <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">If you have any questions, our team is here to help.</p>

              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td class="baw-contact-cell" style="width: 50%; padding: 16px; background-color: #f9fafb; border-radius: 6px; vertical-align: top;">
                    <p style="margin: 0 0 8px 0; color: #1d3a8a; font-size: 14px; font-weight: 700;">Customer Support</p>
                    <p style="margin: 0 0 4px 0; color: #1f2937; font-size: 14px;"><a href="tel:03302295040" style="color: #1f2937; text-decoration: none;">0330 229 5040</a></p>
                    <p style="margin: 0; color: #1f2937; font-size: 14px;"><a href="mailto:support@buyawarranty.co.uk" style="color: #1f2937; text-decoration: none;">support@buyawarranty.co.uk</a></p>
                  </td>
                  <td style="width: 8px;"></td>
                  <td class="baw-contact-cell" style="width: 50%; padding: 16px; background-color: #f9fafb; border-radius: 6px; vertical-align: top;">
                    <p style="margin: 0 0 8px 0; color: #1d3a8a; font-size: 14px; font-weight: 700;">Claims Team</p>
                    <p style="margin: 0 0 4px 0; color: #1f2937; font-size: 14px;"><a href="tel:03302295045" style="color: #1f2937; text-decoration: none;">0330 229 5045</a></p>
                    <p style="margin: 0; color: #1f2937; font-size: 14px;"><a href="mailto:claims@buyawarranty.co.uk" style="color: #1f2937; text-decoration: none;">claims@buyawarranty.co.uk</a></p>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Closing -->
            <div class="baw-card" style="background-color: #ffffff; border-radius: 8px; padding: 30px; margin-bottom: 16px; border: 1px solid #e5e7eb;">
              <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">Thank you again for choosing Buy a Warranty. We are delighted to have you covered.</p>
              <p style="color: #1f2937; font-size: 15px; line-height: 1.6; margin: 0;">Kind regards,<br><strong>The Buy a Warranty Team</strong></p>
            </div>

            <!-- Footer -->
            <div style="text-align: center; padding: 20px 10px;">
              <p style="margin: 0; color: #6b7280; font-size: 13px;"><a href="https://buyawarranty.co.uk" style="color: #1d3a8a; text-decoration: none; font-weight: 600;">buyawarranty.co.uk</a></p>
              <p style="margin: 8px 0 0 0; color: #9ca3af; font-size: 12px;">Vehicle protection you can trust</p>
            </div>

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

      // Schedule "How to make a claim" follow-up email 90 minutes after welcome
      if (feedbackTemplate && !templateError) {
        try {
          const claimInfoSendAt = new Date(Date.now() + 90 * 60 * 1000);
          const { error: claimScheduleError } = await supabaseClient
            .from('scheduled_emails')
            .insert({
              template_id: feedbackTemplate.id, // FK stub; routing uses metadata.emailType
              customer_id: userId,
              recipient_email: email,
              scheduled_for: claimInfoSendAt.toISOString(),
              metadata: {
                emailType: 'claim_info',
                customerFirstName: finalCustomerName,
                policyNumber,
              }
            });
          if (claimScheduleError) {
            logStep('Failed to schedule claim info email', { error: claimScheduleError });
          } else {
            logStep('Claim info email scheduled', { scheduledFor: claimInfoSendAt.toISOString() });
          }
        } catch (e) {
          logStep('Error scheduling claim info email', e);
        }
      }

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
      policyId: policyData?.id,
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

// Helper function to calculate policy end date - uses provided start date or defaults to now
function calculatePolicyEndDate(paymentType: string, startDate?: Date | string): string {
  const start = startDate ? new Date(startDate) : new Date();
  const months = getWarrantyDurationInMonths(paymentType);
  const endDate = new Date(start);
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