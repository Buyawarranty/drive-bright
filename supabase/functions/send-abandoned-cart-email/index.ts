import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { logCustomerEmail } from '../_shared/log-email.ts';
import { hasPurchased } from '../_shared/purchase-guard.ts';
import { buildUnsubscribeFooter } from "../_shared/unsubscribe-footer.ts";
import { EMAIL_RESPONSIVE_STYLE } from "../_shared/email-layout.ts";

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
    | 'reminder_21d'
    // Long-term nurture steps (day 14, day 30, then monthly for six months)
    | 'nurture_14d'
    | 'nurture_30d'
    | 'nurture_60d'
    | 'nurture_90d'
    | 'nurture_120d'
    | 'nurture_150d'
    | 'nurture_180d';
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
  // Registration plate shown as a highlighted chip so the customer instantly recognises their car
  const regTag = vehicleReg
    ? ` (<span style="background-color:#FFF0B3;border-radius:3px;padding:1px 5px;font-weight:600;color:#1a1a1a;">${vehicleReg}</span>)`
    : '';
  const vehicleLine = `${vehicleInfo}${regTag}`;
  
  let subject = `${vehicleReg} - Your warranty quote from Buy A Warranty`;
  let heading = `Your Warranty Quote for ${vehicleInfo}`;
  let intro = `You requested a warranty quote for your ${vehicleLine}.`;
  let body = "We've saved your quote details. You can review and complete your application whenever you're ready.";
  let showPromo = false;
  let promoCode = '';
  let promoText = '';
  let ctaText = 'Continue with my quote';
  
  const stepAbandoned = request.stepAbandoned ?? 3;
  const isCheckoutStep = stepAbandoned >= 4;

  // Per-trigger copy (6-step Confused-style cadence + legacy fallbacks)
  switch (request.triggerType) {
    case 'reminder_1h':
      subject = `${vehicleReg} – your warranty quote is saved`;
      heading = isCheckoutStep ? `You're one step from cover` : `Your Warranty Quote for ${vehicleInfo}`;
      intro = `Thanks for getting a quote for your ${vehicleLine}.`;
      body = isCheckoutStep
        ? "Your warranty is ready at checkout. Pick up exactly where you left off — it only takes a minute."
        : "We've saved your quote so you can pick up exactly where you left off whenever you're ready.";
      ctaText = isCheckoutStep ? 'Complete my purchase' : 'Continue with my quote';
      break;
    case 'reminder_2d':
      subject = `${vehicleReg} – still thinking? Here's £25 off`;
      heading = `Still thinking it over?`;
      intro = `Your warranty quote for ${vehicleLine} is still saved.`;
      body = "To help you decide, here's £25 off — it's applied automatically when you carry on below. Cover starts the moment you're done, with unlimited claims up to your chosen limit and UK-based support if anything goes wrong.";
      ctaText = isCheckoutStep ? 'Complete my purchase' : 'Continue with my quote';
      showPromo = true;
      promoCode = 'SAVE25GO';
      promoText = 'Save £25 with code';
      break;
    case 'reminder_7d':
      subject = `${vehicleReg} – don't lose your saved quote`;
      heading = `Your quote is still here`;
      intro = `A week ago you were looking at warranty cover for your ${vehicleLine} — your quote is still saved, exactly as you left it.`;
      body = "Nothing has changed: same price, same cover, and your £25 discount is still yours. One tap takes you straight back to your saved selection, and cover can start today. The average garage bill for a modern engine or gearbox repair now runs into four figures — this is designed to take care of that for you.";
      ctaText = isCheckoutStep ? 'Complete my purchase' : 'Continue with my quote';
      showPromo = true;
      promoCode = 'SAVE25GO';
      promoText = 'Save £25 with code';
      break;
    case 'reminder_14d':
      subject = `${vehicleReg} – prices may change, your £25 off won't`;
      heading = `Lock in your warranty price`;
      intro = `Repair costs keep rising, but your saved quote for ${vehicleLine} is held at today's price.`;
      body = "Take your cover now and keep both today's price and your £25 discount. Fully protected in a couple of minutes, with a 14-day cooling-off period if you change your mind.";
      ctaText = isCheckoutStep ? 'Complete my purchase' : 'Continue with my quote';
      showPromo = true;
      promoCode = 'SAVE25GO';
      promoText = 'Save £25 with code';
      break;
    case 'reminder_18d':
      subject = `${vehicleReg} – your £25 discount is about to expire`;
      heading = `Almost gone`;
      intro = `Your saved quote and £25 voucher for ${vehicleLine} expire in a few days.`;
      body = "Carry on where you left off and your £25 is applied for you. It takes about a minute, and your cover can start straight away.";
      ctaText = isCheckoutStep ? 'Complete my purchase' : 'Continue with my quote';
      showPromo = true;
      promoCode = 'SAVE25GO';
      promoText = 'Save £25 with code';
      break;
    case 'reminder_21d':
      subject = `${vehicleReg} – last chance, your quote expires tonight`;
      heading = `Last chance`;
      intro = `Final reminder for your saved warranty quote on ${vehicleLine}.`;
      body = "Your saved quote and your £25 discount are both valid until midnight tonight. Tap below and you'll be covered in under a minute — with 14 days to change your mind.";
      ctaText = isCheckoutStep ? 'Complete my purchase' : 'Continue with my quote';
      showPromo = true;
      promoCode = 'SAVE25GO';
      promoText = 'Last chance: Save £25 with code';
      break;
    // ---- Long-term nurture: value-led, low pressure, one email at a time ----
    case 'nurture_14d':
      subject = `${vehicleReg} – your warranty quote is still here`;
      heading = `Still deciding on cover?`;
      intro = `Two weeks ago you looked at warranty cover for your ${vehicleLine}.`;
      body = "Your quote is still saved exactly as you left it, and your £25 discount still applies. Cover includes unlimited claims up to your chosen limit, UK-based support and approved garages nationwide — designed to take care of the bills that catch people out.";
      ctaText = 'See my saved quote';
      showPromo = true;
      promoCode = 'SAVE25GO';
      promoText = 'Save £25 with code';
      break;
    case 'nurture_30d':
      subject = `${vehicleReg} – what a warranty covers (and what it saves)`;
      heading = `What your cover would include`;
      intro = `A month on, your saved quote for ${vehicleLine} is still available.`;
      body = "Engine, gearbox, clutch, electrics, air conditioning and more are all included, with labour paid at your chosen hourly rate. A single gearbox repair now typically costs more than a full year of cover, so it is worth a look while your price is held.";
      ctaText = 'View my cover options';
      showPromo = true;
      promoCode = 'SAVE25GO';
      promoText = 'Save £25 with code';
      break;
    case 'nurture_60d':
      subject = `${vehicleReg} – cover from around 60p a day`;
      heading = `Cover from around 60p a day`;
      intro = `Just checking in about warranty cover for your ${vehicleLine}.`;
      body = "You can spread the cost monthly, choose your claim limit and hourly labour rate, and start cover the same day. Your details are saved, so a quote takes seconds to bring back up.";
      ctaText = 'Get my updated price';
      break;
    case 'nurture_90d':
      subject = `${vehicleReg} – is your car still unprotected?`;
      heading = `Three months on`;
      intro = `Your ${vehicleLine} may be a little older and higher mileage now.`;
      body = "That is usually when unexpected repair bills start to appear. Cover is still available for your vehicle, with a 14-day cooling-off period and support from our UK team whenever you need it.";
      ctaText = 'Check my price';
      break;
    case 'nurture_120d':
      subject = `${vehicleReg} – a fresh warranty price for you`;
      heading = `A fresh price, whenever you want it`;
      intro = `We still have your details for ${vehicleLine} on file.`;
      body = "If you would like an up-to-date price, it takes about a minute. Choose the claim limit and labour rate that suit you, pay monthly or in full, and cover can begin straight away.";
      ctaText = 'See today\u2019s price';
      break;
    case 'nurture_150d':
      subject = `${vehicleReg} – peace of mind for your car`;
      heading = `Peace of mind, whenever you\u2019re ready`;
      intro = `Thanks for considering Buy A Warranty for your ${vehicleLine}.`;
      body = "Thousands of UK drivers use us to keep repair bills predictable, with unlimited claims up to their chosen limit and rated service on Trustpilot. Your saved details mean a new quote is only a tap away.";
      ctaText = 'Get a quote';
      break;
    case 'nurture_180d':
      subject = `${vehicleReg} – last email from us about your quote`;
      heading = `One last note`;
      intro = `This is the last reminder we will send about your saved quote for ${vehicleLine}.`;
      body = "If cover is not right for you at the moment, that is absolutely fine and you will not hear from us about this quote again. If you would still like a price, we are here whenever you need us.";
      ctaText = 'Get my final quote';
      break;
    // Legacy fallbacks (kept for completeness)
    case 'checkout_abandoned':
      subject = `${vehicleReg} - Complete your warranty purchase`;
      heading = `You're Almost There!`;
      intro = `You were just a step away from protecting your ${vehicleLine}.`;
      body = "Your warranty details are saved and ready. Complete your purchase now to get instant cover.";
      ctaText = 'Complete my purchase';
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
  const promoLink = showPromo
    ? (continueUrl.includes('?') ? `${continueUrl}&promo=${promoCode}` : `${continueUrl}?promo=${promoCode}`)
    : continueUrl;
  // The main CTA must carry the promo too — most people tap the button, not the code chip.
  const ctaLink = promoLink;



  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    /* Mobile-first padding adjustments */
    @media only screen and (max-width: 620px) {
      .baw-content { padding: 0 20px !important; }
      .baw-header { padding: 20px 16px !important; }
      .baw-promo-code { font-size: 20px !important; padding: 12px 18px !important; letter-spacing: 1.5px !important; }
      .baw-cta { font-size: 16px !important; padding: 14px 20px !important; display: block !important; }
      .baw-h1 { font-size: 20px !important; }
    }
  </style>
  ${EMAIL_RESPONSIVE_STYLE}
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; background-color: #f6f9fc;">
  <div class="baw-wrap" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
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
        <a href="${ctaLink}" class="baw-cta" style="background-color: #FF7A00; border-radius: 6px; color: #fff; font-size: 18px; font-weight: bold; text-decoration: none; padding: 16px 32px; display: inline-block;">
          ${ctaText}
        </a>
        <p style="color: #888; font-size: 12px; margin: 10px 0 0 0;">We'll take you straight back to your saved selection.</p>
      </div>

      <!-- Benefits -->
      <div style="background-color: #f8f9fa; border-radius: 10px; padding: 20px; margin: 24px 0;">
        <p style="color: #1a1a1a; font-size: 17px; font-weight: 700; margin: 0 0 14px 0;">Your quote includes</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          <tr>
            <td width="25%" align="center" style="padding: 6px 8px; border-right: 1px solid #e6ebf1;">
              <div style="font-size: 22px; line-height: 1; color: #0A2A66;">&#128737;</div>
              <div style="color: #484848; font-size: 13px; line-height: 1.4; padding-top: 8px;">Comprehensive mechanical &amp; electrical cover</div>
            </td>
            <td width="25%" align="center" style="padding: 6px 8px; border-right: 1px solid #e6ebf1;">
              <div style="font-size: 22px; line-height: 1; color: #0A2A66;">&#127911;</div>
              <div style="color: #484848; font-size: 13px; line-height: 1.4; padding-top: 8px;">UK-based team, real people</div>
            </td>
            <td width="25%" align="center" style="padding: 6px 8px; border-right: 1px solid #e6ebf1;">
              <div style="font-size: 22px; line-height: 1; color: #0A2A66;">&#128203;</div>
              <div style="color: #484848; font-size: 13px; line-height: 1.4; padding-top: 8px;">Easy claims, fast payouts to your garage</div>
            </td>
            <td width="25%" align="center" style="padding: 6px 8px;">
              <div style="font-size: 22px; line-height: 1; color: #0A2A66;">&#128197;</div>
              <div style="color: #484848; font-size: 13px; line-height: 1.4; padding-top: 8px;">14-day cooling-off period</div>
            </td>
          </tr>
        </table>
      </div>

      <hr style="border: none; border-top: 1px solid #e6ebf1; margin: 28px 0;" />

      <!-- Footer -->
      <p style="color: #8898aa; font-size: 14px; line-height: 1.5; margin: 12px 0;">
        Any questions about your quote? Our UK team is happy to talk it through — no pressure, no jargon.
      </p>
      <p style="color: #8898aa; font-size: 14px; line-height: 1.5; margin: 12px 0 4px;">Best regards,</p>
      <p style="color: #8898aa; font-size: 14px; line-height: 1.5; margin: 0 0 12px;">The Buy A Warranty Team</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 8px 0 24px;">
        <tr>
          <td align="center" style="padding: 6px; border-right: 1px solid #e6ebf1; font-size: 13px;">
            <a href="https://buyawarranty.co.uk" style="color: #0066cc; text-decoration: none;">&#127760;&nbsp; buyawarranty.co.uk</a>
          </td>
          <td align="center" style="padding: 6px; border-right: 1px solid #e6ebf1; font-size: 13px;">
            <a href="mailto:support@buyawarranty.co.uk" style="color: #0066cc; text-decoration: none;">&#9993;&nbsp; support@buyawarranty.co.uk</a>
          </td>
          <td align="center" style="padding: 6px; font-size: 13px;">
            <a href="tel:03302295040" style="color: #0066cc; text-decoration: none;">&#128222;&nbsp; 0330 229 5040</a>
          </td>
        </tr>
      </table>

      ${buildUnsubscribeFooter(request.email, {
        title: 'No longer interested in your warranty quote?',
        blurb: "That's okay. You can stop these quote reminders or unsubscribe from all marketing emails.",
        softLabel: 'Stop quote reminders',
        reason: 'You received this email because you requested a warranty quote from Buy A Warranty.',
      })}
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

    // Hard stop: they already bought - never chase a completed purchase
    if (await hasPurchased(supabase, normalizedEmail, emailRequest.vehicleReg)) {
      console.log(`Skipping email - ${normalizedEmail} has already purchased`);
      return new Response(JSON.stringify({ success: true, message: "Recipient has already purchased" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Respect "Stop quote reminders" (essentials-only) — no quote chasers for these recipients
    const { data: audience } = await supabase
      .from('marketing_audience')
      .select('frequency')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (audience?.frequency === 'essentials') {
      console.log(`Skipping email - ${normalizedEmail} opted out of quote reminders`);
      return new Response(JSON.stringify({ success: true, message: "Recipient opted out of quote reminders" }), {
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
      // Always resume on step 3 (plans). The email carries no priced plan, so landing
      // straight on step 4 renders an empty/£0 order summary — step 3 recalculates the
      // saved selections and the customer continues to checkout in one tap.
      const targetStep = 3;


      
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
      // No CC here — we do NOT want support@ on every outbound email.
      // reply_to routes the customer's actual REPLY to both inboxes,
      // so support@ only receives a copy when the customer hits "reply".
      reply_to: ["support@buyawarranty.co.uk", "info@buyawarranty.co.uk"],
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
      await logCustomerEmail({
        recipient_email: emailRequest.email,
        recipient_name: emailRequest.firstName,
        subject,
        template_name: `abandoned_cart_${emailRequest.triggerType || 'unknown'}`,
        source_function: 'send-abandoned-cart-email',
        status: 'failed',
        error_message: `Resend ${emailResponse.status}: ${errorText.slice(0, 300)}`,
        registration_plate: emailRequest.vehicleReg,
        metadata: { cart_id: emailRequest.cartId, trigger_type: emailRequest.triggerType },
      });
      throw new Error(`Resend API error: ${emailResponse.status} - ${errorText}`);
    }

    const emailResult = await emailResponse.json();
    console.log("Email sent successfully:", emailResult);
    await logCustomerEmail({
      recipient_email: emailRequest.email,
      recipient_name: emailRequest.firstName,
      subject,
      template_name: `abandoned_cart_${emailRequest.triggerType || 'unknown'}`,
      source_function: 'send-abandoned-cart-email',
      status: 'sent',
      registration_plate: emailRequest.vehicleReg,
      metadata: { cart_id: emailRequest.cartId, trigger_type: emailRequest.triggerType, resend_message_id: emailResult?.id },
    });

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
