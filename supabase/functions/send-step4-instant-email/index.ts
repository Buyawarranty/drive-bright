import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Step4EmailRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  vehicleReg: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  vehicleType?: string;
  mileage?: string;
  fuelType?: string;
  transmission?: string;
  planName: string;
  paymentType: string;
  totalPrice?: number;
  monthlyPrice?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const emailRequest: Step4EmailRequest = await req.json();
    console.log('📧 Step 4 instant email request:', emailRequest);

    // Validate required fields
    if (!emailRequest.email || !emailRequest.vehicleReg) {
      console.log('⏭️ Skipping - missing email or vehicle reg');
      return new Response(JSON.stringify({ 
        success: false, 
        message: "Missing required fields" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check if customer has already made a purchase
    const { data: existingCustomer, error: customerError } = await supabase
      .from('customers')
      .select('id, email, registration_plate')
      .eq('email', emailRequest.email)
      .limit(1);

    if (customerError) {
      console.error('Error checking existing customer:', customerError);
    }

    // If customer exists (has purchased), don't send the email
    if (existingCustomer && existingCustomer.length > 0) {
      console.log(`⏭️ Customer ${emailRequest.email} has already purchased - skipping email`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Customer has already purchased" 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check how many step 4 emails we've already sent to this user for this vehicle
    const { data: allEmails, error: checkError } = await supabase
      .from('triggered_emails_log')
      .select('*')
      .eq('email', emailRequest.email)
      .eq('vehicle_reg', emailRequest.vehicleReg)
      .eq('trigger_type', 'step4_instant')
      .order('created_at', { ascending: false });

    if (checkError) {
      console.error('Error checking recent emails:', checkError);
    }

    const emailCount = allEmails?.length || 0;
    const mostRecentEmail = allEmails?.[0];
    
    // Determine timing rules based on email count:
    // - 0 emails sent: send immediately (first visit to step 4)
    // - 1 email sent: can send again after 3 days
    // - 2 emails sent: can send again after 7 days (4 more days after the 3-day email)
    // - 3+ emails sent: no more emails
    
    if (emailCount >= 3) {
      console.log(`⏭️ Already sent 3 step 4 emails to ${emailRequest.email} - no more emails`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Maximum emails reached" 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    
    if (mostRecentEmail) {
      const lastEmailDate = new Date(mostRecentEmail.created_at);
      const now = new Date();
      const daysSinceLastEmail = (now.getTime() - lastEmailDate.getTime()) / (1000 * 60 * 60 * 24);
      
      // After first email, wait 3 days; after second email, wait 4 more days (7 days total from first)
      const requiredDays = emailCount === 1 ? 3 : 4;
      
      if (daysSinceLastEmail < requiredDays) {
        console.log(`⏭️ Only ${daysSinceLastEmail.toFixed(1)} days since last email (need ${requiredDays}) - skipping`);
        return new Response(JSON.stringify({ 
          success: true, 
          message: `Email already sent, waiting ${requiredDays} days between emails` 
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }
    
    // Determine if this is a reminder email (show promo code on 2nd and 3rd emails)
    const isReminderEmail = emailCount > 0;
    
    console.log(`✅ Sending email #${emailCount + 1} to ${emailRequest.email} (isReminder: ${isReminderEmail})`);

    // Build the restore URL that takes them directly back to step 4
    const baseUrl = 'https://buyawarranty.co.uk';
    const stateParam = btoa(JSON.stringify({
      regNumber: emailRequest.vehicleReg,
      email: emailRequest.email,
      firstName: emailRequest.firstName || '',
      lastName: emailRequest.lastName || '',
      phone: emailRequest.phone || '',
      make: emailRequest.vehicleMake || '',
      model: emailRequest.vehicleModel || '',
      year: emailRequest.vehicleYear || '',
      vehicleType: emailRequest.vehicleType || 'car',
      fuelType: emailRequest.fuelType || '',
      transmission: emailRequest.transmission || '',
      mileage: emailRequest.mileage || '0',
      planName: emailRequest.planName,
      paymentType: emailRequest.paymentType,
      step: 4
    }));
    const continueUrl = `${baseUrl}/?step=4&restore=${encodeURIComponent(stateParam)}`;

    // Format pricing for display
    const firstName = emailRequest.firstName && !emailRequest.firstName.includes('@') 
      ? emailRequest.firstName 
      : 'there';
    const vehicleInfo = `${emailRequest.vehicleMake || ''} ${emailRequest.vehicleModel || ''}`.trim() || 'your vehicle';
    const vehicleReg = emailRequest.vehicleReg.toUpperCase();
    
    // Generate promo code section HTML (only for reminder emails)
    const promoCodeSection = isReminderEmail ? `
      <!-- Promo Code Section -->
      <div style="background-color: #FFF8E7; border: 2px solid #FF7A00; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
        <p style="color: #1A1A1A; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">
          Complete your purchase now and save £50!
        </p>
        <p style="color: #1A1A1A; font-size: 14px; margin: 0 0 12px 0;">
          Use this code at checkout – <strong>valid for 24 hours only</strong>:
        </p>
        <a href="https://buyawarranty.co.uk?promo=SAVE50NOW" style="background-color: #1A1A1A; color: #fff; font-size: 24px; font-weight: bold; padding: 12px 24px; border-radius: 4px; display: inline-block; letter-spacing: 2px; text-decoration: none; cursor: pointer;">
          SAVE50NOW
        </a>
        <p style="color: #666666; font-size: 12px; margin: 10px 0 0 0;">Minimum order £350</p>
      </div>
    ` : '';

    // Generate email HTML
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; background-color: #f6f9fc;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; margin-bottom: 64px;">
    <!-- Header -->
    <div style="padding: 24px; text-align: center;">
      <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" width="200" alt="Buy A Warranty" style="margin: 0 auto;" />
    </div>
    
    <!-- Content -->
    <div style="padding: 0 48px;">
      <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 700; line-height: 1.3; margin: 16px 0;">${isReminderEmail ? "Don't Forget Your Warranty!" : "Complete Your Warranty Purchase"}</h1>
      
      <p style="color: #484848; font-size: 16px; line-height: 24px; margin: 16px 0;">Hi ${firstName},</p>
      
      <p style="color: #484848; font-size: 16px; line-height: 24px; margin: 16px 0;">
        ${isReminderEmail 
          ? `We noticed you haven't completed your warranty purchase for your <strong>${vehicleInfo}</strong> (${vehicleReg}). Your quote is still waiting for you!`
          : `You're just a few steps away from protecting your <strong>${vehicleInfo}</strong> (${vehicleReg}) with our ${emailRequest.planName || 'warranty plan'}.`
        }
      </p>
      
      <p style="color: #484848; font-size: 16px; line-height: 24px; margin: 16px 0;">
        ${isReminderEmail
          ? "Complete your purchase today and get instant cover for unexpected repair bills."
          : "Your quote is ready and waiting – complete your purchase now to get instant cover."
        }
      </p>

      ${promoCodeSection}

      <!-- Vehicle Summary -->
      <div style="background-color: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="color: #0369a1; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">Your Selected Plan:</p>
        <p style="color: #1a1a1a; font-size: 18px; font-weight: bold; margin: 0 0 8px 0;">${emailRequest.planName || 'Warranty Plan'}</p>
        <p style="color: #484848; font-size: 14px; margin: 0;">
          Vehicle: ${vehicleInfo} (${vehicleReg})<br/>
          Payment: ${emailRequest.paymentType === 'monthly' ? 'Monthly instalments' : 'Pay in full'}
        </p>
      </div>

      <!-- Benefits -->
      <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="color: #166534; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">
          <img src="https://buyawarranty.co.uk/lovable-uploads/tick.png" width="16" height="16" style="vertical-align: middle; margin-right: 8px;" alt="✓"/>
          What's Included:
        </p>
        <p style="color: #166534; font-size: 15px; line-height: 28px; margin: 4px 0;">
          <img src="https://buyawarranty.co.uk/lovable-uploads/tick.png" width="14" height="14" style="vertical-align: middle; margin-right: 8px;" alt="✓"/>
          Comprehensive mechanical & electrical cover
        </p>
        <p style="color: #166534; font-size: 15px; line-height: 28px; margin: 4px 0;">
          <img src="https://buyawarranty.co.uk/lovable-uploads/tick.png" width="14" height="14" style="vertical-align: middle; margin-right: 8px;" alt="✓"/>
          UK-based customer support
        </p>
        <p style="color: #166534; font-size: 15px; line-height: 28px; margin: 4px 0;">
          <img src="https://buyawarranty.co.uk/lovable-uploads/tick.png" width="14" height="14" style="vertical-align: middle; margin-right: 8px;" alt="✓"/>
          Easy claims, fast payouts
        </p>
        <p style="color: #166534; font-size: 15px; line-height: 28px; margin: 4px 0;">
          <img src="https://buyawarranty.co.uk/lovable-uploads/tick.png" width="14" height="14" style="vertical-align: middle; margin-right: 8px;" alt="✓"/>
          14-day money back guarantee
        </p>
      </div>

      <!-- Trust Signals -->
      <div style="text-align: center; margin: 24px 0;">
        <a href="https://www.trustpilot.com/review/buyawarranty.co.uk" target="_blank" style="text-decoration: none;">
          <img src="https://buyawarranty.co.uk/lovable-uploads/trustpilot-5-star-rating.png" width="150" alt="Trustpilot 5 Stars" style="margin: 0 auto;" />
        </a>
        <p style="color: #666; font-size: 13px; margin: 8px 0 0 0;">Rated Excellent on Trustpilot</p>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${continueUrl}" style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); border-radius: 8px; color: #fff; font-size: 18px; font-weight: bold; text-decoration: none; padding: 18px 40px; display: inline-block; box-shadow: 0 4px 14px rgba(234, 88, 12, 0.4);">
          Complete My Purchase
        </a>
      </div>

      <p style="color: #666; font-size: 13px; text-align: center; margin: 16px 0;">
        <img src="https://buyawarranty.co.uk/lovable-uploads/lock-icon.png" width="12" height="12" style="vertical-align: middle; margin-right: 4px;" alt="🔒"/>
        Secure & Encrypted | No hidden fees | FCA compliant
      </p>

      <hr style="border: none; border-top: 1px solid #e6ebf1; margin: 32px 0;" />

      <!-- Footer -->
      <p style="color: #8898aa; font-size: 14px; line-height: 20px; margin: 16px 0;">
        Questions? We're here to help.
      </p>

      <p style="color: #8898aa; font-size: 14px; line-height: 20px; margin: 8px 0;">
        Best regards,<br/>
        The Buy A Warranty Team
      </p>
      <p style="color: #8898aa; font-size: 14px; line-height: 20px; margin: 8px 0;">
        <a href="https://buyawarranty.co.uk" style="color: #0066cc; text-decoration: underline;">buyawarranty.co.uk</a>
      </p>

      <p style="color: #8898aa; font-size: 13px; line-height: 20px; margin: 8px 0;">
        📧 support@buyawarranty.co.uk
      </p>
      <p style="color: #8898aa; font-size: 13px; line-height: 20px; margin: 8px 0 48px 0;">
        📞 0330 229 5040
      </p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email using Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const subject = `${vehicleReg} - Complete your warranty purchase`;

    console.log("📤 Sending step 4 instant email via Resend...");
    
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Buyawarranty Customer Care <info@buyawarranty.co.uk>",
        to: [emailRequest.email],
        subject: subject,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Resend API error: ${emailResponse.status} - ${errorText}`);
    }

    const emailResult = await emailResponse.json();
    console.log("✅ Step 4 instant email sent successfully:", emailResult);

    // Log the sent email to prevent duplicates
    const { error: logError } = await supabase
      .from('triggered_emails_log')
      .insert([{
        cart_id: null, // No cart ID for instant emails
        email: emailRequest.email,
        trigger_type: 'step4_instant',
        vehicle_reg: emailRequest.vehicleReg,
        email_status: 'sent'
      }]);

    if (logError) {
      console.error('Error logging email:', logError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Step 4 instant email sent successfully",
      emailId: emailResult.id
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("❌ Error in send-step4-instant-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
