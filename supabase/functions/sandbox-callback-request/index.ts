// Public "Call me back" handler for the website chat widget.
// A visitor confirms their number, we create a real urgent-callback lead so it
// pops up for the sales team, and we schedule the call for right now (inside
// opening hours) or for the next opening time (Mon–Sat, 9am–6pm UK).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const OPEN_DAYS = [1, 2, 3, 4, 5, 6]; // Mon–Sat
const START_HOUR = 9;
const END_HOUR = 18;

function londonParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  return {
    dayIndex: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday),
    hour: Number(parts.find((p) => p.type === "hour")?.value ?? "0"),
    minute: Number(parts.find((p) => p.type === "minute")?.value ?? "0"),
  };
}

/** Is the team open right now, and when should the call be attempted? */
function schedule(now = new Date()) {
  const { dayIndex, hour } = londonParts(now);
  const isOpen = OPEN_DAYS.includes(dayIndex) && hour >= START_HOUR && hour < END_HOUR;
  if (isOpen) return { isOpen, callAt: now, label: "in the next few minutes" };

  // Walk forward hour by hour (UTC steps) until London lands on an open slot.
  const cursor = new Date(now.getTime());
  for (let i = 0; i < 24 * 8; i++) {
    cursor.setTime(cursor.getTime() + 60 * 60 * 1000);
    const p = londonParts(cursor);
    if (OPEN_DAYS.includes(p.dayIndex) && p.hour >= START_HOUR && p.hour < END_HOUR) {
      cursor.setTime(cursor.getTime() - p.minute * 60 * 1000);
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const sameDay = p.dayIndex === dayIndex;
      return {
        isOpen,
        callAt: cursor,
        label: sameDay ? "today from 9am" : `${dayNames[p.dayIndex]} from 9am`,
      };
    }
  }
  return { isOpen, callAt: now, label: "at the next opening time" };
}

