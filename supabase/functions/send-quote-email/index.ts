import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const logStep = (step: string, data?: any) => {
  console.log(`[SEND-QUOTE-EMAIL] ${step}`, data ? JSON.stringify(data) : '');
};

interface QuoteEmailRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  vehicleData: {
    regNumber: string;
    make?: string;
    model?: string;
    year?: string;
    mileage: string;
    fuelType?: string;
    transmission?: string;
    vehicleType?: string;
  };
  isInitialQuote?: boolean;
  selectedPlan?: {
    name: string;
    price: number;
    paymentType: string;
    claimLimit?: number;
    labourRate?: number;
    voluntaryExcess?: number;
    boostAddon?: boolean;
    addOns?: string[];
  };
  quoteId?: string;
}

const formatPaymentType = (paymentType: string): string => {
  switch (paymentType) {
    case 'monthly': return 'Monthly';
    case 'yearly': return 'Annual';
    case 'twoYear': return '2 Year';
    case 'threeYear': return '3 Year';
    default: return paymentType;
  }
};

const generateQuoteEmail = (data: QuoteEmailRequest, baseUrl: string): string => {
  const { vehicleData, firstName, lastName, selectedPlan, quoteId, email } = data;
  
  // Use first name if available and it's not an email address, otherwise use a friendly greeting
  const isEmailAddress = (str: string) => str && str.includes('@');
  const customerName = firstName && firstName.trim() && !isEmailAddress(firstName.trim()) 
    ? firstName.trim() 
    : 'there';
  const vehicleDisplay = `${vehicleData.make || ''} ${vehicleData.model || ''}`.trim() || 'Your Vehicle';
  
  // Green checkmark icon - clean modern style
  const checkIcon = `<img src="https://buyawarranty.co.uk/lovable-uploads/green-checkmark.png" alt="✓" width="20" height="20" style="display: inline-block; vertical-align: middle; margin-right: 10px;" onerror="this.outerHTML='<span style=\\'color: #22c55e; font-weight: bold; margin-right: 10px;\\'>✓</span>'" />`;
  
  // Quote restoration link - goes directly to step 3
  const quoteLink = `${baseUrl}/?quote=${quoteId}&email=${encodeURIComponent(email)}&step=3`;
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Your ${vehicleDisplay} Warranty Quote – Complete Your Purchase</title>
      <!--[if mso]>
      <style type="text/css">
        body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
      </style>
      <![endif]-->
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #f5f5f5; -webkit-font-smoothing: antialiased;">
      
      <!-- Wrapper Table -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
        <tr>
          <td align="center" style="padding: 20px 10px;">
            
            <!-- Main Container -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
              
              <!-- Header with Logo -->
              <tr>
                <td align="center" style="padding: 35px 30px 25px 30px; background-color: #ffffff;">
                  <a href="https://buyawarranty.co.uk" target="_blank">
                    <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="buyawarranty" width="200" style="display: block; width: 200px; height: auto;" />
                  </a>
                </td>
              </tr>
              
              <!-- Primary Headline -->
              <tr>
                <td align="center" style="padding: 0 30px 25px 30px;">
                  <h1 style="font-size: 28px; font-weight: 700; color: #1a1a1a; margin: 0 0 10px 0; line-height: 1.3;">
                    You're Almost There!
                  </h1>
                  <p style="font-size: 16px; color: #666666; margin: 0;">
                    Your warranty quote is saved and ready to activate
                  </p>
                </td>
              </tr>
              
              <!-- Opening Copy -->
              <tr>
                <td style="padding: 0 30px 25px 30px;">
                  <p style="font-size: 17px; color: #333333; margin: 0 0 15px 0;">
                    Hi ${customerName},
                  </p>
                  <p style="font-size: 16px; color: #444444; margin: 0 0 10px 0; line-height: 1.7;">
                    You were just a step away from protecting your <strong>${vehicleDisplay}</strong> (${vehicleData.regNumber}).
                  </p>
                  <p style="font-size: 16px; color: #444444; margin: 0; line-height: 1.7;">
                    Your warranty details are saved and ready. Complete your purchase now to get instant cover.
                  </p>
                </td>
              </tr>
              
              <!-- Discount Section - Visual Highlight -->
              <tr>
                <td style="padding: 0 30px 25px 30px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: linear-gradient(135deg, #FFF8E7 0%, #FFF4D9 100%); border-radius: 12px; border: 2px solid #F59E0B;">
                    <tr>
                      <td align="center" style="padding: 25px;">
                        <p style="font-size: 16px; color: #92400E; font-weight: 600; margin: 0 0 12px 0;">
                          Complete your purchase now and save 10% with code
                        </p>
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background-color: #F59E0B; border-radius: 8px;">
                          <tr>
                            <td align="center" style="padding: 14px 30px;">
                              <span style="font-size: 22px; font-weight: 800; color: #000000; letter-spacing: 2px; font-family: monospace;">SAVE10PERCENT</span>
                            </td>
                          </tr>
                        </table>
                        <p style="font-size: 13px; color: #92400E; margin: 12px 0 0 0;">
                          Apply at checkout • Easy to use • Limited time offer
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Clarity Section - Friction Removal -->
              <tr>
                <td style="padding: 0 30px 25px 30px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="font-size: 15px; font-weight: 600; color: #334155; margin: 0 0 10px 0;">
                          What happens when you click below?
                        </p>
                        <p style="font-size: 14px; color: #64748b; margin: 0; line-height: 1.6;">
                          You'll go straight back to your saved quote – no need to re-enter any details. Your vehicle information and plan selections are all pre-filled. Just review and complete your secure checkout in under 2 minutes.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Benefits List -->
              <tr>
                <td style="padding: 0 30px 25px 30px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #f0fdf4; border-radius: 10px;">
                    <tr>
                      <td style="padding: 20px 25px;">
                        <p style="font-size: 13px; color: #166534; font-weight: 700; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                          Your Quote Includes:
                        </p>
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                          <tr>
                            <td style="padding: 8px 0; font-size: 15px; color: #166534;">
                              ${checkIcon}<span style="vertical-align: middle;">Comprehensive mechanical & electrical cover</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; font-size: 15px; color: #166534;">
                              ${checkIcon}<span style="vertical-align: middle;">UK-based customer support</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; font-size: 15px; color: #166534;">
                              ${checkIcon}<span style="vertical-align: middle;">Fast and simple claims process</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; font-size: 15px; color: #166534;">
                              ${checkIcon}<span style="vertical-align: middle;">FCA-regulated provider</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; font-size: 15px; color: #166534;">
                              ${checkIcon}<span style="vertical-align: middle;">14-day money-back guarantee</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Primary CTA Button -->
              <tr>
                <td align="center" style="padding: 0 30px 20px 30px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center">
                        <a href="${quoteLink}" target="_blank" style="display: block; width: 100%; max-width: 380px; background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: #ffffff; padding: 20px 30px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 19px; text-align: center; box-shadow: 0 6px 20px rgba(234, 88, 12, 0.4); border: none;">
                          Complete My Purchase
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Urgency / Reassurance Line -->
              <tr>
                <td align="center" style="padding: 0 30px 30px 30px;">
                  <p style="font-size: 14px; color: #64748b; margin: 0;">
                    Your quote is reserved – secure your cover before prices change
                  </p>
                </td>
              </tr>
              
              <!-- Trust Section with Trustpilot -->
              <tr>
                <td style="padding: 0 30px 25px 30px; border-top: 1px solid #e5e7eb;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding-top: 25px;">
                        <a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" style="text-decoration: none;">
                          <img src="https://buyawarranty.co.uk/lovable-uploads/4e4faf8a-b202-4101-a858-9c58ad0a28c5.png" alt="Trustpilot 5 stars" width="150" style="display: block; width: 150px; height: auto; margin: 0 auto;" />
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding-top: 15px;">
                        <p style="font-size: 13px; color: #64748b; margin: 0;">
                          No hidden fees&nbsp;&nbsp;|&nbsp;&nbsp;FCA compliant&nbsp;&nbsp;|&nbsp;&nbsp;14-day money-back guarantee
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Support & Trust Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 30px; border-top: 1px solid #e2e8f0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center">
                        <p style="font-size: 15px; font-weight: 600; color: #1a1a1a; margin: 0 0 15px 0;">
                          Questions? We're here to help
                        </p>
                        <p style="font-size: 14px; color: #64748b; margin: 0 0 8px 0;">
                          Email: <a href="mailto:support@buyawarranty.co.uk" style="color: #ea580c; text-decoration: none; font-weight: 500;">support@buyawarranty.co.uk</a>
                        </p>
                        <p style="font-size: 14px; color: #64748b; margin: 0 0 20px 0;">
                          Phone: <a href="tel:03302295040" style="color: #ea580c; text-decoration: none; font-weight: 500;">0330 229 5040</a>
                        </p>
                        <p style="font-size: 13px; color: #94a3b8; margin: 0;">
                          Kind regards,<br />
                          <strong style="color: #64748b;">The Buy A Warranty Team</strong><br />
                          <a href="https://www.buyawarranty.co.uk" style="color: #ea580c; text-decoration: none;">buyawarranty.co.uk</a>
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
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');
    
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const data: QuoteEmailRequest = await req.json();
    
    logStep('Sending quote email', { email: data.email, vehicle: data.vehicleData.regNumber, requestHeaders: Object.fromEntries(req.headers.entries()) });

    const resend = new Resend(resendApiKey);
    
    // Generate unique quote ID
    const quoteId = `QUO-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    // Always use production URL for email links
    const baseUrl = 'https://buyawarranty.co.uk';
    
    logStep('Email URL generation', { baseUrl, quoteId, email: data.email });
    
    // Build complete quote link with proper parameters for restoration
    const quoteLink = `${baseUrl}/?quote=${quoteId}&email=${encodeURIComponent(data.email)}&step=3`;
    logStep('Generated quote link', { quoteLink });
    
    // Store quote data in database for restoration
    try {
      const { error: insertError } = await supabase
        .from('quote_data')
        .insert({
          quote_id: quoteId,
          customer_email: data.email,
          vehicle_data: data.vehicleData,
          plan_data: data.selectedPlan || null,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
        });

      if (insertError) {
        console.error('Error storing quote data:', insertError);
        logStep('Error storing quote data', insertError);
      } else {
        logStep('Quote data stored successfully', { quoteId });
      }
    } catch (error) {
      console.error('Error storing quote data:', error);
      logStep('Exception storing quote data', error);
    }

    const htmlContent = generateQuoteEmail({ ...data, quoteId }, baseUrl);

    const vehicleDisplay = `${data.vehicleData.make || ''} ${data.vehicleData.model || ''}`.trim() || 'Your Vehicle';
    const emailSubject = `${data.vehicleData.regNumber} – Complete Your Warranty Purchase`;
    
    const emailResponse = await resend.emails.send({
      from: "Buyawarranty Customer Care <noreply@buyawarranty.co.uk>",
      to: [data.email],
      subject: emailSubject,
      html: htmlContent,
    });

    logStep('Email sent successfully', emailResponse);

    // Log the customer quote email to abandoned_cart_emails table
    try {
      // First, try to find the abandoned cart for this email
      const { data: cartData } = await supabase
        .from('abandoned_carts')
        .select('id')
        .eq('email', data.email)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { error: logError } = await supabase
        .from('abandoned_cart_emails')
        .insert({
          abandoned_cart_id: cartData?.id || null,
          customer_email: data.email,
          email_type: 'customer_quote',
          subject: emailSubject,
          vehicle_reg: data.vehicleData.regNumber,
          plan_name: data.selectedPlan?.name || null,
          price_amount: data.selectedPlan?.price || null,
        });

      if (logError) {
        console.error('Error logging quote email:', logError);
      } else {
        logStep('Quote email logged to abandoned_cart_emails');
      }
    } catch (logErr) {
      console.error('Exception logging quote email:', logErr);
    }

    logStep('Quote email sent and logged successfully');

    return new Response(JSON.stringify({ success: true, emailId: emailResponse.data?.id }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error('Error in send-quote-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);