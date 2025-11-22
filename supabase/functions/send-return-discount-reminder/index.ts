import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderRequest {
  email: string;
  customerName: string;
  discountCode: string;
  daysRemaining: number;
  reminderType: 'urgency' | 'final';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, customerName, discountCode, daysRemaining, reminderType }: ReminderRequest = await req.json();

    console.log(`Sending ${reminderType} reminder to ${email}`);

    const isUrgency = reminderType === 'urgency';
    const subject = isUrgency 
      ? "Only 9 days left to save 20%" 
      : "Final chance: 20% off ends tomorrow";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px 40px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">
                        ${isUrgency ? '⏰ Time is Running Out!' : '🚨 Last Chance!'}
                      </h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                        Hi ${customerName},
                      </p>
                      
                      <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                        ${isUrgency 
                          ? "Your exclusive 20% discount is expiring soon! Don't miss out on this opportunity to protect another vehicle at a great price."
                          : "This is your final reminder! Your 20% discount expires tomorrow. Secure your warranty now before it's too late."
                        }
                      </p>

                      <!-- Countdown Box -->
                      <div style="background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%); border-left: 4px solid #f97316; padding: 20px; margin: 30px 0; border-radius: 4px;">
                        <p style="color: #ea580c; font-size: 18px; font-weight: bold; margin: 0 0 10px;">
                          ${isUrgency ? '⏰ 9 Days Remaining' : '⏰ Ends Tomorrow!'}
                        </p>
                        <p style="color: #9a3412; font-size: 14px; margin: 0;">
                          Your discount code: <strong style="font-size: 16px; font-family: monospace;">${discountCode}</strong>
                        </p>
                      </div>

                      <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                        <strong>Why Choose Us?</strong>
                      </p>
                      <ul style="color: #555555; font-size: 15px; line-height: 1.8; padding-left: 20px;">
                        <li>Comprehensive coverage for peace of mind</li>
                        <li>Fast and easy claims process</li>
                        <li>Flexible payment options</li>
                        <li>Trusted by thousands of customers</li>
                      </ul>

                      <!-- CTA Button -->
                      <div style="text-align: center; margin: 40px 0 30px;">
                        <a href="https://buyawarranty.co.uk?returnDiscount=true&code=${discountCode}" 
                           style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                          ${isUrgency ? 'Claim Your 20% Discount' : 'Get Your Warranty Now'}
                        </a>
                      </div>

                      <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 30px 0 0; padding-top: 20px; border-top: 1px solid #e5e5e5;">
                        Questions? Contact our team at <a href="mailto:support@buyawarranty.co.uk" style="color: #f97316;">support@buyawarranty.co.uk</a>
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9fafb; padding: 20px 40px; text-align: center; border-top: 1px solid #e5e5e5;">
                      <p style="color: #6b7280; font-size: 12px; margin: 0;">
                        © ${new Date().getFullYear()} Buy A Warranty. All rights reserved.
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

    const emailResponse = await resend.emails.send({
      from: "Buy A Warranty <support@buyawarranty.co.uk>",
      to: [email],
      subject,
      html: emailHtml,
    });

    console.log(`${reminderType} reminder sent successfully:`, emailResponse);

    // Log the email in Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from('email_logs').insert({
      recipient_email: email,
      template_id: null,
      subject,
      delivery_status: 'sent',
      resend_id: emailResponse.id,
      metadata: {
        reminderType,
        discountCode,
        daysRemaining
      }
    });

    return new Response(
      JSON.stringify({ success: true, emailId: emailResponse.id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending return discount reminder:", error);
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
