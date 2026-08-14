import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { logCustomerEmail } from '../_shared/log-email.ts';
import { getPurchasedEmails } from '../_shared/purchase-guard.ts';
import { buildUnsubscribeFooter } from "../_shared/unsubscribe-footer.ts";
import { EMAIL_RESPONSIVE_STYLE } from "../_shared/email-layout.ts";

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

    // Check blocklist
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.0");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const customerEmails = customers.map(c => c.email.trim().toLowerCase());
    const { data: blockedEmails } = await supabase
      .from('email_unsubscribes')
      .select('email')
      .in('email', customerEmails);
    const blockedSet = new Set((blockedEmails || []).map((b: any) => b.email));

    // Also respect the "stop quote reminders" (essentials-only) choice
    const { data: essentialsRows } = await supabase
      .from('marketing_audience')
      .select('email')
      .in('email', customerEmails)
      .eq('frequency', 'essentials');
    for (const row of essentialsRows || []) blockedSet.add((row as any).email);

    // Hard stop: never remind someone to buy when they have already purchased
    const purchasedSet = await getPurchasedEmails(supabase, customerEmails);
    for (const e of purchasedSet) blockedSet.add(e);
    if (purchasedSet.size > 0) {
      console.log(`⛔ Filtered out ${purchasedSet.size} recipients who already purchased`);
    }

    const filteredCustomers = customers.filter(c => !blockedSet.has(c.email.trim().toLowerCase()));

    if (blockedSet.size > 0) {
      console.log(`⛔ Filtered out ${blockedSet.size} blocked/unsubscribed emails`);
    }

    console.log(`📨 Sending reminder emails to ${filteredCustomers.length} customers (${blockedSet.size} blocked)...`);

    const emailPromises = filteredCustomers.map(async (customer) => {
      const firstName = customer.full_name?.split(' ')[0] || 'there';
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Complete Your Car Warranty</title>
          ${EMAIL_RESPONSIVE_STYLE}
        </head>
        <body class="baw-wrap baw-pad-sm" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f97316; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Buy A Warranty</h1>
          </div>
          
          <div class="baw-pad-sm" style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
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
              <a href="https://buyawarranty.co.uk/" class="baw-btn"
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
          
          <div class="baw-wrap" style="max-width: 600px; margin: 20px auto 0;">
            ${buildUnsubscribeFooter(customer.email, {
              title: 'No longer interested in your warranty quote?',
              blurb: "That's okay. You can stop these quote reminders or unsubscribe from all marketing emails.",
              softLabel: 'Stop quote reminders',
              reason: 'You received this email because you requested a warranty quote from Buy A Warranty.',
            })}
          </div>
        </body>
        </html>
      `;

      try {
        const { data, error } = await resend.emails.send({
          from: "BuyaWarranty Team <info@buyawarranty.co.uk>",
          to: [customer.email],
          subject: "Your car's warranty is almost ready – just one more step!",
          html: htmlContent,
        });

        if (error) {
          console.error(`❌ Failed to send email to ${customer.email}:`, error);
          return { success: false, email: customer.email, error };
        }

        console.log(`✅ Email sent successfully to ${customer.email}`);

        await logCustomerEmail({
          recipient_email: customer.email,
          recipient_name: customer.full_name,
          subject: "Your car's warranty is almost ready – just one more step!",
          template_name: 'bulk_reminder',
          source_function: 'send-bulk-reminder-emails',
          status: 'sent',
          registration_plate: customer.vehicle_reg,
          metadata: { step_abandoned: customer.step_abandoned }
        });

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
