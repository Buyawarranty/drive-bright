import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { logCustomerEmail } from '../_shared/log-email.ts';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuoteEmailRequest {
  to: string;
  cc?: string | string[];
  subject: string;
  quoteLink: string;
  customerName: string;
  vehicleData: {
    regNumber: string;
    mileage: string;
    make?: string;
    model?: string;
    year?: string;
  };
  quoteDetails: {
    plan: string;
    paymentType: string;
    totalPrice: number;
    monthlyPrice: number;
    excessAmount: number;
    claimLimit: number;
    labourRate?: number;
    boostAddon?: boolean;
    coverMonths: number;
    bonusMonths: number;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      to,
      cc,
      subject,
      quoteLink,
      customerName,
      vehicleData,
      quoteDetails,
    }: QuoteEmailRequest = await req.json();

    console.log("Sending quote email to:", to);
    console.log("Quote link:", quoteLink);
    console.log("Quote details received:", JSON.stringify(quoteDetails, null, 2));
    console.log("Vehicle data received:", JSON.stringify(vehicleData, null, 2));

    const firstName = customerName.split(' ')[0];
    const vehicleDisplay = `${vehicleData.make || ''} ${vehicleData.model || ''}`.trim() || 'Your Vehicle';
    const totalMonths = quoteDetails.coverMonths + quoteDetails.bonusMonths;
    
    // Cover period display
    const coverPeriodDisplay = quoteDetails.bonusMonths > 0 
      ? `${quoteDetails.coverMonths} months plus ${quoteDetails.bonusMonths} months FREE`
      : `${quoteDetails.coverMonths} months`;

    const monthlyPrice = quoteDetails.monthlyPrice || Math.round((quoteDetails.totalPrice / quoteDetails.coverMonths) * 100) / 100;
    const payInFullPrice = Math.round(quoteDetails.totalPrice * 0.9);
    const savings = quoteDetails.totalPrice - payInFullPrice;

    const finalHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Warranty Quote</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.5; color: #1a1a1a; margin: 0; padding: 0; background-color: #f1f5f9; -webkit-font-smoothing: antialiased;">
          <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">Hi ${firstName}, your ${vehicleDisplay} warranty quote — £${quoteDetails.totalPrice} total or from £${monthlyPrice}/mo. Activate in 2 mins.</span>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f1f5f9;">
            <tr>
              <td align="center" style="padding: 20px 12px;">

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);">

                  <!-- Header -->
                  <tr>
                    <td align="center" style="padding: 24px 24px 8px 24px;">
                      <a href="https://buyawarranty.co.uk" target="_blank">
                        <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="Buy A Warranty" width="150" style="display:block; width:150px; height:auto;" />
                      </a>
                    </td>
                  </tr>

                  <!-- Hero: price + CTA above the fold -->
                  <tr>
                    <td style="padding: 16px 24px 0 24px;">
                      <p style="font-size: 13px; color: #64748b; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600;">Hi ${firstName} — your quote</p>
                      <h1 style="font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 14px 0; line-height: 1.3;">
                        ${vehicleDisplay} · ${quoteDetails.plan} cover
                      </h1>

                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(135deg,#fff7ed 0%, #ffedd5 100%); border-radius: 12px;">
                        <tr>
                          <td style="padding: 18px 20px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                              <tr>
                                <td>
                                  <p style="font-size: 12px; color: #9a3412; margin: 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">From</p>
                                  <p style="font-size: 30px; color: #ea580c; margin: 2px 0 0 0; font-weight: 800; line-height: 1;">£${monthlyPrice}<span style="font-size: 14px; color: #9a3412; font-weight: 600;">/mo</span></p>
                                  <p style="font-size: 13px; color: #7c2d12; margin: 4px 0 0 0;">or £${payInFullPrice} upfront · save £${savings}</p>
                                </td>
                                <td align="right" valign="middle">
                                  <a href="${quoteLink}" target="_blank" style="display:inline-block; background:#ea580c; color:#ffffff; padding: 14px 22px; text-decoration:none; border-radius:8px; font-weight:700; font-size:15px;">Activate →</a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      <p style="font-size: 12px; color: #64748b; margin: 10px 0 0 0; text-align: center;">🔒 Takes 2 minutes · Instant activation</p>
                    </td>
                  </tr>

                  <!-- Compact cover summary -->
                  <tr>
                    <td style="padding: 24px 24px 0 24px;">
                      <p style="font-size: 12px; font-weight: 700; color: #475569; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.6px;">Your cover</p>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px;">
                        <tr>
                          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Vehicle</td>
                          <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right; border-bottom: 1px solid #f1f5f9;">${vehicleData.regNumber} · ${parseInt(vehicleData.mileage || '0').toLocaleString()} mi</td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Cover period</td>
                          <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right; border-bottom: 1px solid #f1f5f9;">${coverPeriodDisplay}</td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Claim limit</td>
                          <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right; border-bottom: 1px solid #f1f5f9;">£${quoteDetails.claimLimit.toLocaleString()} per claim</td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Excess</td>
                          <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right; border-bottom: 1px solid #f1f5f9;">£${quoteDetails.excessAmount}</td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 14px; font-size: 13px; color: #64748b;">Labour rate</td>
                          <td style="padding: 10px 14px; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right;">Up to £${quoteDetails.labourRate || 70}/hr</td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- What's included — condensed chips -->
                  <tr>
                    <td style="padding: 20px 24px 0 24px;">
                      <p style="font-size: 12px; font-weight: 700; color: #166534; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 0.6px;">Included</p>
                      <p style="font-size: 13px; color: #334155; margin: 0; line-height: 1.9;">
                        <span style="background:#dcfce7; color:#166534; padding:4px 10px; border-radius:999px; font-weight:600; display:inline-block; margin:0 4px 4px 0;">✓ Parts &amp; labour</span>
                        <span style="background:#dcfce7; color:#166534; padding:4px 10px; border-radius:999px; font-weight:600; display:inline-block; margin:0 4px 4px 0;">✓ No waiting period</span>
                        <span style="background:#dcfce7; color:#166534; padding:4px 10px; border-radius:999px; font-weight:600; display:inline-block; margin:0 4px 4px 0;">✓ Unlimited claims</span>
                        <span style="background:#dcfce7; color:#166534; padding:4px 10px; border-radius:999px; font-weight:600; display:inline-block; margin:0 4px 4px 0;">✓ UK-based support</span>
                        <span style="background:#dcfce7; color:#166534; padding:4px 10px; border-radius:999px; font-weight:600; display:inline-block; margin:0 4px 4px 0;">✓ VAT-registered garages</span>
                      </p>
                    </td>
                  </tr>

                  <!-- Two payment options side-by-side -->
                  <tr>
                    <td style="padding: 24px 24px 0 24px;">
                      <p style="font-size: 12px; font-weight: 700; color: #475569; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.6px;">Pick a payment option</p>
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td width="50%" valign="top" style="padding-right: 6px;">
                            <a href="${quoteLink}" target="_blank" style="text-decoration:none; color:inherit; display:block;">
                              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px;">
                                <tr><td style="padding: 14px;">
                                  <p style="font-size:12px; color:#64748b; margin:0; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Monthly</p>
                                  <p style="font-size:20px; color:#0f172a; font-weight:800; margin:4px 0 2px 0;">£${monthlyPrice}<span style="font-size:12px; color:#64748b; font-weight:600;">/mo</span></p>
                                  <p style="font-size:12px; color:#64748b; margin:0 0 10px 0;">Interest free · No credit impact</p>
                                  <span style="font-size:13px; color:#ea580c; font-weight:700;">Choose monthly →</span>
                                </td></tr>
                              </table>
                            </a>
                          </td>
                          <td width="50%" valign="top" style="padding-left: 6px;">
                            <a href="${quoteLink}" target="_blank" style="text-decoration:none; color:inherit; display:block;">
                              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; position:relative;">
                                <tr><td style="padding: 14px;">
                                  <p style="font-size:12px; color:#1d4ed8; margin:0; text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">Pay in full · Save 10%</p>
                                  <p style="font-size:20px; color:#0f172a; font-weight:800; margin:4px 0 2px 0;">£${payInFullPrice}</p>
                                  <p style="font-size:12px; color:#475569; margin:0 0 10px 0;">One payment · Save £${savings}</p>
                                  <span style="font-size:13px; color:#ea580c; font-weight:700;">Pay in full →</span>
                                </td></tr>
                              </table>
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Primary CTA -->
                  <tr>
                    <td align="center" style="padding: 24px 24px 8px 24px;">
                      <a href="${quoteLink}" target="_blank" style="display:inline-block; background: linear-gradient(135deg,#ea580c 0%,#f97316 100%); color:#ffffff; padding: 16px 36px; text-decoration:none; border-radius:8px; font-weight:700; font-size:16px; box-shadow: 0 4px 12px rgba(234,88,12,0.35);">
                        Activate my warranty
                      </a>
                      <p style="font-size:12px; color:#64748b; margin: 12px 0 0 0;">Instant activation · Policy docs emailed straight away</p>
                    </td>
                  </tr>

                  <!-- Trust + help (combined) -->
                  <tr>
                    <td style="padding: 20px 24px 24px 24px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #e5e7eb;">
                        <tr>
                          <td align="center" style="padding-top: 20px;">
                            <a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" style="text-decoration:none;">
                              <img src="https://buyawarranty.co.uk/lovable-uploads/4e4faf8a-b202-4101-a858-9c58ad0a28c5.png" alt="Rated Excellent on Trustpilot" width="120" style="display:block; width:120px; height:auto; margin:0 auto;" />
                            </a>
                            <p style="font-size:12px; color:#64748b; margin:10px 0 0 0;">
                              Need a hand? Call <a href="tel:03302295040" style="color:#ea580c; text-decoration:none; font-weight:600;">0330 229 5040</a> · Mon–Fri
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Minimal footer -->
                  <tr>
                    <td style="background-color:#f8fafc; padding: 16px 24px; text-align:center;">
                      <p style="font-size:11px; color:#94a3b8; margin:0;">
                        <a href="https://buyawarranty.co.uk" style="color:#94a3b8; text-decoration:none;">buyawarranty.co.uk</a> · Claims: <a href="tel:03302295045" style="color:#94a3b8; text-decoration:none;">0330 229 5045</a>
                      </p>
                    </td>
                  </tr>

                </table>

              </td>
            </tr>
          </table>

        </body>
      </html>
    `;

    // Handle CC as string or array
    const ccRecipients = cc 
      ? (Array.isArray(cc) ? cc : [cc])
      : undefined;

    const emailResponse = await resend.emails.send({
      from: "Buyawarranty Customer Care <quotes@buyawarranty.co.uk>",
      to: [to],
      cc: ccRecipients,
      subject: subject,
      html: finalHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-admin-quote function:", error);
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
