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
  
  const isEmailAddress = (str: string) => str && str.includes('@');
  const customerName = firstName && firstName.trim() && !isEmailAddress(firstName.trim()) 
    ? firstName.trim() 
    : (lastName && lastName.trim() && !isEmailAddress(lastName.trim()) ? lastName.trim() : null);
  const vehicleDisplay = `${vehicleData.make || ''} ${vehicleData.model || ''}`.trim() || 'Your Vehicle';
  
  const quoteLink = `${baseUrl}/?quote=${quoteId}&email=${encodeURIComponent(email)}&step=3`;
  const promoLink = `${baseUrl}/?quote=${quoteId}&email=${encodeURIComponent(email)}&step=3&promo=SAVE50NOW`;
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Your ${vehicleDisplay} Warranty Quote</title>
      <!--[if mso]>
      <style type="text/css">
        body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
      </style>
      <![endif]-->
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1A1A1A; margin: 0; padding: 0; background-color: #F7F9FC; -webkit-font-smoothing: antialiased;">
      
      <!-- Hidden preheader text -->
      <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
        Save £50 when you return to your quote.&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #F7F9FC;">
        <tr>
          <td align="center" style="padding: 24px 16px;">
            
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #E8ECF0;">
              
              <!-- Header with Logo -->
              <tr>
                <td align="center" style="padding: 32px 24px 24px 24px; background-color: #ffffff;">
                  <a href="https://buyawarranty.co.uk" target="_blank">
                    <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="buyawarranty" width="160" style="display: block; width: 160px; max-width: 100%; height: auto;" />
                  </a>
                </td>
              </tr>
              
              <!-- Hero Section -->
              <tr>
                <td style="padding: 0 32px 24px 32px;">
                  <h1 style="font-size: 22px; font-weight: 700; color: #1A1A1A; margin: 0 0 8px 0; line-height: 1.35; text-align: center;">
                    Your ${vehicleDisplay} warranty quote is ready
                  </h1>
                  <p style="font-size: 15px; color: #555555; margin: 0; text-align: center; line-height: 1.5;">
                    Pick up where you left off and finish your cover in minutes.
                  </p>
                </td>
              </tr>

              <!-- Voucher Block -->
              <tr>
                <td style="padding: 0 32px 20px 32px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #FFF4D6; border-radius: 6px; border: 1px solid #F0E4B8;">
                    <tr>
                      <td align="center" style="padding: 18px 16px;">
                         <p style="font-size: 15px; color: #1A1A1A; font-weight: 600; margin: 0 0 10px 0;">
                          Save £50 today with code
                        </p>
                        <a href="${promoLink}" style="display: inline-block; background-color: #1A1A1A; color: #ffffff; padding: 10px 28px; text-decoration: none; border-radius: 4px; font-size: 18px; font-weight: 800; letter-spacing: 2px; font-family: 'Courier New', monospace;">SAVE50NOW</a>
                         <p style="font-size: 12px; color: #777777; margin: 10px 0 0 0;">
                           Tap to copy &bull; Valid for 24 hours &bull; Minimum order £350
                         </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Primary CTA -->
              <tr>
                <td align="center" style="padding: 0 32px 28px 32px;">
                  <a href="${quoteLink}" target="_blank" style="display: block; width: 100%; background-color: #FF7A00; color: #ffffff; padding: 16px 24px; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 17px; text-align: center; box-sizing: border-box;">
                    Complete my purchase
                  </a>
                </td>
              </tr>
              
              <!-- Divider -->
              <tr>
                <td style="padding: 0 32px;">
                  <hr style="border: none; border-top: 1px solid #E8ECF0; margin: 0;" />
                </td>
              </tr>
              
              <!-- Benefits Block -->
              <tr>
                <td style="padding: 24px 32px;">
                  <p style="font-size: 14px; font-weight: 700; color: #1A1A1A; margin: 0 0 14px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                    Your quote includes:
                  </p>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr><td style="padding: 5px 0; font-size: 14px; color: #333333;">&#10003;&nbsp;&nbsp;Comprehensive mechanical &amp; electrical cover</td></tr>
                    <tr><td style="padding: 5px 0; font-size: 14px; color: #333333;">&#10003;&nbsp;&nbsp;UK-based customer support</td></tr>
                    <tr><td style="padding: 5px 0; font-size: 14px; color: #333333;">&#10003;&nbsp;&nbsp;Fast claims approval</td></tr>
                    <tr><td style="padding: 5px 0; font-size: 14px; color: #333333;">&#10003;&nbsp;&nbsp;14-day money-back guarantee</td></tr>
                  </table>
                </td>
              </tr>
              
              <!-- Divider -->
              <tr>
                <td style="padding: 0 32px;">
                  <hr style="border: none; border-top: 1px solid #E8ECF0; margin: 0;" />
                </td>
              </tr>
              
              <!-- What Happens Next -->
              <tr>
                <td style="padding: 24px 32px;">
                  <p style="font-size: 14px; font-weight: 700; color: #1A1A1A; margin: 0 0 6px 0;">
                    What happens next?
                  </p>
                  <p style="font-size: 14px; color: #555555; margin: 0; line-height: 1.5;">
                    You'll return to your saved quote. You can review or edit details before paying.
                  </p>
                </td>
              </tr>
              
              <!-- Divider -->
              <tr>
                <td style="padding: 0 32px;">
                  <hr style="border: none; border-top: 1px solid #E8ECF0; margin: 0;" />
                </td>
              </tr>
              
              <!-- Social Proof -->
              <tr>
                <td align="center" style="padding: 24px 32px;">
                  <a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" style="text-decoration: none;">
                    <img src="https://buyawarranty.co.uk/lovable-uploads/4e4faf8a-b202-4101-a858-9c58ad0a28c5.png" alt="Trustpilot" width="120" style="display: block; width: 120px; max-width: 100%; height: auto; margin: 0 auto;" />
                  </a>
                  <p style="font-size: 13px; margin: 10px 0 0 0;">
                    <a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" style="color: #555555; text-decoration: underline;">Read reviews on Trustpilot</a>
                  </p>
                </td>
              </tr>
              
              <!-- Divider -->
              <tr>
                <td style="padding: 0 32px;">
                  <hr style="border: none; border-top: 1px solid #E8ECF0; margin: 0;" />
                </td>
              </tr>
              
              <!-- Help Contact -->
              <tr>
                <td align="center" style="padding: 24px 32px;">
                  <p style="font-size: 15px; font-weight: 600; color: #1A1A1A; margin: 0 0 10px 0;">
                    Prefer to speak to us?
                  </p>
                  <p style="font-size: 14px; color: #555555; margin: 0 0 4px 0;">
                    Email: <a href="mailto:support@buyawarranty.co.uk" style="color: #FF7A00; text-decoration: none;">support@buyawarranty.co.uk</a>
                  </p>
                  <p style="font-size: 14px; color: #555555; margin: 0;">
                    Phone: <a href="tel:03302295040" style="color: #FF7A00; text-decoration: none;">0330 229 5040</a>
                  </p>
                </td>
              </tr>
              
            </table>
            <!-- End Main Card -->
            
            <!-- Footer outside card -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 580px;">
              <tr>
                <td align="center" style="padding: 24px 16px 8px 16px;">
                  <p style="font-size: 12px; color: #999999; margin: 0 0 8px 0;">
                    <a href="${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}" style="color: #999999; text-decoration: underline;">Unsubscribe</a>
                  </p>
                  <p style="font-size: 11px; color: #AAAAAA; margin: 0; line-height: 1.5; text-align: center;">
                    Buyawarranty.co.uk is a trading name of Buy A Warranty Limited. Established 2016.<br/>
                    Registered in the United Kingdom under Company number: 10314863<br/>
                    Registered address: Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT, England
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
    // Subject line optimized for Primary inbox - conversational, no promotional language
    const customerName = data.firstName && data.firstName.trim() ? data.firstName.trim() : '';
    const emailSubject = customerName 
      ? `${customerName}, your ${data.vehicleData.regNumber} warranty quote`
      : `Your ${data.vehicleData.regNumber} warranty quote is ready`;
    
    const emailResponse = await resend.emails.send({
      from: "Buyawarranty Customer Care <noreply@buyawarranty.co.uk>",
      to: [data.email],
      reply_to: 'support@buyawarranty.co.uk',
      subject: emailSubject,
      headers: {
        'X-Entity-Ref-ID': `quote-${quoteId}-${Date.now()}`,
      },
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