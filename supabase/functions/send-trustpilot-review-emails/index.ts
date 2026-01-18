import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);

const TRUSTPILOT_REVIEW_LINK = "https://uk.trustpilot.com/evaluate/buyawarranty.co.uk";

// Email timing configuration (in days)
const EMAIL_TIMING = {
  email1_after_purchase: { min: 3, max: 7 },      // 3-7 days after purchase
  email2_after_email1: { min: 5, max: 7 },        // 5-7 days after Email 1
  email3_after_email2: { min: 7, max: 10 },       // 7-10 days after Email 2
};

interface PolicyData {
  id: string;
  email: string;
  customer_id: string | null;
  created_at: string;
  policy_number: string;
}

interface ReviewEmailRecord {
  id: string;
  policy_id: string;
  customer_id: string | null;
  email: string;
  sent_at: string;
  email_sequence_number: number;
  email_opened: boolean;
  email_clicked: boolean;
  review_completed: boolean;
  next_email_scheduled_for: string | null;
}

// Email 1 Template - Warm Welcome Check-In
function getEmail1Html(firstName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>How was your experience?</title>
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
              Thanks again for choosing <strong>BuyAWarranty.co.uk</strong>. We hope everything with your new warranty has been clear and straightforward so far.
              <br><br>
              We're always working to improve our service, and your experience helps other drivers choose protection they can rely on.
              <br><br>
              <strong>Could you spare 60 seconds to share your experience?</strong>
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
              Thanks so much for your time and support,<br>
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

// Email 2 Template - Polite Reminder
function getEmail2Html(firstName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your quick reminder</title>
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
              Just a gentle reminder in case you didn't get a moment to see our last message.
              <br><br>
              If you can spare a minute, we'd really appreciate your thoughts on your recent experience with <strong>BuyAWarranty.co.uk</strong>.
              <br><br>
              Your feedback helps other drivers choose trusted warranty protection.
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
              Thanks again — we truly appreciate it,<br>
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

// Email 3 Template - Final Short Nudge
function getEmail3Html(firstName: string): string {
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

// Get email content based on sequence number
function getEmailContent(sequenceNumber: number, firstName: string): { subject: string; html: string } {
  switch (sequenceNumber) {
    case 1:
      return {
        subject: "How was your experience with BuyAWarranty.co.uk?",
        html: getEmail1Html(firstName),
      };
    case 2:
      return {
        subject: "Your quick reminder from BuyAWarranty.co.uk",
        html: getEmail2Html(firstName),
      };
    case 3:
      return {
        subject: "Before we close your request…",
        html: getEmail3Html(firstName),
      };
    default:
      throw new Error(`Invalid sequence number: ${sequenceNumber}`);
  }
}

// Calculate next email scheduled date
function calculateNextEmailDate(sequenceNumber: number): Date | null {
  const now = new Date();
  
  switch (sequenceNumber) {
    case 1:
      // Schedule Email 2 for 5-7 days after Email 1 (use 5 days)
      now.setDate(now.getDate() + EMAIL_TIMING.email2_after_email1.min);
      return now;
    case 2:
      // Schedule Email 3 for 7-10 days after Email 2 (use 7 days)
      now.setDate(now.getDate() + EMAIL_TIMING.email3_after_email2.min);
      return now;
    case 3:
      // No more emails after Email 3
      return null;
    default:
      return null;
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[TRUSTPILOT-REVIEW] Starting Trustpilot review email sequence batch...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    let successCount = 0;
    let failCount = 0;
    const results: { email1: number; email2: number; email3: number } = { email1: 0, email2: 0, email3: 0 };

    // ============================================
    // PART 1: Send Email 1 to new customers
    // ============================================
    console.log("[TRUSTPILOT-REVIEW] Checking for Email 1 candidates (3-7 days after purchase)...");

    // Calculate date range for policies purchased 3-7 days ago
    const email1StartDate = new Date();
    email1StartDate.setDate(email1StartDate.getDate() - EMAIL_TIMING.email1_after_purchase.max);
    email1StartDate.setHours(0, 0, 0, 0);

    const email1EndDate = new Date();
    email1EndDate.setDate(email1EndDate.getDate() - EMAIL_TIMING.email1_after_purchase.min);
    email1EndDate.setHours(23, 59, 59, 999);

    console.log("[TRUSTPILOT-REVIEW] Email 1 date range:", {
      start: email1StartDate.toISOString(),
      end: email1EndDate.toISOString(),
    });

    // Get policies that haven't received any review emails yet
    const { data: newPolicies, error: newPoliciesError } = await supabase
      .from("customer_policies")
      .select("id, email, customer_id, created_at, policy_number")
      .gte("created_at", email1StartDate.toISOString())
      .lte("created_at", email1EndDate.toISOString())
      .eq("status", "active")
      .not("email", "is", null);

    if (newPoliciesError) {
      console.error("[TRUSTPILOT-REVIEW] Error fetching new policies:", newPoliciesError);
    }

    if (newPolicies && newPolicies.length > 0) {
      // Filter out policies that have already received any email
      const policyIds = newPolicies.map((p: PolicyData) => p.id);
      const { data: alreadySent } = await supabase
        .from("trustpilot_review_emails")
        .select("policy_id")
        .in("policy_id", policyIds);

      const sentPolicyIds = new Set(alreadySent?.map((s: { policy_id: string }) => s.policy_id) || []);
      const policiesToEmail = newPolicies.filter((p: PolicyData) => !sentPolicyIds.has(p.id));

      console.log(`[TRUSTPILOT-REVIEW] ${policiesToEmail.length} policies need Email 1`);

      for (const policy of policiesToEmail) {
        try {
          // Check if customer has already left a review
          const { data: customer } = await supabase
            .from("customers")
            .select("first_name, trustpilot_review_completed")
            .eq("id", policy.customer_id)
            .single();

          if (customer?.trustpilot_review_completed) {
            console.log(`[TRUSTPILOT-REVIEW] Skipping ${policy.email} - review already completed`);
            continue;
          }

          const firstName = customer?.first_name || "Valued Customer";
          const { subject, html } = getEmailContent(1, firstName);

          const emailResult = await resend.emails.send({
            from: "BuyAWarranty.co.uk <reviews@buyawarranty.co.uk>",
            to: [policy.email],
            subject,
            html,
          });

          console.log(`[TRUSTPILOT-REVIEW] Email 1 sent to ${policy.email}:`, emailResult);

          // Calculate next email date
          const nextEmailDate = calculateNextEmailDate(1);

          // Track the email
          await supabase.from("trustpilot_review_emails").insert({
            policy_id: policy.id,
            customer_id: policy.customer_id,
            email: policy.email,
            email_sequence_number: 1,
            email_subject: subject,
            next_email_scheduled_for: nextEmailDate?.toISOString() || null,
          });

          successCount++;
          results.email1++;
        } catch (error) {
          console.error(`[TRUSTPILOT-REVIEW] Error sending Email 1 to ${policy.email}:`, error);
          failCount++;
        }
      }
    }

    // ============================================
    // PART 2: Send Email 2 (follow-up)
    // ============================================
    console.log("[TRUSTPILOT-REVIEW] Checking for Email 2 candidates...");

    const { data: email2Candidates, error: email2Error } = await supabase
      .from("trustpilot_review_emails")
      .select("*")
      .eq("email_sequence_number", 1)
      .eq("review_completed", false)
      .lte("next_email_scheduled_for", now.toISOString())
      .not("next_email_scheduled_for", "is", null);

    if (email2Error) {
      console.error("[TRUSTPILOT-REVIEW] Error fetching Email 2 candidates:", email2Error);
    }

    if (email2Candidates && email2Candidates.length > 0) {
      console.log(`[TRUSTPILOT-REVIEW] ${email2Candidates.length} candidates for Email 2`);

      for (const record of email2Candidates as ReviewEmailRecord[]) {
        try {
          // Check if they've already received Email 2
          const { data: existingEmail2 } = await supabase
            .from("trustpilot_review_emails")
            .select("id")
            .eq("policy_id", record.policy_id)
            .eq("email_sequence_number", 2)
            .single();

          if (existingEmail2) {
            console.log(`[TRUSTPILOT-REVIEW] Skipping ${record.email} - Email 2 already sent`);
            continue;
          }

          // Check if customer completed review
          if (record.customer_id) {
            const { data: customer } = await supabase
              .from("customers")
              .select("first_name, trustpilot_review_completed")
              .eq("id", record.customer_id)
              .single();

            if (customer?.trustpilot_review_completed) {
              // Mark as completed and skip
              await supabase
                .from("trustpilot_review_emails")
                .update({ review_completed: true })
                .eq("policy_id", record.policy_id);
              console.log(`[TRUSTPILOT-REVIEW] Skipping ${record.email} - review completed`);
              continue;
            }

            const firstName = customer?.first_name || "Valued Customer";
            const { subject, html } = getEmailContent(2, firstName);

            const emailResult = await resend.emails.send({
              from: "BuyAWarranty.co.uk <reviews@buyawarranty.co.uk>",
              to: [record.email],
              subject,
              html,
            });

            console.log(`[TRUSTPILOT-REVIEW] Email 2 sent to ${record.email}:`, emailResult);

            const nextEmailDate = calculateNextEmailDate(2);

            await supabase.from("trustpilot_review_emails").insert({
              policy_id: record.policy_id,
              customer_id: record.customer_id,
              email: record.email,
              email_sequence_number: 2,
              email_subject: subject,
              next_email_scheduled_for: nextEmailDate?.toISOString() || null,
            });

            successCount++;
            results.email2++;
          }
        } catch (error) {
          console.error(`[TRUSTPILOT-REVIEW] Error sending Email 2 to ${record.email}:`, error);
          failCount++;
        }
      }
    }

    // ============================================
    // PART 3: Send Email 3 (final reminder)
    // ============================================
    console.log("[TRUSTPILOT-REVIEW] Checking for Email 3 candidates...");

    const { data: email3Candidates, error: email3Error } = await supabase
      .from("trustpilot_review_emails")
      .select("*")
      .eq("email_sequence_number", 2)
      .eq("review_completed", false)
      .lte("next_email_scheduled_for", now.toISOString())
      .not("next_email_scheduled_for", "is", null);

    if (email3Error) {
      console.error("[TRUSTPILOT-REVIEW] Error fetching Email 3 candidates:", email3Error);
    }

    if (email3Candidates && email3Candidates.length > 0) {
      console.log(`[TRUSTPILOT-REVIEW] ${email3Candidates.length} candidates for Email 3`);

      for (const record of email3Candidates as ReviewEmailRecord[]) {
        try {
          // Check if they've already received Email 3
          const { data: existingEmail3 } = await supabase
            .from("trustpilot_review_emails")
            .select("id")
            .eq("policy_id", record.policy_id)
            .eq("email_sequence_number", 3)
            .single();

          if (existingEmail3) {
            console.log(`[TRUSTPILOT-REVIEW] Skipping ${record.email} - Email 3 already sent`);
            continue;
          }

          // Check if customer completed review
          if (record.customer_id) {
            const { data: customer } = await supabase
              .from("customers")
              .select("first_name, trustpilot_review_completed")
              .eq("id", record.customer_id)
              .single();

            if (customer?.trustpilot_review_completed) {
              await supabase
                .from("trustpilot_review_emails")
                .update({ review_completed: true })
                .eq("policy_id", record.policy_id);
              console.log(`[TRUSTPILOT-REVIEW] Skipping ${record.email} - review completed`);
              continue;
            }

            const firstName = customer?.first_name || "Valued Customer";
            const { subject, html } = getEmailContent(3, firstName);

            const emailResult = await resend.emails.send({
              from: "BuyAWarranty.co.uk <reviews@buyawarranty.co.uk>",
              to: [record.email],
              subject,
              html,
            });

            console.log(`[TRUSTPILOT-REVIEW] Email 3 sent to ${record.email}:`, emailResult);

            // Email 3 is the final email - no next scheduled
            await supabase.from("trustpilot_review_emails").insert({
              policy_id: record.policy_id,
              customer_id: record.customer_id,
              email: record.email,
              email_sequence_number: 3,
              email_subject: subject,
              next_email_scheduled_for: null,
            });

            successCount++;
            results.email3++;
          }
        } catch (error) {
          console.error(`[TRUSTPILOT-REVIEW] Error sending Email 3 to ${record.email}:`, error);
          failCount++;
        }
      }
    }

    console.log(`[TRUSTPILOT-REVIEW] Batch complete:`, {
      successCount,
      failCount,
      results,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Trustpilot review email sequence processed",
        sent: successCount,
        failed: failCount,
        breakdown: results,
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
