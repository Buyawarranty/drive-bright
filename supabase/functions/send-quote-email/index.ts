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
  
  // Quote restoration link - goes directly to step 3
  const quoteLink = `${baseUrl}/?quote=${quoteId}&email=${encodeURIComponent(email)}&step=3`;
  
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
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #ffffff; -webkit-font-smoothing: antialiased;">
      
      <!-- Wrapper Table -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #ffffff;">
        <tr>
          <td align="center" style="padding: 20px 10px;">
            
            <!-- Main Container -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 600px; background-color: #ffffff;">
              
              <!-- Header with Logo -->
              <tr>
                <td align="center" style="padding: 30px 30px 20px 30px;">
                  <a href="https://buyawarranty.co.uk" target="_blank">
                    <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="buyawarranty" width="180" style="display: block; width: 180px; height: auto;" />
                  </a>
                </td>
              </tr>
              
              <!-- Main Content -->
              <tr>
                <td style="padding: 0 30px 20px 30px;">
                  <p style="font-size: 16px; color: #333333; margin: 0 0 20px 0;">
                    Hi ${customerName},
                  </p>
                  <p style="font-size: 16px; color: #333333; margin: 0 0 20px 0; line-height: 1.7;">
                    Thank you for your interest in warranty cover for your <strong>${vehicleDisplay}</strong> (${vehicleData.regNumber}).
                  </p>
                  <p style="font-size: 16px; color: #333333; margin: 0 0 20px 0; line-height: 1.7;">
                    We noticed you didn't complete your purchase. Your quote details have been saved, and you can continue where you left off using the link below.
                  </p>
                </td>
              </tr>
              
              <!-- Quote Details Box -->
              <tr>
                <td style="padding: 0 30px 25px 30px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="font-size: 14px; font-weight: 600; color: #333333; margin: 0 0 12px 0;">
                          Your Quote Reference: ${quoteId}
                        </p>
                        <p style="font-size: 14px; color: #555555; margin: 0 0 8px 0;">
                          Vehicle: ${vehicleDisplay}
                        </p>
                        <p style="font-size: 14px; color: #555555; margin: 0;">
                          Registration: ${vehicleData.regNumber}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- CTA Button -->
              <tr>
                <td align="center" style="padding: 0 30px 25px 30px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center">
                        <a href="${quoteLink}" target="_blank" style="display: inline-block; background-color: #ea580c; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                          Continue Your Quote
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Additional Info -->
              <tr>
                <td style="padding: 0 30px 25px 30px;">
                  <p style="font-size: 14px; color: #666666; margin: 0 0 15px 0; line-height: 1.7;">
                    If you have any questions about your quote or our warranty cover, please don't hesitate to get in touch. Our team is happy to help.
                  </p>
                </td>
              </tr>
              
              <!-- Divider -->
              <tr>
                <td style="padding: 0 30px;">
                  <hr style="border: none; border-top: 1px solid #e9ecef; margin: 0;" />
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 25px 30px;">
                  <p style="font-size: 14px; color: #333333; margin: 0 0 15px 0;">
                    Kind regards,<br />
                    <strong>The Buy A Warranty Team</strong>
                  </p>
                  <p style="font-size: 13px; color: #666666; margin: 0 0 8px 0;">
                    Email: <a href="mailto:support@buyawarranty.co.uk" style="color: #ea580c; text-decoration: none;">support@buyawarranty.co.uk</a>
                  </p>
                  <p style="font-size: 13px; color: #666666; margin: 0 0 8px 0;">
                    Phone: <a href="tel:03302295040" style="color: #ea580c; text-decoration: none;">0330 229 5040</a>
                  </p>
                  <p style="font-size: 13px; color: #666666; margin: 0;">
                    <a href="https://www.buyawarranty.co.uk" style="color: #ea580c; text-decoration: none;">buyawarranty.co.uk</a>
                  </p>
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