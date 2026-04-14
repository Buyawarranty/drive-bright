import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

// Utility functions for retrying fetch requests
const timedFetch = (url: string, options: RequestInit, timeout = 30000): Promise<Response> => {
  return Promise.race([
    fetch(url, options),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    ),
  ]);
};

const retryFetch = async (
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await timedFetch(url, options);
      
      if (response.status >= 200 && response.status < 500) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      
      if (attempt < maxRetries - 1) {
        const backoffTime = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const backoffTime = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  cartId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  vehicleReg?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  vehicleType?: string;
  mileage?: string;
  fuelType?: string;
  transmission?: string;
  triggerType: 'pricing_page_view' | 'plan_selected' | 'pricing_page_view_24h' | 'pricing_page_view_72h' | 'checkout_abandoned';
  planName?: string;
  paymentType?: string;
  // Step 3 pricing selections for restoration
  voluntaryExcess?: number;
  claimLimit?: number;
  labourRate?: number;
  boostAddon?: boolean;
  protectionAddons?: {
    breakdown?: boolean;
    motFee?: boolean;
    motRepair?: boolean;
    wearTear?: boolean;
    tyre?: boolean;
    european?: boolean;
    rental?: boolean;
    transfer?: boolean;
    lostKey?: boolean;
    consequential?: boolean;
  };
}

const generateEmailHTML = (request: SendEmailRequest, continueUrl: string): { html: string, subject: string } => {
  // Use first name if available and it's not an email address, otherwise use a friendly greeting
  const isEmailAddress = (str: string) => str && str.includes('@');
  const firstName = request.firstName && request.firstName.trim() && !isEmailAddress(request.firstName.trim()) 
    ? request.firstName.trim() 
    : 'there';
  const vehicleInfo = `${request.vehicleMake || ''} ${request.vehicleModel || ''}`.trim() || 'your vehicle';
  const vehicleReg = request.vehicleReg || '';
  
  let subject = `${vehicleReg} - Your warranty quote from Buy A Warranty`;
  let heading = `Your Warranty Quote for ${vehicleInfo}`;
  let intro = `You requested a warranty quote for your ${vehicleInfo}${vehicleReg ? ` (${vehicleReg})` : ''}.`;
  let body = "We've saved your quote details. You can review and complete your application whenever you're ready.";
  let showPromo = false;
  let promoCode = '';
  let promoText = '';
  let ctaText = 'View My Quote';
  
  if (request.triggerType === 'checkout_abandoned') {
    subject = `${vehicleReg} - Complete your warranty purchase`;
    heading = `You're Almost There!`;
    intro = `You were just a step away from protecting your ${vehicleInfo}${vehicleReg ? ` (${vehicleReg})` : ''}.`;
    body = "Your warranty details are saved and ready. Complete your purchase now to get instant cover.";
    ctaText = 'Complete My Purchase';
    showPromo = true;
    promoCode = 'SAVE50NOW';
    promoText = 'Complete your purchase now and save £50 with code';
  } else if (request.triggerType === 'pricing_page_view_24h') {
    showPromo = true;
    promoCode = 'SAVE50NOW';
    promoText = 'Special offer: Save £50 with code';
  } else if (request.triggerType === 'pricing_page_view_72h') {
    showPromo = true;
    promoCode = 'SAVE50NOW';
    promoText = 'Limited time: Save £50 with code';
    intro = `This is a reminder about your warranty quote for ${vehicleReg}.`;
    body = "Your quote information is still available to review.";
  }
  
  const html = `
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
      <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 700; line-height: 1.3; margin: 16px 0;">${heading}</h1>
      
      <p style="color: #484848; font-size: 16px; line-height: 24px; margin: 16px 0;">Hi ${firstName},</p>
      
      <p style="color: #484848; font-size: 16px; line-height: 24px; margin: 16px 0;">${intro}</p>
      
      <p style="color: #484848; font-size: 16px; line-height: 24px; margin: 16px 0;">${body}</p>

      ${showPromo ? `
      <!-- Promo Section -->
      <div style="background-color: #FFF8E7; border: 2px solid #FF7A00; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
        <p style="color: #1A1A1A; font-size: 16px; font-weight: 600; margin: 0 0 12px 0;">${promoText}</p>
        <a href="https://buyawarranty.co.uk?promo=${promoCode}" style="background-color: #1A1A1A; color: #fff; font-size: 24px; font-weight: 800; padding: 12px 24px; border-radius: 6px; display: inline-block; letter-spacing: 2px; font-family: monospace; text-decoration: none; cursor: pointer;">${promoCode}</a>
        <p style="color: #666666; font-size: 12px; margin: 10px 0 0 0;">Tap to copy &bull; <strong>Valid for 24 hours</strong> &bull; Minimum order £350</p>
      </div>
      ` : ''}

      <!-- Benefits -->
      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="color: #1a1a1a; font-size: 18px; font-weight: 600; margin: 0 0 12px 0;">Your Quote Includes:</p>
        <p style="color: #484848; font-size: 15px; line-height: 24px; margin: 4px 0;">• Comprehensive vehicle warranty coverage</p>
        <p style="color: #484848; font-size: 15px; line-height: 24px; margin: 4px 0;">• UK-based customer support</p>
        <p style="color: #484848; font-size: 15px; line-height: 24px; margin: 4px 0;">• Easy claims, Fast payouts</p>
        <p style="color: #484848; font-size: 15px; line-height: 24px; margin: 4px 0;">• 14-day money back guarantee</p>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${continueUrl}" style="background-color: #FF7A00; border-radius: 6px; color: #fff; font-size: 18px; font-weight: bold; text-decoration: none; padding: 16px 32px; display: inline-block;">
          ${ctaText}
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #e6ebf1; margin: 32px 0;" />

      <!-- Footer -->
      <p style="color: #8898aa; font-size: 14px; line-height: 20px; margin: 16px 0;">
        If you have any questions about your quote, please don't hesitate to contact us.
      </p>

      <p style="color: #8898aa; font-size: 14px; line-height: 20px; margin: 16px 0;">
        Best regards,
      </p>
      <p style="color: #8898aa; font-size: 14px; line-height: 20px; margin: 8px 0;">
        The Buy A Warranty Team
      </p>
      <p style="color: #8898aa; font-size: 14px; line-height: 20px; margin: 8px 0;">
        <a href="https://buyawarranty.co.uk" style="color: #0066cc; text-decoration: underline;">buyawarranty.co.uk</a>
      </p>

      <p style="color: #8898aa; font-size: 13px; line-height: 20px; margin: 8px 0;">
        📧 support@buyawarranty.co.uk
      </p>
      <p style="color: #8898aa; font-size: 13px; line-height: 20px; margin: 8px 0 24px 0;">
        📞 0330 229 5040
      </p>

      <div style="border-top: 1px solid #e6ebf1; padding-top: 16px; margin-top: 16px; text-align: center;">
        <p style="color: #aab7c4; font-size: 11px; line-height: 16px; margin: 0;">
          You're receiving this email because you requested a warranty quote from Buy A Warranty.<br>
          <a href="${Deno.env.get('SUPABASE_URL')}/functions/v1/handle-email-unsubscribe?email=${encodeURIComponent(request.email)}&token=${btoa(request.email.trim().toLowerCase() + '_baw_unsub_2024')}" style="color: #aab7c4; text-decoration: underline;">Unsubscribe</a> from future emails.
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
  
  return { html, subject };
};

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

    const emailRequest: SendEmailRequest = await req.json();
    console.log('Sending abandoned cart email:', emailRequest);

    // Check if we've already sent this type of email for this specific cart
    const { data: recentEmails, error: checkError } = await supabase
      .from('triggered_emails_log')
      .select('*')
      .eq('cart_id', emailRequest.cartId)
      .eq('trigger_type', emailRequest.triggerType)
      .limit(1);

    if (checkError) {
      console.error('Error checking recent emails:', checkError);
    }

    if (recentEmails && recentEmails.length > 0) {
      console.log(`Skipping email - already sent ${emailRequest.triggerType} email for cart ${emailRequest.cartId}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Email already sent for this cart" 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get the email template
    const { data: template, error: templateError } = await supabase
      .from('abandoned_cart_email_templates')
      .select('*')
      .eq('trigger_type', emailRequest.triggerType)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      console.error('Error fetching email template:', templateError);
      throw new Error('Email template not found');
    }

    // Generate URLs
    const baseUrl = 'https://buyawarranty.co.uk';
    let continueUrl = baseUrl;

    if (emailRequest.vehicleReg) {
      // Determine target step based on trigger type
      // Step 2 emails go to step 2, Step 3 emails go to step 3, checkout abandoned goes to step 4
      let targetStep = 2;
      if (emailRequest.triggerType === 'plan_selected' || emailRequest.triggerType === 'pricing_page_view_24h' || emailRequest.triggerType === 'pricing_page_view_72h') {
        targetStep = 3;
      } else if (emailRequest.triggerType === 'checkout_abandoned') {
        targetStep = 4;
      }
      
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
        step: targetStep,
        planName: emailRequest.planName,
        paymentType: emailRequest.paymentType,
        mileage: emailRequest.mileage || '0',
        address: '',
        // Step 3 pricing selections for restoration
        voluntaryExcess: emailRequest.voluntaryExcess,
        claimLimit: emailRequest.claimLimit,
        labourRate: emailRequest.labourRate,
        boostAddon: emailRequest.boostAddon,
        protectionAddons: emailRequest.protectionAddons
      }));
      continueUrl = `${baseUrl}?restore=${encodeURIComponent(stateParam)}`;
    }

    // Generate email HTML
    const { html: htmlContent, subject } = generateEmailHTML(emailRequest, continueUrl);

    // Send email using Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not set");
    }

    const emailPayload = {
      from: "Buyawarranty Customer Care <info@buyawarranty.co.uk>",
      to: [emailRequest.email],
      subject: subject,
      html: htmlContent,
    };

    console.log("Sending email via Resend...");
    
    const emailResponse = await retryFetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify(emailPayload),
      }
    );

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Resend API error: ${emailResponse.status} - ${errorText}`);
    }

    const emailResult = await emailResponse.json();
    console.log("Email sent successfully:", emailResult);

    // Log the sent email
    const { error: logError } = await supabase
      .from('triggered_emails_log')
      .insert([{
        cart_id: emailRequest.cartId,
        email: emailRequest.email,
        trigger_type: emailRequest.triggerType,
        template_id: template.id,
        vehicle_reg: emailRequest.vehicleReg,
        email_status: 'sent'
      }]);

    if (logError) {
      console.error('Error logging email:', logError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Abandoned cart email sent successfully",
      emailId: emailResult.id
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in send-abandoned-cart-email function:", error);
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
