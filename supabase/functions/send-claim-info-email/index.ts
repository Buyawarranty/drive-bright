import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-CLAIM-INFO-EMAIL] ${step}${detailsStr}`);
};

interface ClaimInfoEmailRequest {
  email: string;
  customerFirstName?: string;
}

const renderHtml = (firstName: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>How to make a claim with Buy a Warranty</title>
  <style>
    @media only screen and (max-width: 600px) {
      .baw-wrap { padding: 16px 10px !important; }
      .baw-card { padding: 22px 18px !important; }
      .baw-card-sm { padding: 18px !important; }
      .baw-h1 { font-size: 22px !important; }
      .baw-h2 { font-size: 17px !important; }
      .baw-cta { padding: 13px 24px !important; font-size: 15px !important; display: block !important; }
      .baw-two-col { display: block !important; width: 100% !important; }
      .baw-two-col + .baw-two-col { margin-top: 14px; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f5f6f8;">
  <div class="baw-wrap" style="background-color:#f5f6f8; padding:30px 15px; font-family: Arial, Helvetica, sans-serif; color:#1f2937;">
    <div style="max-width:640px; margin:0 auto;">

      <!-- Logo -->
      <div style="text-align:center; padding:10px 0 20px;">
        <img src="https://buyawarranty.co.uk/images/buyawarranty-logo.png" alt="buyawarranty.co.uk" style="max-width:220px; height:auto; display:inline-block;" />
      </div>

      <!-- Hero -->
      <div class="baw-card" style="background-color:#ffffff; border-radius:8px; padding:32px 30px; margin-bottom:16px; border:1px solid #e5e7eb;">
        <h1 class="baw-h1" style="color:#1d3a8a; font-size:26px; font-weight:700; margin:0 0 6px 0; line-height:1.25;">We're here when <span style="color:#eb6b1f;">you need us.</span></h1>
        <p style="color:#1d3a8a; font-size:15px; font-weight:700; margin:18px 0 6px 0;">Hi ${firstName},</p>
        <p style="color:#4b5563; font-size:15px; line-height:1.6; margin:6px 0 0 0;">We hope you are enjoying peace of mind with your Buy a Warranty protection.</p>
        <p style="color:#4b5563; font-size:15px; line-height:1.6; margin:10px 0 0 0;">If you ever need to make a claim, the quickest and easiest way to get started is by completing our online claim form.</p>
      </div>

      <!-- 14-day claim notice -->
      <div class="baw-card" style="background-color:#ecfdf5; border-radius:8px; padding:22px 26px; margin-bottom:16px; border:1px solid #a7f3d0; border-left:4px solid #059669;">
        <p style="color:#065f46; font-size:15px; font-weight:700; margin:0 0 8px 0;">✅ Your warranty cover is now active.</p>
        <p style="color:#065f46; font-size:14px; line-height:1.6; margin:0;">Please note that claims can be submitted after your first <strong>14 days of continuous cover</strong>. Full details can be found in your policy documents.</p>
      </div>



      <!-- Submit Claim -->
      <div class="baw-card" style="background-color:#ffffff; border-radius:8px; padding:28px 30px; margin-bottom:16px; border:1px solid #e5e7eb;">
        <h2 class="baw-h2" style="color:#1d3a8a; font-size:18px; font-weight:700; margin:0 0 6px 0; text-align:center;">Submit your claim online</h2>
        <p style="color:#4b5563; font-size:14px; margin:0 0 16px 0; text-align:center;">Please complete our online claim form:</p>
        <div style="text-align:center; margin:6px 0 14px 0;">
          <a href="https://buyawarranty.co.uk/make-a-claim/" class="baw-cta" style="display:inline-block; background-color:#eb6b1f; color:#ffffff; text-decoration:none; padding:14px 36px; border-radius:6px; font-size:16px; font-weight:700;">Submit a Claim →</a>
        </div>
        <p style="text-align:center; margin:0 0 18px 0;"><a href="https://buyawarranty.co.uk/make-a-claim/" style="color:#1d3a8a; font-size:13px; text-decoration:underline;">https://buyawarranty.co.uk/make-a-claim/</a></p>
        <p style="color:#4b5563; font-size:14px; line-height:1.6; margin:0; padding-top:14px; border-top:1px solid #f3f4f6;">Submitting the form online helps our claims team review your claim faster and gather the information needed to support you as quickly and easily as possible.</p>
      </div>

      <!-- Two columns: Hours + Before repairs -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px;">
        <tr>
          <td class="baw-two-col" valign="top" width="49%" style="vertical-align:top;">
            <div class="baw-card-sm" style="background-color:#ffffff; border-radius:8px; padding:24px; border:1px solid #e5e7eb; height:100%;">
              <h2 class="baw-h2" style="color:#1d3a8a; font-size:17px; font-weight:700; margin:0 0 10px 0;">Claims Team Opening Hours</h2>
              <p style="color:#4b5563; font-size:14px; margin:0 0 12px 0;">Our claims team reviews and processes claims:</p>
              <p style="color:#1f2937; font-size:14px; margin:6px 0; font-weight:600;">📅 Monday to Friday</p>
              <p style="color:#1f2937; font-size:14px; margin:6px 0; font-weight:600;">🕘 9:00am to 5:30pm</p>
            </div>
          </td>
          <td class="baw-two-col" valign="top" width="2%">&nbsp;</td>
          <td class="baw-two-col" valign="top" width="49%" style="vertical-align:top;">
            <div class="baw-card-sm" style="background-color:#fff7ed; border-radius:8px; padding:24px; border:1px solid #fed7aa; height:100%;">
              <h2 class="baw-h2" style="color:#eb6b1f; font-size:17px; font-weight:700; margin:0 0 10px 0;">⚠ Before any repairs begin</h2>
              <p style="color:#4b5563; font-size:14px; line-height:1.6; margin:0 0 10px 0;">Please do not authorise or begin any repair work until your claim has been reviewed and approved by our claims team.</p>
              <p style="color:#1f2937; font-size:14px; line-height:1.6; margin:0; font-weight:600;">Repairs carried out without prior authorisation may not be covered under your warranty agreement.</p>
            </div>
          </td>
        </tr>
      </table>

      <!-- What to upload + Important info -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px;">
        <tr>
          <td class="baw-two-col" valign="top" width="49%" style="vertical-align:top;">
            <div class="baw-card-sm" style="background-color:#ffffff; border-radius:8px; padding:24px; border:1px solid #e5e7eb; height:100%;">
              <h2 class="baw-h2" style="color:#1d3a8a; font-size:17px; font-weight:700; margin:0 0 10px 0;">What to upload with your claim</h2>
              <p style="color:#4b5563; font-size:14px; line-height:1.5; margin:0 0 12px 0;">To help us assess your claim, please upload any supporting documents you already have, including where applicable:</p>
              <p style="color:#4b5563; font-size:14px; margin:6px 0;"><span style="color:#1d3a8a;">📄</span> Garage invoices</p>
              <p style="color:#4b5563; font-size:14px; margin:6px 0;"><span style="color:#1d3a8a;">📊</span> Diagnostic reports</p>
              <p style="color:#4b5563; font-size:14px; margin:6px 0;"><span style="color:#1d3a8a;">📋</span> Repair estimates or quotations</p>
              <p style="color:#4b5563; font-size:14px; margin:6px 0;"><span style="color:#1d3a8a;">📷</span> Photos or supporting documents</p>
              <div style="margin-top:14px; padding:12px; background-color:#eff6ff; border-radius:6px;">
                <p style="color:#4b5563; font-size:13px; line-height:1.5; margin:0;"><strong>ℹ</strong> If diagnostics are required as part of your claim, we may <strong>contribute up to £50 or 1 hour of diagnostic time, whichever is lower, subject to approval.</strong></p>
              </div>
              <div style="margin-top:10px; padding:12px; background-color:#f0f9ff; border-radius:6px;">
                <p style="color:#4b5563; font-size:13px; line-height:1.5; margin:0;"><strong>✓</strong> If diagnostics are needed, our claims team will guide you through the next steps.</p>
              </div>
            </div>
          </td>
          <td class="baw-two-col" valign="top" width="2%">&nbsp;</td>
          <td class="baw-two-col" valign="top" width="49%" style="vertical-align:top;">
            <div class="baw-card-sm" style="background-color:#fef2f2; border-radius:8px; padding:24px; border:1px solid #fecaca; height:100%;">
              <h2 class="baw-h2" style="color:#dc2626; font-size:17px; font-weight:700; margin:0 0 10px 0;">⚠ Important information before submitting a claim</h2>
              <p style="color:#4b5563; font-size:14px; line-height:1.5; margin:0 0 12px 0;">After a claim has been submitted and costs have been incurred:</p>
              <p style="color:#1f2937; font-size:14px; margin:8px 0; font-weight:600;"><span style="color:#dc2626;">✕</span> Your policy cannot be cancelled</p>
              <p style="color:#1f2937; font-size:14px; margin:8px 0; font-weight:600;"><span style="color:#dc2626;">✕</span> Your policy will no longer be eligible for a refund</p>
              <p style="color:#4b5563; font-size:13px; line-height:1.6; margin:14px 0 0 0; padding-top:12px; border-top:1px solid #fecaca;">This is standard across the warranty industry and helps us keep the claims process fair and transparent for all customers.</p>
            </div>
          </td>
        </tr>
      </table>

      <!-- Need help + Helpful links -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:16px;">
        <tr>
          <td class="baw-two-col" valign="top" width="49%" style="vertical-align:top;">
            <div class="baw-card-sm" style="background-color:#ffffff; border-radius:8px; padding:24px; border:1px solid #e5e7eb; height:100%;">
              <h2 class="baw-h2" style="color:#1d3a8a; font-size:17px; font-weight:700; margin:0 0 10px 0;">Need help before submitting?</h2>
              <p style="color:#4b5563; font-size:14px; line-height:1.5; margin:0 0 14px 0;">If you have any questions before submitting your claim, our team will be happy to help.</p>
              <p style="margin:8px 0; font-size:14px;"><span style="color:#1d3a8a;">📞</span> <a href="tel:03302295045" style="color:#eb6b1f; text-decoration:none; font-weight:700;">0330 229 5045</a></p>
              <p style="margin:8px 0; font-size:14px;"><span style="color:#1d3a8a;">✉</span> <a href="mailto:claims@buyawarranty.co.uk" style="color:#1f2937; text-decoration:none; font-weight:600;">claims@buyawarranty.co.uk</a></p>
            </div>
          </td>
          <td class="baw-two-col" valign="top" width="2%">&nbsp;</td>
          <td class="baw-two-col" valign="top" width="49%" style="vertical-align:top;">
            <div class="baw-card-sm" style="background-color:#ffffff; border-radius:8px; padding:24px; border:1px solid #e5e7eb; height:100%;">
              <h2 class="baw-h2" style="color:#1d3a8a; font-size:17px; font-weight:700; margin:0 0 14px 0;">Helpful links</h2>
              <p style="margin:10px 0; font-size:14px;"><a href="https://buyawarranty.co.uk/make-a-claim/" style="color:#1d3a8a; text-decoration:none; font-weight:600;">Make a Claim ›</a></p>
              <p style="margin:10px 0; font-size:14px;"><a href="https://buyawarranty.co.uk/cancellation-policy" style="color:#1d3a8a; text-decoration:none; font-weight:600;">Cancellation Policy ›</a></p>
              <p style="margin:10px 0; font-size:14px;"><a href="https://buyawarranty.co.uk/terms" style="color:#1d3a8a; text-decoration:none; font-weight:600;">Terms &amp; Conditions ›</a></p>
            </div>
          </td>
        </tr>
      </table>

      <!-- Closing -->
      <div class="baw-card-sm" style="background-color:#ffffff; border-radius:8px; padding:20px 24px; margin-bottom:16px; border:1px solid #e5e7eb;">
        <p style="color:#4b5563; font-size:14px; line-height:1.6; margin:0;">Our goal is to make the claims process clear, fair and stress-free from start to finish.</p>
        <p style="color:#4b5563; font-size:14px; line-height:1.6; margin:14px 0 0 0;">Kind regards,<br/><strong style="color:#1d3a8a;">Claims Support Team</strong><br/>Buy a Warranty</p>
      </div>

      <!-- Footer bar -->
      <div style="background-color:#1d3a8a; border-radius:8px; padding:16px 20px; text-align:center;">
        <p style="margin:0; color:#ffffff; font-size:13px; line-height:1.8;">
          🌐 <a href="https://buyawarranty.co.uk" style="color:#ffffff; text-decoration:none;">buyawarranty.co.uk</a>
          &nbsp;|&nbsp; 📞 <a href="tel:03302295045" style="color:#ffffff; text-decoration:none;">0330 229 5045</a>
          &nbsp;|&nbsp; ✉ <a href="mailto:claims@buyawarranty.co.uk" style="color:#ffffff; text-decoration:none;">claims@buyawarranty.co.uk</a>
        </p>
      </div>

    </div>
  </div>
</body>
</html>`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    const { email, customerFirstName } = await req.json() as ClaimInfoEmailRequest;

    if (!email) {
      throw new Error("Missing required parameter: email");
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const firstName = (customerFirstName || 'there').toString().split(' ')[0];

    const payload = {
      from: 'Buy a Warranty Claims <claims@buyawarranty.co.uk>',
      to: [email],
      reply_to: 'claims@buyawarranty.co.uk',
      subject: 'Important: How To Make A Claim With Buy a Warranty',
      headers: {
        'X-Entity-Ref-ID': `claim-info-${email}-${Date.now()}`,
      },
      html: renderHtml(firstName),
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      logStep("Email send failed", { status: response.status, result });
      throw new Error(`Email send failed: ${result.message || 'unknown'}`);
    }

    logStep("Claim info email sent", { id: result.id, to: email });
    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
