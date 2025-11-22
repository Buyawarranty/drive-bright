import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReferralEmailRequest {
  friendEmail: string;
  referrerName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { friendEmail, referrerName, referrerEmail }: ReferralEmailRequest & { referrerEmail?: string } = await req.json();

    if (!friendEmail || !friendEmail.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Valid email is required' }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate a unique discount code for this referral
    const discountCode = `FRIEND-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    
    // Create discount code in database
    const { data: discountData, error: discountError } = await supabase
      .from('discount_codes')
      .insert({
        code: discountCode,
        type: 'fixed',
        value: 30,
        valid_from: new Date().toISOString(),
        valid_to: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        usage_limit: 1,
        campaign_source: 'referral',
        is_referral_code: true,
        referrer_email: referrerEmail || null
      })
      .select()
      .single();

    if (discountError) {
      console.error("Error creating discount code:", discountError);
      throw new Error("Failed to create discount code");
    }

    // Track referral in database
    const { error: referralError } = await supabase
      .from('referrals')
      .insert({
        referrer_email: referrerEmail || 'unknown',
        referrer_name: referrerName,
        friend_email: friendEmail,
        discount_code: discountCode,
        discount_code_id: discountData.id,
        status: 'sent'
      });

    if (referralError) {
      console.error("Error tracking referral:", referralError);
    }

    const emailResponse = await resend.emails.send({
      from: "Buy-A-Warranty <onboarding@resend.dev>",
      to: [friendEmail],
      subject: "I Just Got My Vehicle Covered – Thought You Might Like This 🚗✨",
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0B0B0B; font-size: 24px; margin-bottom: 20px;">Hi there,</h2>
          
          <p style="color: #0B0B0B; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">
            Hope you're well! I just sorted out a warranty for my vehicle through Buy-A-Warranty, and I genuinely think you'd like it too.
          </p>
          
          <p style="color: #0B0B0B; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">
            They make the whole process super easy, the cover is solid, and the customer service has been great. If you're thinking about protecting your car or van, it's definitely worth a look.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://www.buyawarranty.co.uk" 
               style="background-color: #FF6B00; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">
              Get Your Warranty Quote
            </a>
          </div>
          
          <p style="color: #0B0B0B; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">
            Plus, use the code <strong style="color: #FF6B00;">${discountCode}</strong> to get £30 off your warranty – it's a win-win! 😄
          </p>
          
          <p style="color: #0B0B0B; font-size: 16px; line-height: 1.6; margin-bottom: 15px;">
            Let me know if you have any questions – happy to share my experience.
          </p>
          
          <p style="color: #0B0B0B; font-size: 16px; line-height: 1.6; margin-top: 30px;">
            Cheers,<br>
            <strong>${referrerName}</strong>
          </p>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center;">
            <p style="color: #666; font-size: 14px;">
              <a href="https://www.buyawarranty.co.uk" style="color: #FF6B00; text-decoration: none;">www.buyawarranty.co.uk</a><br>
              Your trusted warranty partner
            </p>
          </div>
        </div>
      `,
    });

    console.log("Referral email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending referral email:", error);
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
