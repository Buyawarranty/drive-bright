// Turn a Miles chat conversation into a real New Leads record, with the whole
// conversation written into the lead's notes timeline.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdmin, corsHeaders } from "../_shared/admin-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type MsgRow = { role: string; content: string | null; parts: any; created_at: string };

function messageText(row: MsgRow): string {
  if (row.content && row.content.trim()) return row.content.trim();
  const parts = Array.isArray(row.parts) ? row.parts : [];
  return parts
    .filter((p: any) => p?.type === "text" && typeof p.text === "string")
    .map((p: any) => p.text.trim())
    .filter(Boolean)
    .join("\n");
}

function speaker(role: string) {
  if (role === "user") return "Customer";
  if (role === "agent") return "Specialist";
  return "Miles (AI)";
}

function buildTranscript(rows: MsgRow[]) {
  const lines: string[] = [];
  for (const r of rows) {
    const text = messageText(r);
    if (!text) continue;
    lines.push(`${speaker(r.role)}: ${text}`);
  }
  return { text: lines.join("\n\n").slice(0, 12000), count: lines.length };
}

/** Pull contact details out of what the customer typed, as a fallback. */
function detect(rows: MsgRow[]) {
  const customerText = rows
    .filter((r) => r.role === "user")
    .map(messageText)
    .join("\n");
  const email = customerText.match(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/)?.[0] ?? null;
  const phone =
    customerText.match(/(?:(?:\+44|0)\s?\d[\d\s-]{8,13})/)?.[0]?.replace(/[\s-]/g, "") ?? null;
  const reg =
    customerText
      .match(/\b[A-Z]{2}\d{2}\s?[A-Z]{3}\b|\b[A-Z]\d{1,3}\s?[A-Z]{3}\b/i)?.[0]
      ?.toUpperCase()
      .replace(/\s/g, "") ?? null;
  return { email, phone, reg };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const threadId: string | undefined = body?.threadId;
    if (!threadId) return json({ error: "threadId is required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const { data: thread, error: threadError } = await admin
      .from("ai_sandbox_threads")
      .select("id, title, source, sales_lead_id, created_at")
      .eq("id", threadId)
      .maybeSingle();
    if (threadError) return json({ error: threadError.message }, 500);
    if (!thread) return json({ error: "Conversation not found" }, 404);

    const { data: rows, error: msgError } = await admin
      .from("ai_sandbox_messages")
      .select("role, content, parts, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });
    if (msgError) return json({ error: msgError.message }, 500);

    const messages = (rows ?? []) as MsgRow[];
    const transcript = buildTranscript(messages);
    const found = detect(messages);

    const name = (body?.name ?? "").toString().trim();
    const email = ((body?.email ?? found.email) ?? "").toString().trim().toLowerCase();
    const phoneRaw = ((body?.phone ?? found.phone) ?? "").toString().trim();
    const reg = ((body?.registration ?? found.reg) ?? "").toString().trim().toUpperCase().replace(/\s/g, "");
    const digits = phoneRaw.replace(/\D/g, "");
    const tail9 = digits.length >= 9 ? digits.slice(-9) : null;

    if (!email && !tail9) {
      return json(
        {
          error:
            "This conversation has no phone number or email address, so it cannot be sent as a lead. Add one manually.",
          detected: found,
        },
        400,
      );
    }

    const attach = async (leadId: string) => {
      const stamp = new Date().toLocaleString("en-GB");
      const { error } = await admin.from("lead_quick_notes").insert({
        lead_id: leadId,
        note_text: `[${stamp} — 🤖 Miles (AI chat)] 💬 Live chat conversation (${transcript.count} messages, source: ${
          thread.source ?? "website"
        })\n\n${transcript.text || "No message text captured."}`,
        created_by: auth.adminUser?.id ?? "00000000-0000-0000-0000-000000000000",
        is_pinned: false,
      });
      if (error) console.error("[chat-thread-to-lead] note insert failed", error);
      await admin.from("ai_sandbox_threads").update({ sales_lead_id: leadId }).eq("id", threadId);
    };

    // Dedupe: one customer, one lead.
    if (email) {
      const { data: byEmail } = await admin
        .from("sales_leads")
        .select("id")
        .ilike("email", email)
        .limit(1);
      if (byEmail && byEmail.length > 0) {
        await attach(byEmail[0].id);
        return json({ ok: true, created: false, reason: "duplicate_email", lead_id: byEmail[0].id });
      }
    }
    if (tail9) {
      const { data: byPhone } = await admin.rpc("find_sales_lead_by_phone_tail9", {
        tail_digits: tail9,
      });
      const existingId = Array.isArray(byPhone) ? byPhone[0]?.id ?? byPhone[0] : byPhone;
      if (existingId) {
        await attach(existingId as string);
        return json({ ok: true, created: false, reason: "duplicate_phone", lead_id: existingId });
      }
    }

    const nameParts = name.split(/\s+/).filter(Boolean);
    const { data: inserted, error: insertError } = await admin
      .from("sales_leads")
      .insert({
        first_name: nameParts[0] ?? null,
        last_name: nameParts.slice(1).join(" ") || null,
        email: email || null,
        phone: phoneRaw || null,
        vehicle_reg: reg || null,
        notes: [
          "Sent from the AI chat (Chatbot data → Conversations).",
          `Chat source: ${thread.source ?? "website"}`,
          !email ? "No email given — phone only." : null,
          nameParts.length === 0 ? "No name given." : null,
        ]
          .filter(Boolean)
          .join("\n"),
      })
      .select("id")
      .single();

    if (insertError) return json({ error: insertError.message }, 500);

    try {
      const { data: tag } = await admin
        .from("lead_tags")
        .select("id")
        .eq("name", "Chatbot lead")
        .maybeSingle();
      if (tag?.id) {
        await admin.from("lead_tag_assignments").insert({ lead_id: inserted.id, tag_id: tag.id });
      }
    } catch (e) {
      console.error("[chat-thread-to-lead] tag failed", e);
    }


    await attach(inserted.id);

    return json({ ok: true, created: true, lead_id: inserted.id });
  } catch (e) {
    console.error("[chat-thread-to-lead] fatal", e);
    return json({ error: (e as Error).message ?? "Unexpected error" }, 500);
  }
});
