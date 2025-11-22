import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IncompleteCustomer {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  vehicle_reg?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  mileage?: string;
  plan_name?: string;
  payment_type?: string;
  step_abandoned: number;
  created_at: string;
  cart_metadata?: any;
}

interface BulkEmailRequest {
  customers: IncompleteCustomer[];
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("📧 Starting bulk reminder email send...");
    
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);
    const { customers }: BulkEmailRequest = await req.json();

    if (!customers || customers.length === 0) {
      return new Response(
        JSON.stringify({ error: "No customers provided" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`📨 Sending reminder emails to ${customers.length} customers...`);

    const emailPromises = customers.map(async (customer) => {
      const firstName = customer.full_name?.split(' ')[0] || 'there';
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Complete Your Car Warranty</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f97316; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Buy A Warranty</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Hi ${firstName},</h2>
            
            <p style="font-size: 16px; line-height: 1.8;">
              Just a quick reminder — you were moments away from securing your car warranty with Buy A Warranty, 
              but it looks like the checkout wasn't completed.
            </p>
            
            <p style="font-size: 16px; line-height: 1.8;">
              We've saved your quote so you don't have to start over. It only takes a minute to finish, 
              and your car will be covered in no time.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://buyawarranty.co.uk/" 
                 style="background-color: #f97316; color: white; padding: 15px 30px; text-decoration: none; 
                        border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">
                Complete Your Purchase Now
              </a>
            </div>
            
            <p style="font-size: 16px; line-height: 1.8;">
              Need help or have a quick question? Just reply to this email or call us on 
              <strong>0330 229 5040</strong> - we're here to help.
            </p>
            
            <p style="font-size: 16px; line-height: 1.8;">
              Don't wait too long — protect your car today and avoid unexpected repair bills.
            </p>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 5px 0;"><strong>Cheers,</strong></p>
              <p style="margin: 5px 0;">The Buy A Warranty Team</p>
              <p style="margin: 5px 0;">📞 0330 229 5040</p>
              <p style="margin: 5px 0;">📧 info@buyawarranty.co.uk</p>
              <p style="margin: 5px 0;">🌐 <a href="https://www.buyawarranty.co.uk" style="color: #f97316;">www.buyawarranty.co.uk</a></p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;">
            <p>This email was sent to remind you about your incomplete warranty purchase.</p>
            <p>If you no longer wish to receive these emails, please contact us.</p>
          </div>
        </body>
        </html>
      `;

      try {
        const { data, error } = await resend.emails.send({
          from: "Buy A Warranty <info@buyawarranty.co.uk>",
          to: [customer.email],
          subject: "Your car's warranty is almost ready – just one more step!",
          html: htmlContent,
        });

        if (error) {
          console.error(`❌ Failed to send email to ${customer.email}:`, error);
          return { success: false, email: customer.email, error };
        }

        console.log(`✅ Email sent successfully to ${customer.email}`);
        return { success: true, email: customer.email, data };
      } catch (error) {
        console.error(`❌ Exception sending email to ${customer.email}:`, error);
        return { success: false, email: customer.email, error };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`✅ Bulk email send complete. Success: ${successCount}, Failed: ${failureCount}`);

    return new Response(
      JSON.stringify({
        message: `Sent ${successCount} emails successfully`,
        successCount,
        failureCount,
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("❌ Error in send-bulk-reminder-emails function:", error);
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
