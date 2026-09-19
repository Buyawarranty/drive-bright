// Daily chase cycle for "pay later" orders.
//
// Customer reminders (each carries the card link and the Bumper spread-the-cost
// link): 7 days before the agreed payment date, 3 days before, the day before,
// on the day, then 1, 3, 7 and 10 days after.
// Sales agent reminders: the day before the payment is due, on the day, then 3,
// 7 and 14 days overdue, so the agent who took the deal chases it.
// At 14 days overdue the order is flagged for a manager decision and a digest
// goes to management. Each reminder is only ever sent once (recorded in
// customers.deferred_reminders_sent / deferred_agent_reminders_sent).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MANAGER_RECIPIENTS = [
  "accounts@buyawarranty.co.uk",
  "support@buyawarranty.co.uk",
  "info@buyawarranty.co.uk",
];

const gbp = (n: number) => `£${Math.round(Number(n) || 0).toLocaleString("en-GB")}`;

const londonToday = () => {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  return new Date(`${s}T00:00:00Z`);
};

const dayDiff = (due: string, today: Date) =>
  Math.round((new Date(`${due}T00:00:00Z`).getTime() - today.getTime()) / 86400000);

// days until the payment is due (negative = overdue) → reminder key
const SCHEDULE: Record<number, string> = {
  7: "before_7",
  3: "before_3",
  1: "before_1",
  0: "due_today",
  [-1]: "overdue_1",
  [-3]: "overdue_3",
  [-7]: "overdue_7",
  [-10]: "overdue_10",
};

