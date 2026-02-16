import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

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

    const finalHtml = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <title>Your Warranty Quote</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #f5f5f5; -webkit-font-smoothing: antialiased;">
          
          <!-- Wrapper Table -->
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
            <tr>
              <td align="center" style="padding: 20px;">
                
                <!-- Main Container -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  
                  <!-- Header with Logo -->
                  <tr>
                    <td align="center" style="padding: 32px 24px 24px 24px; background-color: #ffffff;">
                      <a href="https://buyawarranty.co.uk" target="_blank">
                        <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="Buy A Warranty" width="180" style="display: block; width: 180px; max-width: 100%; height: auto;" />
                      </a>
                    </td>
                  </tr>
                  
                  <!-- Main Headline -->
                  <tr>
                    <td align="center" style="padding: 0 24px 16px 24px;">
                      <h1 style="font-size: 26px; font-weight: 700; color: #1a1a1a; margin: 0 0 8px 0; line-height: 1.3;">
                        Here's your ${vehicleDisplay} warranty quote
                      </h1>
                      <p style="font-size: 15px; color: #666666; margin: 0; line-height: 1.5;">
                        Protect your ${vehicleDisplay} from unexpected repair bills by choosing a payment option that works for you. Once payment is completed, your warranty will be activated immediately.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Greeting -->
                  <tr>
                    <td style="padding: 0 24px 20px 24px;">
                      <p style="font-size: 16px; color: #333333; margin: 0;">
                        Hi ${firstName},
                      </p>
                      <p style="font-size: 15px; color: #444444; margin: 12px 0 0 0; line-height: 1.6;">
                        Thanks for requesting your personalised warranty quote. Please review your cover details below and choose how you'd like to pay to activate your warranty.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Quote Summary Box -->
                  <tr>
                    <td style="padding: 0 24px 24px 24px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                        <tr>
                          <td style="padding: 20px;">
                            <p style="font-size: 14px; font-weight: 700; color: #0369a1; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                              Your Cover at a Glance
                            </p>
                            
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                              <tr>
                                <td style="padding: 8px 0; font-size: 14px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Vehicle</td>
                                <td style="padding: 8px 0; font-size: 14px; color: #1a1a1a; font-weight: 600; text-align: right; border-bottom: 1px solid #e2e8f0;">${vehicleDisplay} (${vehicleData.regNumber})</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; font-size: 14px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Mileage</td>
                                <td style="padding: 8px 0; font-size: 14px; color: #1a1a1a; font-weight: 600; text-align: right; border-bottom: 1px solid #e2e8f0;">${parseInt(vehicleData.mileage || '0').toLocaleString()} miles</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; font-size: 14px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Plan</td>
                                <td style="padding: 8px 0; font-size: 14px; color: #1a1a1a; font-weight: 600; text-align: right; border-bottom: 1px solid #e2e8f0;">${quoteDetails.plan} cover</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; font-size: 14px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Cover period</td>
                                <td style="padding: 8px 0; font-size: 14px; color: #1a1a1a; font-weight: 600; text-align: right; border-bottom: 1px solid #e2e8f0;">${coverPeriodDisplay}</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; font-size: 14px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Claim limit</td>
                                <td style="padding: 8px 0; font-size: 14px; color: #1a1a1a; font-weight: 600; text-align: right; border-bottom: 1px solid #e2e8f0;">£${quoteDetails.claimLimit.toLocaleString()} per claim</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; font-size: 14px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Excess</td>
                                <td style="padding: 8px 0; font-size: 14px; color: #1a1a1a; font-weight: 600; text-align: right; border-bottom: 1px solid #e2e8f0;">£${quoteDetails.excessAmount}</td>
                              </tr>
                              <tr>
                                <td style="padding: 8px 0; font-size: 14px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Labour rate covered</td>
                                <td style="padding: 8px 0; font-size: 14px; color: #1a1a1a; font-weight: 600; text-align: right; border-bottom: 1px solid #e2e8f0;">Up to £${quoteDetails.labourRate || 70} per hour</td>
                              </tr>
                              <tr>
                                <td style="padding: 12px 0 8px 0; font-size: 16px; color: #1a1a1a; font-weight: 700;">
                                  Total price
                                </td>
                                <td style="padding: 12px 0 8px 0; font-size: 20px; color: #ea580c; font-weight: 700; text-align: right;">
                                  £${quoteDetails.totalPrice}
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- What Your Warranty Includes Section -->
                  <tr>
                    <td style="padding: 0 24px 24px 24px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f0fdf4; border-radius: 10px;">
                        <tr>
                          <td style="padding: 20px;">
                            <p style="font-size: 14px; font-weight: 700; color: #166534; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                              What Your Warranty Includes
                            </p>
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                              <tr>
                                <td style="padding: 6px 0; font-size: 14px; color: #166534;">
                                  <span style="color: #22c55e; font-weight: bold; margin-right: 8px;">✔</span>Mechanical and electrical component cover
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 0; font-size: 14px; color: #166534;">
                                  <span style="color: #22c55e; font-weight: bold; margin-right: 8px;">✔</span>Labour costs included
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 0; font-size: 14px; color: #166534;">
                                  <span style="color: #22c55e; font-weight: bold; margin-right: 8px;">✔</span>Repairs carried out at VAT-registered garages
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 0; font-size: 14px; color: #166534;">
                                  <span style="color: #22c55e; font-weight: bold; margin-right: 8px;">✔</span>No waiting period once activated
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 0; font-size: 14px; color: #166534;">
                                  <span style="color: #22c55e; font-weight: bold; margin-right: 8px;">✔</span>Unlimited claims up to your vehicle's value
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 6px 0; font-size: 14px; color: #166534;">
                                  <span style="color: #22c55e; font-weight: bold; margin-right: 8px;">✔</span>Fast, UK-based claims support
                                </td>
                              </tr>
                            </table>
                            <p style="font-size: 15px; font-weight: 600; color: #166534; margin: 16px 0 0 0; font-style: italic;">
                              If it breaks after activation, we'll fix it.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Payment Options Section -->
                  <tr>
                    <td style="padding: 0 24px 24px 24px;">
                      <p style="font-size: 16px; font-weight: 700; color: #1a1a1a; margin: 0 0 16px 0;">
                        Choose how you'd like to pay
                      </p>
                      
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        <!-- Monthly Option -->
                        <tr>
                          <td style="padding: 16px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <p style="font-size: 15px; font-weight: 700; color: #1a1a1a; margin: 0 0 8px 0;">Pay monthly – spread the cost</p>
                            <p style="font-size: 13px; color: #64748b; margin: 0 0 12px 0; line-height: 1.5;">
                              A flexible way to protect your car without paying everything upfront.
                            </p>
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                              <tr>
                                <td style="padding: 3px 0; font-size: 13px; color: #444;">• Simple monthly payments</td>
                              </tr>
                              <tr>
                                <td style="padding: 3px 0; font-size: 13px; color: #444;">• Interest free</td>
                              </tr>
                              <tr>
                                <td style="padding: 3px 0; font-size: 13px; color: #444;">• No hidden fees</td>
                              </tr>
                              <tr>
                                <td style="padding: 3px 0; font-size: 13px; color: #444;">• No impact on your credit score</td>
                              </tr>
                            </table>
                            <p style="margin: 12px 0 0 0;">
                              <a href="${quoteLink}" target="_blank" style="font-size: 14px; color: #ea580c; font-weight: 600; text-decoration: none;">
                                👉 Choose monthly payments to activate your warranty
                              </a>
                            </p>
                          </td>
                        </tr>
                        <tr><td style="height: 12px;"></td></tr>
                        <!-- Pay in Full Option -->
                        <tr>
                          <td style="padding: 16px; background-color: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
                            <p style="font-size: 15px; font-weight: 700; color: #1a1a1a; margin: 0 0 8px 0;">Pay in full – save 10 percent</p>
                            <p style="font-size: 13px; color: #64748b; margin: 0 0 12px 0; line-height: 1.5;">
                              Our best-value option for complete peace of mind.
                            </p>
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                              <tr>
                                <td style="padding: 3px 0; font-size: 13px; color: #444;">• One upfront payment</td>
                              </tr>
                              <tr>
                                <td style="padding: 3px 0; font-size: 13px; color: #444;">• Save 10 percent instantly</td>
                              </tr>
                              <tr>
                                <td style="padding: 3px 0; font-size: 13px; color: #444;">• Warranty activated immediately after payment</td>
                              </tr>
                              <tr>
                                <td style="padding: 3px 0; font-size: 13px; color: #444;">• No ongoing payments</td>
                              </tr>
                            </table>
                            <p style="margin: 12px 0 0 0;">
                              <a href="${quoteLink}" target="_blank" style="font-size: 14px; color: #ea580c; font-weight: 600; text-decoration: none;">
                                👉 Pay in full and save 10 percent
                              </a>
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- What Happens Next -->
                  <tr>
                    <td style="padding: 0 24px 32px 24px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #fefce8; border-radius: 10px; border: 1px solid #fef08a;">
                        <tr>
                          <td style="padding: 20px;">
                            <p style="font-size: 14px; font-weight: 700; color: #854d0e; margin: 0 0 12px 0;">
                              What happens next
                            </p>
                            <p style="font-size: 14px; color: #a16207; margin: 0 0 8px 0; line-height: 1.5;">
                              Once your payment is completed:
                            </p>
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                              <tr>
                                <td style="padding: 4px 0; font-size: 14px; color: #854d0e;">
                                  <span style="margin-right: 8px;">✔</span>Your warranty is activated straight away
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 4px 0; font-size: 14px; color: #854d0e;">
                                  <span style="margin-right: 8px;">✔</span>Policy documents are emailed to you
                                </td>
                              </tr>
                              <tr>
                                <td style="padding: 4px 0; font-size: 14px; color: #854d0e;">
                                  <span style="margin-right: 8px;">✔</span>You're protected against unexpected repair bills
                                </td>
                              </tr>
                            </table>
                            <p style="font-size: 13px; color: #a16207; margin: 16px 0 0 0;">
                              🔒 Secure checkout. Immediate activation after payment.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Primary CTA Button -->
                  <tr>
                    <td align="center" style="padding: 0 24px 32px 24px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td align="center">
                            <a href="${quoteLink}" target="_blank" style="display: block; width: 100%; max-width: 380px; background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: #ffffff; padding: 18px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; text-align: center; box-shadow: 0 4px 14px rgba(234, 88, 12, 0.4);">
                              Choose how to pay and activate my warranty
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Trust Section with Trustpilot -->
                  <tr>
                    <td style="padding: 0 24px 32px 24px; border-top: 1px solid #e5e7eb;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td align="center" style="padding-top: 28px;">
                            <p style="font-size: 14px; font-weight: 700; color: #1a1a1a; margin: 0 0 8px 0;">
                              Trusted by UK drivers
                            </p>
                            <a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" style="text-decoration: none;">
                              <img src="https://buyawarranty.co.uk/lovable-uploads/4e4faf8a-b202-4101-a858-9c58ad0a28c5.png" alt="Rated Excellent on Trustpilot" width="130" style="display: block; width: 130px; max-width: 100%; height: auto; margin: 0 auto;" />
                            </a>
                            <p style="font-size: 13px; color: #64748b; margin: 8px 0 0 0;">
                              Thousands of drivers trust BuyAWarranty for reliable vehicle protection.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 32px 24px; border-top: 1px solid #e2e8f0;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                        <tr>
                          <td align="center">
                            <p style="font-size: 14px; font-weight: 600; color: #1a1a1a; margin: 0 0 12px 0;">
                              Need help before you decide?
                            </p>
                            <p style="font-size: 13px; color: #64748b; margin: 0 0 4px 0;">
                              Our UK-based team is happy to help.
                            </p>
                            <p style="font-size: 13px; color: #64748b; margin: 0 0 6px 0;">
                              Customer Services and Sales: <a href="tel:03302295040" style="color: #ea580c; text-decoration: none; font-weight: 500;">0330 229 5040</a>
                            </p>
                            <p style="font-size: 13px; color: #64748b; margin: 0 0 16px 0;">
                              Claims Line: <a href="tel:03302295045" style="color: #ea580c; text-decoration: none; font-weight: 500;">0330 229 5045</a>
                            </p>
                            <p style="font-size: 13px; color: #94a3b8; margin: 0;">
                              <a href="https://buyawarranty.co.uk" style="color: #ea580c; text-decoration: none;">buyawarranty.co.uk</a>
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                </table>
                <!-- End Main Container -->
                
              </td>
            </tr>
          </table>
          <!-- End Wrapper -->
          
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
