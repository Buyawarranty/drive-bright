// Daily renewal campaign engine.
// For each active milestone in `renewal_offers`, find policies hitting that
// milestone today, generate a per-policy discount code, schedule the email,
// and (when configured) round-robin assign to a sales agent.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  console.log(`[RENEWAL-CRON] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);
};

const SITE_URL = "https://buyawarranty.co.uk";

function genCode(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}${rand}`;
}

async function pickNextAgent(supabase: any): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);
  // Reset caps that have rolled over to a new day.
  await supabase
    .from("agent_distribution_caps")
    .update({ assigned_today: 0, cap_reset_date: today })
    .neq("cap_reset_date", today);

  const { data: caps } = await supabase
    .from("agent_distribution_caps")
    .select("admin_user_id, assigned_today, daily_cap, paused, sort_order, last_assigned_at")
    .eq("paused", false)
    .order("assigned_today", { ascending: true })
    .order("last_assigned_at", { ascending: true, nullsFirst: true })
    .order("sort_order", { ascending: true });

  if (!caps || caps.length === 0) return null;
  const pick = caps.find((c: any) => !c.daily_cap || c.assigned_today < c.daily_cap);
  if (!pick) return null;

  await supabase
    .from("agent_distribution_caps")
    .update({
      assigned_today: (pick.assigned_today ?? 0) + 1,
      last_assigned_at: new Date().toISOString(),
    })
    .eq("admin_user_id", pick.admin_user_id);

  return pick.admin_user_id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
    log("start", { dryRun });

    const { data: offers, error: offersErr } = await supabase
      .from("renewal_offers")
      .select("*")
      .eq("active", true)
      .order("sort_order");
    if (offersErr) throw offersErr;

    const { data: templates } = await supabase
      .from("email_templates")
      .select("id, name")
      .in("name", (offers ?? []).map((o: any) => o.template_key));
    const tplByName = new Map((templates ?? []).map((t: any) => [t.name, t.id]));

    let totalProcessed = 0;
    let totalQueued = 0;
    let totalSkipped = 0;
    const summary: Record<string, any> = {};

    for (const offer of offers ?? []) {
      const tplId = tplByName.get(offer.template_key);
      if (!tplId) {
        log("missing-template", { template_key: offer.template_key });
        continue;
      }

      // Build the target date window: policy_end_date = today + milestone_days (±0.5d for cron drift).
      const center = new Date();
      center.setUTCHours(0, 0, 0, 0);
      const startDate = new Date(center.getTime() + offer.milestone_days * 86400000);
      const endDate = new Date(startDate.getTime() + 86400000);

      const { data: policies, error: polErr } = await supabase
        .from("customer_policies")
        .select(`
          id, customer_id, plan_type, status, policy_end_date, email,
          customers ( id, first_name, last_name, name, email, registration_plate, vehicle_make, vehicle_model )
        `)
        .eq("status", "active")
        .gte("policy_end_date", startDate.toISOString())
        .lt("policy_end_date", endDate.toISOString())
        .limit(500);
      if (polErr) {
        log("policy-query-error", polErr);
        continue;
      }

      const stat = { offer: offer.label, milestone: offer.milestone_days, found: policies?.length ?? 0, queued: 0, skipped: 0 };

      for (const p of policies ?? []) {
        totalProcessed++;
        const customer = (p as any).customers ?? null;
        const recipient = customer?.email || p.email;
        const firstName =
          customer?.first_name ||
          (customer?.name?.split(" ")[0]) ||
          "there";

        // Idempotency — skip if we already logged this milestone for this policy.
        const { data: existing } = await supabase
          .from("renewal_campaign_log")
          .select("id")
          .eq("policy_id", p.id)
          .eq("milestone_days", offer.milestone_days)
          .maybeSingle();
        if (existing) { stat.skipped++; totalSkipped++; continue; }

        if (!recipient) {
          await supabase.from("renewal_campaign_log").insert({
            policy_id: p.id,
            customer_id: p.customer_id,
            milestone_days: offer.milestone_days,
            template_key: offer.template_key,
            status: "skipped",
            skip_reason: "no_email",
          });
          stat.skipped++; totalSkipped++; continue;
        }

        // Suppression check
        const { data: unsub } = await supabase
          .from("email_unsubscribes")
          .select("id").eq("email", recipient.toLowerCase()).maybeSingle();
        if (unsub) {
          await supabase.from("renewal_campaign_log").insert({
            policy_id: p.id,
            customer_id: p.customer_id,
            milestone_days: offer.milestone_days,
            template_key: offer.template_key,
            recipient_email: recipient,
            status: "skipped",
            skip_reason: "unsubscribed",
          });
          stat.skipped++; totalSkipped++; continue;
        }

        // Discount code (only for milestones with a discount)
        let codeRow: any = null;
        if (offer.discount_percent > 0) {
          const code = genCode(`REN${Math.abs(offer.milestone_days)}-`);
          if (!dryRun) {
            const { data: inserted } = await supabase
              .from("discount_codes")
              .insert({
                code,
                type: "percentage",
                value: offer.discount_percent,
                active: true,
                usage_limit: 1,
                used_count: 0,
                valid_from: new Date().toISOString(),
                valid_to: new Date(Date.now() + 30 * 86400000).toISOString(),
                campaign_source: `renewal_${offer.milestone_days}`,
                is_public: false,
              })
              .select()
              .single();
            codeRow = inserted;
          } else {
            codeRow = { id: null, code };
          }
        }

        const expiry = p.policy_end_date ? new Date(p.policy_end_date) : null;
        const renewalUrl = `${SITE_URL}/?renew=${p.id}${codeRow ? `&code=${codeRow.code}` : ""}`;
        const variables = {
          firstName,
          customerName: customer?.name || `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim(),
          vehicleReg: customer?.registration_plate || "your vehicle",
          vehicleMake: customer?.vehicle_make || "",
          vehicleModel: customer?.vehicle_model || "",
          expiryDate: expiry ? expiry.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "",
          discountCode: codeRow?.code ?? "",
          discountPercent: String(offer.discount_percent ?? 0),
          renewalUrl,
          portalUrl: `${SITE_URL}/customer-dashboard`,
          policyNumber: "",
          planType: p.plan_type ?? "",
        };

        let scheduledId: string | null = null;
        if (!dryRun) {
          const { data: sched, error: schedErr } = await supabase
            .from("scheduled_emails")
            .insert({
              recipient_email: recipient,
              template_id: tplId,
              customer_id: p.customer_id,
              scheduled_for: new Date().toISOString(),
              status: "scheduled",
              metadata: { ...variables, renewalCampaign: true, milestone: offer.milestone_days },
            })
            .select()
            .single();
          if (schedErr) {
            log("schedule-error", schedErr);
            stat.skipped++; totalSkipped++; continue;
          }
          scheduledId = sched?.id ?? null;
        }

        let agentId: string | null = null;
        if (offer.auto_assign_agent && !dryRun) {
          agentId = await pickNextAgent(supabase);
        }

        if (!dryRun) {
          await supabase.from("renewal_campaign_log").insert({
            policy_id: p.id,
            customer_id: p.customer_id,
            milestone_days: offer.milestone_days,
            template_key: offer.template_key,
            discount_code_id: codeRow?.id ?? null,
            discount_code: codeRow?.code ?? null,
            discount_percent: offer.discount_percent,
            assigned_agent_id: agentId,
            scheduled_email_id: scheduledId,
            recipient_email: recipient,
            status: "scheduled",
            scheduled_at: new Date().toISOString(),
            metadata: { variables },
          });
        }

        stat.queued++; totalQueued++;
      }

      summary[offer.template_key] = stat;
    }

    log("done", { totalProcessed, totalQueued, totalSkipped });
    return new Response(
      JSON.stringify({ success: true, dryRun, totalProcessed, totalQueued, totalSkipped, summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    log("fatal", { message: e.message });
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
