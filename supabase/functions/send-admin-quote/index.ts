import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuoteEmailRequest {
  to: string;
  subject: string;
  content: string;
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
    price: number;
    excessAmount: string;
    claimLimit: string;
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
      subject,
      content,
      vehicleData,
      quoteDetails,
    }: QuoteEmailRequest = await req.json();

    console.log("Sending quote email to:", to);

    // Convert plain text content to HTML with proper formatting
    const htmlContent = content
      .split('\n')
      .map(line => {
        // Handle headings
        if (line.includes("What's Covered?") || 
            line.includes("Why Choose Buyawarranty?") || 
            line.includes("Your Quote:")) {
          return `<h2 style="color: #1a1a1a; font-size: 20px; font-weight: bold; margin: 24px 0 12px 0;">${line}</h2>`;
        }
        // Handle bullet points
        if (line.trim().startsWith('✓') || line.trim().startsWith('•')) {
          return `<p style="margin: 6px 0; padding-left: 20px;">${line}</p>`;
        }
        // Handle links
        if (line.includes('https://buyawarranty.co.uk')) {
          return `<p style="margin: 12px 0;"><a href="https://buyawarranty.co.uk" style="color: #eb4b00; text-decoration: none; font-weight: bold;">Click here to get protected →</a></p>`;
        }
        // Handle empty lines
        if (line.trim() === '') {
          return '<br />';
        }
        // Regular paragraphs
        return `<p style="margin: 8px 0;">${line}</p>`;
      })
      .join('');

    const finalHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #eb4b00; margin: 0; font-size: 28px;">Buy A Warranty</h1>
            </div>
            
            <div style="color: #333; font-size: 16px;">
              ${htmlContent}
            </div>

            <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #f0f0f0; text-align: center; color: #666; font-size: 14px;">
              <p style="margin: 8px 0;"><strong>Buy A Warranty</strong></p>
              <p style="margin: 8px 0;">Customer Service & Sales: <a href="tel:03302295040" style="color: #eb4b00; text-decoration: none;">0330 229 5040</a></p>
              <p style="margin: 8px 0;">Claimsline: <a href="tel:03302295045" style="color: #eb4b00; text-decoration: none;">0330 229 5045</a></p>
              <p style="margin: 8px 0;"><a href="https://buyawarranty.co.uk" style="color: #eb4b00; text-decoration: none;">www.buyawarranty.co.uk</a></p>
              <p style="margin: 8px 0;"><a href="mailto:info@buyawarranty.co.uk" style="color: #eb4b00; text-decoration: none;">info@buyawarranty.co.uk</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Buy A Warranty <quotes@buyawarranty.co.uk>",
      to: [to],
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
