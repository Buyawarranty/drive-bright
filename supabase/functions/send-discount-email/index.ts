import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const logStep = (step: string, data?: any) => {
  console.log(`[SEND-DISCOUNT-EMAIL] ${step}`, data ? JSON.stringify(data) : '');
};

interface DiscountEmailRequest {
  email: string;
  discountCode: string;
  discountAmount: number;
}

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

    const { email, discountCode, discountAmount }: DiscountEmailRequest = await req.json();
    
    logStep('Sending discount email', { email, discountCode, discountAmount });

    const resend = new Resend(resendApiKey);

    const emailResponse = await resend.emails.send({
      from: "BuyaWarranty <noreply@buyawarranty.co.uk>",
      to: [email],
      subject: `Your £${discountAmount} Discount Code - ${discountCode}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Discount Code</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">buya<span style="color: #ea580c;">warranty</span></h1>
          </div>
          
          <div style="background: #f8fafc; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <h2 style="color: #1e293b; margin-top: 0;">Your Discount Code is Ready! 🎉</h2>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Great news! Here's your exclusive £${discountAmount} discount code:
            </p>
            
            <div style="background: white; border: 2px solid #22c55e; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <div style="font-size: 24px; font-weight: bold; color: #16a34a; font-family: monospace; letter-spacing: 2px;">
                ${discountCode}
              </div>
            </div>
            
            <p style="font-size: 14px; color: #64748b; text-align: center; margin-top: 15px;">
              Simply enter this code at checkout to save £${discountAmount} on your warranty
            </p>
          </div>
          
          <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px;">
            <h3 style="color: #1e293b; margin-top: 0;">Ready to get protected?</h3>
            <p>Visit our website to continue with your warranty quote and apply your discount.</p>
            
            <div style="text-align: center; margin: 20px 0;">
              <a href="https://buyawarranty.co.uk" style="background: #ea580c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Get My Warranty
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="font-size: 12px; color: #64748b;">
              This discount code is valid for a limited time. Questions? Contact us at info@buyawarranty.co.uk
            </p>
          </div>
        </body>
        </html>
      `,
    });

    logStep('Email sent successfully', emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error('Error in send-discount-email function:', error);
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