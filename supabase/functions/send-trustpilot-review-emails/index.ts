import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);

const TRUSTPILOT_REVIEW_LINK = "https://uk.trustpilot.com/evaluate/buyawarranty.co.uk";

// Trustpilot sends their own emails at ~1 day and ~7 days via BCC on the welcome email.
// We only send our branded final nudge 14-17 days after purchase.
const REVIEW_EMAIL_AFTER_PURCHASE = { min: 14, max: 17 };

interface PolicyData {
  id: string;
  email: string;
  customer_id: string | null;
  created_at: string;
  policy_number: string;
}

// Our branded review email template (previously Email 3 — final nudge)
function getReviewEmailHtml(firstName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Before we close your request…</title>
  <style>
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 20px !important; }
      .content { padding: 25px 20px !important; }
      .cta-button { padding: 16px 32px !important; font-size: 16px !important; display: block !important; text-align: center !important; }
      .text { font-size: 15px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background:#f5f5f5; font-family:Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5; padding:30px 0;">
    <tr>
      <td align="center">
        <table class="container" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; padding:40px; border-radius:8px;">
          <!-- Logo -->
          <tr>
            <td style="text-align:center; padding-bottom:30px;">
              <img src="https://buyawarranty.co.uk/images/buyawarranty-logo.png" alt="Buy A Warranty" style="max-width:200px; height:auto;" />
            </td>
          </tr>
          
          <tr>
            <td class="text" style="font-size:18px; color:#222;">
              Hi ${firstName},
            </td>
          </tr>

          <tr><td style="height:20px;"></td></tr>

          <tr>
            <td class="text" style="font-size:16px; color:#444; line-height:1.6;">
              This is just a quick final reminder.
              <br><br>
              If you haven't had the chance yet, we'd be grateful if you could share a brief review of your experience with <strong>BuyAWarranty.co.uk</strong>.
              <br><br>
              Even a few words help other drivers make informed decisions.
            </td>
          </tr>

          <tr><td style="height:25px;"></td></tr>

          <tr>
            <td align="center">
              <a href="${TRUSTPILOT_REVIEW_LINK}" class="cta-button" style="background:#00b67a; color:#ffffff; text-decoration:none; font-size:16px; padding:16px 40px; border-radius:6px; display:inline-block; font-weight:600;">
                Share Your Experience on Trustpilot
              </a>
            </td>
          </tr>

          <tr><td style="height:30px;"></td></tr>

          <tr>
            <td class="text" style="font-size:16px; color:#444; line-height:1.6;">
              Thanks for taking the time,<br>
              <strong>The BuyAWarranty.co.uk Team</strong>
            </td>
          </tr>

          <!-- Footer -->
          <tr><td style="height:30px;"></td></tr>
          <tr>
            <td style="border-top:1px solid #e5e5e5; padding-top:25px; text-align:center;">
              <p style="margin:0; color:#888888; font-size:13px;">Your trusted warranty partner</p>
              <p style="margin:5px 0 0 0; color:#888888; font-size:13px;">BuyAWarranty.co.uk</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[TRUSTPILOT-REVIEW] Starting review email batch (single email, 14-17 days after purchase)...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let successCount = 0;
    let failCount = 0;

    // Calculate date range: policies created 14-17 days ago
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - REVIEW_EMAIL_AFTER_PURCHASE.max);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setDate(endDate.getDate() - REVIEW_EMAIL_AFTER_PURCHASE.min);
    endDate.setHours(23, 59, 59, 999);

    console.log("[TRUSTPILOT-REVIEW] Date range:", {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });

    // Get active policies in the window
    const { data: candidatePolicies, error: policiesError } = await supabase
      .from("customer_policies")
      .select("id, email, customer_id, created_at, policy_number, status")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .in("status", ["active", "scheduled"])
      .not("email", "is", null);

    if (policiesError) {
      console.error("[TRUSTPILOT-REVIEW] Error fetching policies:", policiesError);
    }

    if (candidatePolicies && candidatePolicies.length > 0) {
      // Filter out policies that already received our review email (sequence 3)
      const policyIds = candidatePolicies.map((p: PolicyData) => p.id);
      const { data: alreadySent } = await supabase
        .from("trustpilot_review_emails")
        .select("policy_id")
        .in("policy_id", policyIds)
        .eq("email_sequence_number", 3);

      const sentPolicyIds = new Set(alreadySent?.map((s: { policy_id: string }) => s.policy_id) || []);
      const policiesToEmail = candidatePolicies.filter((p: PolicyData) => !sentPolicyIds.has(p.id));

      console.log(`[TRUSTPILOT-REVIEW] ${policiesToEmail.length} policies need review email`);

      for (const policy of policiesToEmail) {
        try {
          const { data: customer } = await supabase
            .from("customers")
            .select("first_name, trustpilot_review_completed, status")
            .eq("id", policy.customer_id)
            .single();

          // Skip if customer has already left a review
          if (customer?.trustpilot_review_completed) {
            console.log(`[TRUSTPILOT-REVIEW] Skipping ${policy.email} - review already completed`);
            continue;
          }

          // Skip if customer has been cancelled or refunded
          const customerStatus = (customer?.status || '').toLowerCase();
          if (customerStatus === 'cancelled' || customerStatus === 'refunded' || customerStatus === 'canceled') {
            console.log(`[TRUSTPILOT-REVIEW] Skipping ${policy.email} - customer status: ${customerStatus}`);
            continue;
          }

          const firstName = customer?.first_name || "Valued Customer";

          const emailResult = await resend.emails.send({
            from: "BuyAWarranty.co.uk <reviews@buyawarranty.co.uk>",
            to: [policy.email],
            subject: "Before we close your request…",
            html: getReviewEmailHtml(firstName),
          });

          console.log(`[TRUSTPILOT-REVIEW] Review email sent to ${policy.email}:`, emailResult);

          // Track with sequence_number 3 for backward compatibility
          await supabase.from("trustpilot_review_emails").insert({
            policy_id: policy.id,
            customer_id: policy.customer_id,
            email: policy.email,
            email_sequence_number: 3,
            email_subject: "Before we close your request…",
            next_email_scheduled_for: null,
          });

          successCount++;
        } catch (error) {
          console.error(`[TRUSTPILOT-REVIEW] Error sending review email to ${policy.email}:`, error);
          failCount++;
        }
      }
    }

    console.log(`[TRUSTPILOT-REVIEW] Batch complete: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Trustpilot review email processed",
        sent: successCount,
        failed: failCount,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("[TRUSTPILOT-REVIEW] Fatal error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
