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
  triggerType:
    | 'pricing_page_view'
    | 'plan_selected'
    | 'pricing_page_view_24h'
    | 'pricing_page_view_72h'
    | 'checkout_abandoned'
    | 'reminder_1h'
    | 'reminder_2d'
    | 'reminder_7d'
    | 'reminder_14d'
    | 'reminder_18d'
    | 'reminder_21d';
  planName?: string;
  paymentType?: string;
  stepAbandoned?: number;
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
  
  const stepAbandoned = request.stepAbandoned ?? 3;
  const isCheckoutStep = stepAbandoned >= 4;

  // Per-trigger copy (6-step Confused-style cadence + legacy fallbacks)
  switch (request.triggerType) {
    case 'reminder_1h':
      subject = `${vehicleReg} – your warranty quote is saved`;
      heading = isCheckoutStep ? `You're one step from cover` : `Your Warranty Quote for ${vehicleInfo}`;
      intro = `Thanks for getting a quote for your ${vehicleInfo}${vehicleReg ? ` (${vehicleReg})` : ''}.`;
      body = isCheckoutStep
        ? "Your warranty is ready at checkout. Pick up exactly where you left off — it only takes a minute."
        : "We've saved your quote so you can pick up exactly where you left off whenever you're ready.";
      ctaText = isCheckoutStep ? 'Complete My Purchase' : 'View My Quote';
      break;
    case 'reminder_2d':
      subject = `${vehicleReg} – still thinking? Here's £25 off`;
      heading = `Still thinking it over?`;
      intro = `Your warranty quote for ${vehicleInfo}${vehicleReg ? ` (${vehicleReg})` : ''} is still saved.`;
      body = "To help you decide, here's £25 off when you complete your purchase.";
      ctaText = isCheckoutStep ? 'Complete My Purchase' : 'View My Quote';
      showPromo = true;
      promoCode = 'SAVE25GO';
      promoText = 'Save £25 with code';
      break;
    case 'reminder_7d':
      subject = `${vehicleReg} – don't lose your saved quote`;
      heading = `Your quote is still here`;
      intro = `It's been a week since you looked at warranty cover for your ${vehicleInfo}${vehicleReg ? ` (${vehicleReg})` : ''}.`;
      body = "Your quote and £25 discount are both still valid. Tap below to carry on where you left off.";
      ctaText = isCheckoutStep ? 'Complete My Purchase' : 'View My Quote';
      showPromo = true;
      promoCode = 'SAVE25GO';
      promoText = 'Save £25 with code';
      break;
    case 'reminder_14d':
      subject = `${vehicleReg} – prices may change, your £25 off won't`;
      heading = `Lock in your warranty price`;
      intro = `Repair costs keep rising, but your saved quote for ${vehicleInfo}${vehicleReg ? ` (${vehicleReg})` : ''} is held at today's price.`;
      body = "Secure your cover now and save £25 — your quote may not be available much longer.";
      ctaText = isCheckoutStep ? 'Complete My Purchase' : 'View My Quote';
      showPromo = true;
      promoCode = 'SAVE25GO';
      promoText = 'Save £25 with code';
      break;
    case 'reminder_18d':
      subject = `${vehicleReg} – your £25 discount is about to expire`;
      heading = `Almost gone`;
      intro = `Your saved quote and £25 voucher for ${vehicleInfo}${vehicleReg ? ` (${vehicleReg})` : ''} expire in a few days.`;
      body = "Don't miss out — pick up exactly where you left off and apply your discount automatically.";
      ctaText = isCheckoutStep ? 'Complete My Purchase' : 'View My Quote';
      showPromo = true;
      promoCode = 'SAVE25GO';
      promoText = 'Save £25 with code';
      break;
    case 'reminder_21d':
      subject = `${vehicleReg} – last chance, your quote expires tonight`;
      heading = `Last chance`;
      intro = `Final reminder for your saved warranty quote on ${vehicleInfo}${vehicleReg ? ` (${vehicleReg})` : ''}.`;
      body = "Your £25 discount and your saved quote both expire tonight. Tap below to finish in under a minute.";
      ctaText = isCheckoutStep ? 'Complete My Purchase' : 'View My Quote';
      showPromo = true;
      promoCode = 'SAVE25GO';
      promoText = 'Last chance: Save £25 with code';
      break;
    // Legacy fallbacks (kept for completeness)
    case 'checkout_abandoned':
      subject = `${vehicleReg} - Complete your warranty purchase`;
      heading = `You're Almost There!`;
      intro = `You were just a step away from protecting your ${vehicleInfo}${vehicleReg ? ` (${vehicleReg})` : ''}.`;
      body = "Your warranty details are saved and ready. Complete your purchase now to get instant cover.";
      ctaText = 'Complete My Purchase';
      showPromo = true;
      promoCode = 'SAVE25GO';
      promoText = 'Complete your purchase now and save £25 with code';
      break;
    case 'pricing_page_view_24h':
      showPromo = true;
      promoCode = 'SAVE25GO';
      promoText = 'Special offer: Save £25 with code';
      break;
    case 'pricing_page_view_72h':
      showPromo = true;
      promoCode = 'SAVE25GO';
      promoText = 'Last chance: your £25 discount expires tonight — use code';
      intro = `Quick reminder about your warranty quote for ${vehicleReg}.`;
      body = "Your saved quote is still here, but your £25 discount expires tonight. Tap below to pick up exactly where you left off.";
      break;
  }
  
  // Build a promo link that ALSO restores the saved cart so users land back on their selections
  const promoLink = continueUrl.includes('?')
    ? `${continueUrl}&promo=${promoCode}`
    : `${continueUrl}?promo=${promoCode}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* Mobile-first padding adjustments */
    @media only screen and (max-width: 600px) {
      .baw-content { padding: 0 20px !important; }
      .baw-header { padding: 20px 16px !important; }
      .baw-promo-code { font-size: 20px !important; padding: 12px 18px !important; letter-spacing: 1.5px !important; }
      .baw-cta { font-size: 16px !important; padding: 14px 20px !important; display: block !important; }
      .baw-h1 { font-size: 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; background-color: #f6f9fc;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <div class="baw-header" style="padding: 24px; text-align: center;">
      <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" width="180" alt="Buy A Warranty" style="margin: 0 auto; max-width: 100%; height: auto;" />
    </div>

    <!-- Content -->
    <div class="baw-content" style="padding: 0 32px;">
      <h1 class="baw-h1" style="color: #1a1a1a; font-size: 24px; font-weight: 700; line-height: 1.3; margin: 8px 0 16px;">${heading}</h1>

      <p style="color: #484848; font-size: 16px; line-height: 1.55; margin: 12px 0;">Hi ${firstName},</p>
      <p style="color: #484848; font-size: 16px; line-height: 1.55; margin: 12px 0;">${intro}</p>
      <p style="color: #484848; font-size: 16px; line-height: 1.55; margin: 12px 0;">${body}</p>

      ${showPromo ? `
      <!-- Promo Section -->
      <div style="background-color: #FFF8E7; border: 2px solid #FF7A00; border-radius: 10px; padding: 22px 18px; margin: 24px 0; text-align: center;">
        <p style="color: #1A1A1A; font-size: 15px; font-weight: 600; margin: 0 0 14px 0; line-height: 1.4;">${promoText}</p>
        <a href="${promoLink}" class="baw-promo-code" style="background-color: #1A1A1A; color: #fff; font-size: 24px; font-weight: 800; padding: 14px 26px; border-radius: 6px; display: inline-block; letter-spacing: 2px; font-family: 'Courier New', monospace; text-decoration: none; user-select: all; -webkit-user-select: all;">${promoCode}</a>
        <p style="color: #666666; font-size: 12px; margin: 12px 0 0 0;">Tap the code to apply it automatically &bull; <strong>Valid for 24 hours</strong></p>
      </div>
      ` : ''}

      <!-- CTA Button -->
      <div style="text-align: center; margin: 28px 0;">
        <a href="${continueUrl}" class="baw-cta" style="background-color: #FF7A00; border-radius: 6px; color: #fff; font-size: 18px; font-weight: bold; text-decoration: none; padding: 16px 32px; display: inline-block;">
          ${ctaText}
        </a>
        <p style="color: #888; font-size: 12px; margin: 10px 0 0 0;">We'll take you straight back to your saved selection.</p>
      </div>

      <!-- Benefits -->
      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 18px 20px; margin: 24px 0;">
        <p style="color: #1a1a1a; font-size: 17px; font-weight: 600; margin: 0 0 10px 0;">Your Quote Includes:</p>
        <p style="color: #484848; font-size: 15px; line-height: 1.6; margin: 4px 0;">• Comprehensive vehicle warranty coverage</p>
        <p style="color: #484848; font-size: 15px; line-height: 1.6; margin: 4px 0;">• UK-based customer support</p>
        <p style="color: #484848; font-size: 15px; line-height: 1.6; margin: 4px 0;">• Easy claims, fast payouts</p>
        <p style="color: #484848; font-size: 15px; line-height: 1.6; margin: 4px 0;">• 14-day cooling off period</p>
      </div>

      <hr style="border: none; border-top: 1px solid #e6ebf1; margin: 28px 0;" />

      <!-- Footer -->
      <p style="color: #8898aa; font-size: 14px; line-height: 1.5; margin: 12px 0;">
        If you have any questions about your quote, please don't hesitate to contact us.
      </p>
      <p style="color: #8898aa; font-size: 14px; line-height: 1.5; margin: 12px 0 4px;">Best regards,</p>
      <p style="color: #8898aa; font-size: 14px; line-height: 1.5; margin: 0 0 12px;">The Buy A Warranty Team</p>
      <p style="color: #8898aa; font-size: 14px; line-height: 1.5; margin: 4px 0;">
        <a href="https://buyawarranty.co.uk" style="color: #0066cc; text-decoration: underline;">buyawarranty.co.uk</a>
      </p>
      <p style="color: #8898aa; font-size: 13px; line-height: 1.5; margin: 4px 0;">📧 support@buyawarranty.co.uk</p>
      <p style="color: #8898aa; font-size: 13px; line-height: 1.5; margin: 4px 0 24px 0;">📞 0330 229 5040</p>

      <div style="border-top: 1px solid #e6ebf1; padding-top: 16px; margin-top: 16px; text-align: center;">
        <p style="color: #aab7c4; font-size: 11px; line-height: 1.5; margin: 0;">
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

    // Hard stop: never email an unsubscribed recipient
    const normalizedEmail = (emailRequest.email || '').trim().toLowerCase();
    const { data: unsub } = await supabase
      .from('email_unsubscribes')
      .select('email')
      .eq('email', normalizedEmail)
      .limit(1);
    if (unsub && unsub.length > 0) {
      console.log(`Skipping email - recipient ${normalizedEmail} is unsubscribed`);
      return new Response(JSON.stringify({ success: true, message: "Recipient is unsubscribed" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }


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
      // Resume at the step the customer abandoned: step 3 → plans, step 4+ → checkout (Stripe)
      const targetStep = (emailRequest.stepAbandoned && emailRequest.stepAbandoned >= 4) ? 4 : 3;

      
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