/** UK mobile or landline, digits only. */
function normalisePhone(raw: string): string | null {
  let digits = (raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("44")) digits = `0${digits.slice(2)}`;
  if (/^07\d{9}$/.test(digits)) return digits;
  if (/^0(1|2)\d{8,9}$/.test(digits)) return digits;
  if (/^03\d{9}$/.test(digits)) return digits;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));

    const phone = normalisePhone(String(body?.phone ?? ""));
    if (!phone) {
      return json({ ok: false, error: "invalid_phone", message: "Enter a valid UK mobile or landline number." }, 400);
    }

    const name = String(body?.name ?? "").trim().slice(0, 80);
    const email = String(body?.email ?? "").trim().toLowerCase().slice(0, 160);
    const registration = String(body?.registration ?? "").toUpperCase().replace(/\s/g, "").slice(0, 12);
    const source = String(body?.source ?? "website-chat").slice(0, 80);
    const guestToken = String(body?.guestToken ?? "").slice(0, 64);
    const contactPreference = body?.contactPreference === "whatsapp" ? "whatsapp" : "call";
    const threadId = typeof body?.threadId === "string" ? body.threadId : null;
    const quotedPrice = Number.isFinite(Number(body?.quotedPrice)) ? Number(body.quotedPrice) : null;

    const TOPIC_LABELS: Record<string, string> = {
      warranty_purchase: "Warranty purchase",
      general: "General enquiry",
      existing_policy: "Existing policy question",
      other: "Something else",
    };
    const topic = String(body?.topic ?? "other");
    const topicLabel = TOPIC_LABELS[topic] ?? "Something else";

    const plan = schedule();
    const tail9 = phone.slice(-9);
    const nameParts = name.split(/\s+/).filter(Boolean);

    const noteLines = [
      `[${new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })} - System] Message me back requested from website chat (${source}).`,
      `Query type: ${topicLabel}.`,
      contactPreference === "whatsapp"
        ? "Customer prefers a WHATSAPP message back on this number."
        : "Customer prefers a PHONE CALL back on this number.",
      plan.isOpen
        ? contactPreference === "whatsapp"
          ? "Team is OPEN — WhatsApp them straight away."
          : "Team is OPEN — ring straight away."
        : `Requested out of hours — call ${plan.label}.`,
      registration ? `Reg given: ${registration}` : null,
      quotedPrice ? `Price discussed: £${Math.round(quotedPrice)}` : null,
      !email ? "No email given — phone only." : null,
    ].filter(Boolean);

    // Never split one customer across two agents: reuse an existing lead.
    let leadId: string | null = null;
    let duplicate = false;
    let matched: { id: string; status: string | null; do_not_contact: boolean; notes: string | null } | null = null;
    try {
      const { data: byPhone } = await admin.rpc("find_sales_lead_by_phone_tail9", { tail_digits: tail9 });
      const existingId = Array.isArray(byPhone) ? (byPhone[0]?.id ?? byPhone[0]) : byPhone;
      if (existingId) {
        const { data: row } = await admin
          .from("sales_leads")
          .select("id, status, do_not_contact, notes")
          .eq("id", String(existingId))
          .maybeSingle();
        if (row) matched = row as typeof matched;
      }
    } catch (e) {
      console.error("[sandbox-callback-request] phone dedupe failed", e);
    }

    // Suppressed records are never revived or duplicated by a web request.
    if (matched && (matched.do_not_contact || matched.status === "fake_lead" || matched.status === "unsubscribed")) {
      return json({
        ok: true,
        suppressed: true,
        is_open: plan.isOpen,
        when_label: plan.label,
        phone,
        message: "Please give us a ring on 0330 229 5040 and we'll help straight away.",
      });
    }

    if (matched) {
      leadId = matched.id;
      duplicate = true;
      const { error: updateError } = await admin
        .from("sales_leads")
        .update({
          is_callback: true,
          next_action_type: "call",
          next_action_at: plan.callAt.toISOString(),
          next_action_date: plan.callAt.toISOString(),
          follow_up_status: "scheduled",
          last_activity_date: new Date().toISOString(),
          notes: [matched.notes, ...noteLines].filter(Boolean).join("\n"),
        })
        .eq("id", leadId);
      if (updateError) console.error("[sandbox-callback-request] callback update failed", updateError);
    } else {

      const { data: inserted, error: insertError } = await admin
        .from("sales_leads")
        .insert({
          first_name: nameParts[0] ?? null,
          last_name: nameParts.slice(1).join(" ") || null,
          // sales_leads.email is NOT NULL; phone-only callbacks get a routing address.
          email: email || `callback_${Date.now()}_${tail9}@callback.temp`,
          phone,
          vehicle_reg: registration || null,
          quote_amount: quotedPrice,
          status: "urgent_callback",
          is_callback: true,
          next_action_type: "call",
          next_action_at: plan.callAt.toISOString(),
          next_action_date: plan.callAt.toISOString(),
          follow_up_status: "scheduled",
          notes: noteLines.join("\n"),
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[sandbox-callback-request] lead insert failed", insertError);
        return json({ ok: false, error: "lead_failed", message: "We couldn't save that — please call 0330 229 5040." }, 500);
      }
      leadId = inserted.id;

    }

    // Every live-chat callback is tagged, whether it is a brand new lead or a
    // returning caller matched by phone.
    if (leadId) {
      try {
        const { data: tag } = await admin.from("lead_tags").select("id").eq("name", "Live chat").maybeSingle();
        let tagId = tag?.id as string | undefined;
        if (!tagId) {
          const { data: created } = await admin
            .from("lead_tags")
            .insert({ name: "Live chat", color: "#F97316" })
            .select("id")
            .single();
          tagId = created?.id;
        }
        if (tagId) {
          await admin
            .from("lead_tag_assignments")
            .upsert({ lead_id: leadId, tag_id: tagId }, { onConflict: "lead_id,tag_id", ignoreDuplicates: true });
        }
      } catch (tagErr) {
        console.error("[sandbox-callback-request] tag failed", tagErr);
      }
    }

    // Surface it in the chat thread too, so staff viewing the conversation see it.
    try {
      let resolvedThread = threadId;
      if (!resolvedThread && guestToken) {
        const { data: t } = await admin
          .from("ai_sandbox_threads")
          .select("id")
          .eq("guest_token", guestToken)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        resolvedThread = t?.id ?? null;
      }
      if (resolvedThread) {
        await admin.from("ai_sandbox_handovers").insert({
          thread_id: resolvedThread,
          kind: "callback_request",
          reason: `${plan.isOpen ? "message_me_back_now" : "message_me_back_next_opening"} (${contactPreference})`,
          customer_name: name || null,
          customer_email: email || null,
          customer_phone: phone,
          registration: registration || null,
          quoted_price: quotedPrice,
          status: "waiting",
        });
      }
    } catch (e) {
      console.error("[sandbox-callback-request] handover insert failed", e);
    }

    return json({
      ok: true,
      lead_id: leadId,
      duplicate,
      is_open: plan.isOpen,
      call_at: plan.callAt.toISOString(),
      when_label: plan.label,
      contact_preference: contactPreference,
      phone,
    });
  } catch (e) {
    console.error("[sandbox-callback-request] threw", e);
    return json({ ok: false, error: "unexpected", message: "Something went wrong — please call 0330 229 5040." }, 500);
  }
});