// days until due → agent chase reminder key
const AGENT_SCHEDULE: Record<number, string> = {
  1: "agent_before_1",
  0: "agent_due_today",
  [-3]: "agent_overdue_3",
  [-7]: "agent_overdue_7",
  [-14]: "agent_overdue_14",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);
    const today = londonToday();

    const { data: orders, error } = await admin
      .from("customers")
      .select(
        "id, name, email, registration_plate, final_amount, deferred_start_date, deferred_payment_due_date, deferred_reminders_sent, deferred_agent_reminders_sent, deferred_chase_count, deferred_created_by, deferred_payment_link, deferred_bumper_link, sale_credit_admin_user_id, assigned_to",
      )
      .eq("deferred_status", "pending_payment")
      .not("deferred_payment_due_date", "is", null)
      .limit(500);
    if (error) throw error;

    // Who to nudge about each order — the agent who took the deal.
    const agentIds = Array.from(
      new Set(
        (orders || [])
          .map((o: any) => o.deferred_created_by || o.sale_credit_admin_user_id || o.assigned_to)
          .filter(Boolean),
      ),
    ) as string[];
    const agents: Record<string, { name: string | null; email: string | null }> = {};
    if (agentIds.length) {
      const { data: staff } = await admin
        .from("admin_users")
        .select("id, name, email")
        .in("id", agentIds);
      (staff || []).forEach((s: any) => { agents[s.id] = { name: s.name, email: s.email }; });
    }

    const sent: string[] = [];
    const agentSent: string[] = [];
    const flagged: any[] = [];
    const overdueRows: any[] = [];

    for (const o of orders || []) {
      const diff = dayDiff(o.deferred_payment_due_date as string, today);
      const overdue = -diff; // positive once past the due date
      if (overdue > 0) overdueRows.push({ ...o, overdue });

      const already: string[] = Array.isArray(o.deferred_reminders_sent)
        ? (o.deferred_reminders_sent as string[])
        : [];

      const key = SCHEDULE[diff];
      if (key && !already.includes(key) && o.email) {
        const { error: mailErr } = await admin.functions.invoke("send-deferred-order-email", {
          body: { customerId: o.id, kind: "reminder", overdueDays: overdue > 0 ? overdue : 0 },
        });
        if (!mailErr) {
          await admin
            .from("customers")
            .update({
              deferred_reminders_sent: [...already, key],
              deferred_last_chased_at: new Date().toISOString(),
              deferred_chase_count: (o.deferred_chase_count || 0) + 1,
            })
            .eq("id", o.id);
          await admin.from("admin_notes").insert({
            customer_id: o.id,
            note: `⏰ Automatic payment reminder sent to the customer (${key.replace(/_/g, " ")}) with the card and Bumper payment links.`,
          });
          sent.push(`${o.id}:${key}`);
        } else {
          console.error("reminder email failed", o.id, mailErr);
        }
      }

      // ---- Sales agent chase reminder ----
      const agentKey = AGENT_SCHEDULE[diff];
      const agentId = (o as any).deferred_created_by || (o as any).sale_credit_admin_user_id || (o as any).assigned_to;
      const agent = agentId ? agents[agentId] : null;
      const agentAlready: string[] = Array.isArray((o as any).deferred_agent_reminders_sent)
        ? ((o as any).deferred_agent_reminders_sent as string[])
        : [];

      if (agentKey && agent?.email && !agentAlready.includes(agentKey)) {
        const when = overdue > 0
          ? `<strong style="color:#b91c1c;">${overdue} day${overdue === 1 ? "" : "s"} overdue</strong>`
          : diff === 0
            ? `<strong style="color:#b45309;">due today</strong>`
            : `<strong>due tomorrow</strong>`;
        const hasLinks = !!((o as any).deferred_payment_link || (o as any).deferred_bumper_link);

        const { error: agentMailErr } = await resend.emails.send({
          from: "Buy A Warranty <info@buyawarranty.co.uk>",
          to: [agent.email],
          subject: `Chase payment — ${o.registration_plate || o.name || "pay later order"} · ${gbp(o.final_amount)} ${overdue > 0 ? `(${overdue} days overdue)` : diff === 0 ? "(due today)" : "(due tomorrow)"}`,
          html: `<!DOCTYPE html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
            <div style="max-width:560px;margin:0 auto;padding:20px;">
              <h2 style="margin:0 0 10px;">Payment to chase</h2>
              <p style="font-size:15px;line-height:1.6;margin:0 0 14px;">
                Hi ${agent.name || "there"}, the pay later order below is ${when} and the warranty is still switched off.
              </p>
              <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
                <tr><td style="padding:6px 0;color:#6b7280;">Customer</td><td style="padding:6px 0;text-align:right;font-weight:bold;">${o.name || "—"}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Registration</td><td style="padding:6px 0;text-align:right;font-family:monospace;font-weight:bold;">${o.registration_plate || "—"}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Amount</td><td style="padding:6px 0;text-align:right;font-weight:bold;">${gbp(o.final_amount)}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Payment due</td><td style="padding:6px 0;text-align:right;">${o.deferred_payment_due_date}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Cover should start</td><td style="padding:6px 0;text-align:right;">${o.deferred_start_date || "—"}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Chases so far</td><td style="padding:6px 0;text-align:right;">${o.deferred_chase_count || 0}</td></tr>
              </table>
              <p style="font-size:14px;line-height:1.6;margin:0 0 14px;">
                Please call the customer today. ${hasLinks
                  ? "They already have a card link and a Bumper spread-the-cost link — resend either from the Pending payment tab."
                  : "Send a payment link from the Pending payment tab — they can pay by card or spread the cost with Bumper."}
              </p>
              <div style="text-align:center;margin:18px 0;">
                <a href="https://buyawarranty.co.uk/admin-dashboard/?tab=pending-payment" style="display:inline-block;background:#d97706;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:bold;">Open Pending payment</a>
              </div>
              <p style="font-size:13px;color:#6b7280;">Log the chase against the customer so we can all see what's happened.</p>
            </div>
          </body></html>`,
        });

        if (!agentMailErr) {
          await admin
            .from("customers")
            .update({ deferred_agent_reminders_sent: [...agentAlready, agentKey] })
            .eq("id", o.id);
          await admin.from("admin_notes").insert({
            customer_id: o.id,
            note: `📣 Chase reminder emailed to ${agent.name || agent.email} (${agentKey.replace(/_/g, " ")}).`,
          });
          agentSent.push(`${o.id}:${agentKey}`);
        } else {
          console.error("agent reminder failed", o.id, agentMailErr);
        }
      }

      if (overdue >= 14 && !already.includes("manager_flag")) {
        await admin
          .from("customers")
          .update({ deferred_reminders_sent: [...already, "manager_flag"] })
          .eq("id", o.id);
        await admin.from("admin_notes").insert({
          customer_id: o.id,
          note: `🚩 Pay later order is ${overdue} days overdue with no payment — needs a manager decision: extend the dates or cancel.`,
        });
        flagged.push(o);
      }
    }

    // Daily manager digest of everything still outstanding past its date.
    if (overdueRows.length) {
      const rowsHtml = overdueRows
        .sort((a, b) => b.overdue - a.overdue)
        .map(
          (o) => `<tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${o.name || "—"}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;font-family:monospace;">${o.registration_plate || "—"}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${gbp(o.final_amount)}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${o.deferred_payment_due_date}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;color:#b91c1c;font-weight:bold;">${o.overdue} day${o.overdue === 1 ? "" : "s"}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${o.deferred_chase_count || 0}</td>
          </tr>`,
        )
        .join("");

      const total = overdueRows.reduce((s, o) => s + (Number(o.final_amount) || 0), 0);

      await resend.emails.send({
        from: "Buy A Warranty <info@buyawarranty.co.uk>",
        to: MANAGER_RECIPIENTS,
        subject: `Pay later payments outstanding — ${overdueRows.length} orders · ${gbp(total)}`,
        html: `<!DOCTYPE html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
          <h2 style="margin:0 0 6px;">Pay later payments outstanding</h2>
          <p style="font-size:14px;color:#6b7280;margin:0 0 16px;">
            ${overdueRows.length} order${overdueRows.length === 1 ? "" : "s"} worth ${gbp(total)} are past the agreed payment date.
            ${flagged.length ? `<strong>${flagged.length}</strong> have passed 14 days and need a decision.` : ""}
          </p>
          <table style="border-collapse:collapse;width:100%;font-size:13px;">
            <thead><tr style="background:#0f172a;color:#fff;">
              <th style="padding:8px;text-align:left;">Customer</th>
              <th style="padding:8px;text-align:left;">Registration</th>
              <th style="padding:8px;text-align:right;">Amount</th>
              <th style="padding:8px;text-align:left;">Due</th>
              <th style="padding:8px;text-align:left;">Overdue</th>
              <th style="padding:8px;text-align:center;">Chases</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <p style="font-size:13px;color:#6b7280;margin-top:16px;">Open the Pending Payment tab in the dashboard to chase or record a payment.</p>
        </body></html>`,
      });
    }

    return json({
      ok: true,
      checked: orders?.length || 0,
      reminders_sent: sent,
      agent_reminders_sent: agentSent,
      flagged: flagged.length,
    });
  } catch (e) {
    console.error("[deferred-payment-chase]", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
