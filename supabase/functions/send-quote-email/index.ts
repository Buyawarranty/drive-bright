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
  const vehicleDisplay = `${vehicleData.make || ''} ${vehicleData.model || ''}`.trim() || 'your vehicle';
  
  // Green checkmark icon matching website style - bright green tick
  const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 12px;"><path d="M20 6L9 17l-5-5"></path></svg>`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your ${vehicleDisplay} Warranty Quote is Ready</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f5f5f5;">
      <div style="background-color: #ffffff; margin: 20px; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        
        <!-- Header - Light yellow/cream -->
        <div style="background: #FFF8E7; padding: 30px; text-align: center;">
          <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="Buy A Warranty" style="width: 180px; height: auto; margin-bottom: 15px;" />
          <h1 style="color: #000000; font-size: 22px; font-weight: bold; margin: 0 0 8px 0;">
            Your ${vehicleDisplay} Warranty Quote
          </h1>
          <p style="color: #666666; font-size: 14px; margin: 0;">
            Registration: <strong>${vehicleData.regNumber}</strong>
          </p>
        </div>
        
        <!-- Main Content -->
        <div style="padding: 30px;">
          <p style="font-size: 16px; color: #333; margin-bottom: 25px;">
            Great news! Your personalised warranty quote for your <strong>${vehicleDisplay}</strong> is ready and waiting.
          </p>
          
          <!-- Benefits List -->
          <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <p style="font-size: 14px; color: #166534; font-weight: 600; margin: 0 0 15px 0; text-transform: uppercase; letter-spacing: 0.5px;">
              Your Quote Includes:
            </p>
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="padding: 10px 0; font-size: 16px; color: #166534;">
                  ${checkIcon}
                  <span style="vertical-align: middle;">Comprehensive mechanical & electrical cover</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-size: 16px; color: #166534;">
                  ${checkIcon}
                  <span style="vertical-align: middle;">UK-based support & hassle-free claims</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-size: 16px; color: #166534;">
                  ${checkIcon}
                  <span style="vertical-align: middle;">14-day money-back guarantee</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-size: 16px; color: #166534;">
                  ${checkIcon}
                  <span style="vertical-align: middle;">Instant protection when you activate</span>
                </td>
              </tr>
            </table>
          </div>
          
          <!-- CTA Button - Orange with enhanced glow effect -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/?quoteId=${quoteId}" style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); color: #ffffff; padding: 20px 45px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 20px; display: inline-block; box-shadow: 0 0 20px rgba(249, 115, 22, 0.5), 0 0 40px rgba(249, 115, 22, 0.3), 0 8px 20px rgba(234, 88, 12, 0.4); border: 2px solid #f97316;">
              View My Quote Now →
            </a>
          </div>
          
          <!-- Urgency Text -->
          <p style="font-size: 14px; color: #666; text-align: center; margin-bottom: 25px;">
            Secure your warranty today – takes less than 60 seconds
          </p>
          
          <!-- Trust Elements -->
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px;">
            <!-- Trustpilot Logo -->
            <div style="text-align: center; margin-bottom: 20px;">
              <a href="https://uk.trustpilot.com/review/buyawarranty.co.uk" target="_blank" style="text-decoration: none;">
                <img src="https://buyawarranty.co.uk/lovable-uploads/4e4faf8a-b202-4101-a858-9c58ad0a28c5.png" alt="Trustpilot 5 stars" style="height: 40px; width: auto;" />
              </a>
            </div>
            
            <!-- Trust Points -->
            <div style="text-align: center; color: #666; font-size: 14px;">
              <span style="margin: 0 8px;">No hidden fees</span> | 
              <span style="margin: 0 8px;">FCA compliant</span> |
              <span style="margin: 0 8px;">14-day refund</span>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8fafc; padding: 25px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="font-size: 14px; color: #1a1a1a; font-weight: 600; margin: 0 0 15px 0;">
            Questions? We're here to help
          </p>
          <p style="font-size: 14px; color: #64748b; margin: 5px 0;">
            📧 <a href="mailto:support@buyawarranty.co.uk" style="color: #ea580c; text-decoration: none;">support@buyawarranty.co.uk</a>
          </p>
          <p style="font-size: 14px; color: #64748b; margin: 5px 0;">
            📞 <a href="tel:03302295040" style="color: #ea580c; text-decoration: none;">0330 229 5040</a>
          </p>
          <p style="font-size: 13px; color: #94a3b8; margin: 15px 0 0 0;">
            Best regards,<br>
            <strong>The Buy A Warranty Team</strong><br>
            <a href="https://www.buyawarranty.co.uk" style="color: #ea580c; text-decoration: none;">buyawarranty.co.uk</a>
          </p>
        </div>
      </div>
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
    
    logStep('Email URL generation', { baseUrl, quoteId });
    
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
    
    const emailResponse = await resend.emails.send({
      from: "BuyaWarranty <noreply@buyawarranty.co.uk>",
      to: [data.email],
      subject: `Your ${vehicleDisplay} Warranty Quote is Ready – Lock in Your Price Today`,
      html: htmlContent,
    });

    logStep('Email sent successfully', emailResponse);
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