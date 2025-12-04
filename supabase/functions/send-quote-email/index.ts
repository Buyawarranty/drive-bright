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
  const { vehicleData, firstName, lastName, selectedPlan, quoteId } = data;
  const customerName = firstName || 'Valued Customer';
  
  // Calculate cover period with seasonal bonus
  const basePeriod = selectedPlan?.paymentType === 'monthly' || selectedPlan?.paymentType === 'yearly' || selectedPlan?.paymentType === '12months' ? '12 months' :
                     selectedPlan?.paymentType === '24months' ? '24 months' :
                     selectedPlan?.paymentType === '36months' ? '36 months' : '12 months';
  const totalPeriod = selectedPlan?.paymentType === 'monthly' || selectedPlan?.paymentType === 'yearly' || selectedPlan?.paymentType === '12months' ? '15 months' :
                      selectedPlan?.paymentType === '24months' ? '27 months' :
                      selectedPlan?.paymentType === '36months' ? '39 months' : '15 months';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Warranty Quote</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="Buy A Warranty" style="width: 180px; height: auto;" />
      </div>
      
      <div style="background: #f8fafc; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
        <p style="font-size: 16px; margin-bottom: 20px;">
          👋 Hi ${customerName},
        </p>
        
        <p style="font-size: 16px; margin-bottom: 20px;">
          Thank you for considering BuyAWarranty.co.uk for your vehicle protection. Please find your quote details below:
        </p>
        
        <h3 style="color: #1e293b; margin-top: 30px; margin-bottom: 15px;">📋 Quote Summary:</h3>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><strong>🚗 Vehicle:</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${vehicleData.make || ''} ${vehicleData.model || ''}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><strong>🔢 Registration:</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${vehicleData.regNumber}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><strong>📊 Mileage:</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${vehicleData.mileage} miles</td>
            </tr>
            ${selectedPlan ? `
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><strong>🛡️ Plan:</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${selectedPlan.name}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><strong>💳 Payment:</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${formatPaymentType(selectedPlan.paymentType)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><strong>💰 Price:</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">£${selectedPlan.price}/${selectedPlan.paymentType === 'monthly' || selectedPlan.paymentType === '12months' ? 'month' : 'year'} (interest-free)</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><strong>💵 Excess:</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">£100</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><strong>📈 Claim Limit:</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">£1,250</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><strong>✅ Claims:</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">Unlimited Claims up to the value of your vehicle</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><strong>📅 Cover Period:</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${basePeriod} + 3 extra months free (total ${totalPeriod})</td>
            </tr>
            <tr>
              <td style="padding: 10px 0;"><strong>🔧 Coverage:</strong></td>
              <td style="padding: 10px 0;">All mechanical and electrical parts, including labour.</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${baseUrl}/?quoteId=${quoteId}" style="background-color: #ea580c; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; display: inline-block;">
            Resume Purchase
          </a>
        </div>
        
        <p style="font-size: 16px; margin-bottom: 20px;">
          For complete coverage details, please visit:<br>
          <a href="https://buyawarranty.co.uk/what-is-covered/" style="color: #ea580c; text-decoration: underline;">https://buyawarranty.co.uk/what-is-covered/</a>
        </p>
        
        <p style="font-size: 16px; margin-bottom: 20px;">
          If you have any questions about this quote or would like to proceed, please contact Mike Swan on 📞 0330 229 5040.
        </p>
        
        <p style="font-size: 16px; margin-top: 30px;">
          Thank you for your interest in BuyAWarranty.co.uk.
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
        <p style="font-size: 14px; color: #64748b; margin-bottom: 5px;">
          <strong>The BuyAWarranty.co.uk Team</strong>
        </p>
        <p style="font-size: 13px; color: #64748b; margin: 5px 0;">
          📞 Customer Service & Sales: 0330 229 5040
        </p>
        <p style="font-size: 13px; color: #64748b; margin: 5px 0;">
          📞 Claims Line: 0330 229 5045
        </p>
        <p style="font-size: 13px; color: #64748b; margin: 5px 0;">
          🌐 <a href="https://www.buyawarranty.co.uk" style="color: #ea580c; text-decoration: none;">www.buyawarranty.co.uk</a> | 📧 <a href="mailto:info@buyawarranty.co.uk" style="color: #ea580c; text-decoration: none;">info@buyawarranty.co.uk</a>
        </p>
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

    const emailResponse = await resend.emails.send({
      from: "BuyaWarranty <noreply@buyawarranty.co.uk>",
      to: [data.email],
      subject: `Your Warranty Quote - ${data.vehicleData.regNumber}`,
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