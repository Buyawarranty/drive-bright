// Live two-way chat between a staff member in the CRM and a website visitor
// who is still sitting in the Miles chat box.
//
// Two actions:
//   send  — a signed-in staff member writes a reply; it is saved as a human
//           "specialist" message on the visitor's conversation.
//   poll  — the public chat widget asks for any specialist replies it has not
//           shown yet. Only agent messages are returned, keyed by the random
//           browser token that owns the conversation, so nothing else leaks.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const AGENT_PREFIX = "(Warranty specialist)";

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
    const action = body?.action === "send" || body?.action === "email" ? body.action : "poll";

    if (action === "poll") {
      const raw = typeof body?.guestToken === "string" ? body.guestToken.trim() : "";
      if (!/^[a-zA-Z0-9-]{16,64}$/.test(raw)) return json({ ok: false, error: "bad_token" }, 400);
      const since = typeof body?.since === "string" ? body.since : null;

      const { data: thread } = await admin
        .from("ai_sandbox_threads")
        .select("id")
        .eq("guest_token", raw)
        .maybeSingle();
      if (!thread) return json({ ok: true, messages: [] });

      let query = admin
        .from("ai_sandbox_messages")
        .select("id, content, parts, created_at")
        .eq("thread_id", thread.id)
        .eq("role", "agent")
        .order("created_at", { ascending: true })
        .limit(50);
      if (since) query = query.gt("created_at", since);

      const { data: rows, error } = await query;
      if (error) return json({ ok: false, error: "load_failed" }, 500);

      return json({
        ok: true,
        messages: (rows ?? []).map((r) => ({
          id: r.id,
          text: String(r.content ?? "").replace(AGENT_PREFIX, "").trim(),
          created_at: r.created_at,
        })),
      });
    }

    // ---- send: staff reply ----
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ ok: false, error: "not_signed_in" }, 401);

    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await asUser.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ ok: false, error: "not_signed_in" }, 401);

    const threadId = typeof body?.threadId === "string" ? body.threadId : "";
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!threadId) return json({ ok: false, error: "no_thread" }, 400);
    if (!text) return json({ ok: false, error: "empty_message" }, 400);
    if (text.length > 2000) return json({ ok: false, error: "too_long" }, 400);

    const customerEmail = typeof body?.customerEmail === "string" ? body.customerEmail.trim().toLowerCase() : "";
    const customerName = typeof body?.customerName === "string" ? body.customerName.trim().slice(0, 120) : "";
    if (action === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      return json({ ok: false, error: "valid_email_required" }, 400);
    }

    // Only real staff accounts may speak to a customer as a specialist.
    const { data: staffRows, error: staffError } = await admin
      .from("admin_users")
      .select("id, role, is_active, first_name, last_name")
      .eq("user_id", user.id)
      .order("is_active", { ascending: false })
      .limit(1);
    if (staffError) {
      console.error("[chat-live-reply] staff lookup failed", staffError);
      return json({ ok: false, error: "staff_lookup_failed" }, 500);
    }
    const staff = staffRows?.[0];
    if (!staff || staff.is_active === false) return json({ ok: false, error: "not_staff" }, 403);

    if (action === "email") {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) return json({ ok: false, error: "email_not_configured" }, 500);
      const escapeHtml = (value: string) => value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
      const messageHtml = escapeHtml(text)
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#175cd3">$1</a>')
        .replace(/\n/g, "<br>");
      const firstName = customerName.split(/\s+/)[0] || "there";
      const staffName = [staff.first_name, staff.last_name].filter(Boolean).join(" ") || "Warranty specialist";
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Buy A Warranty Customer Care <support@buyawarranty.co.uk>",
          to: [customerEmail],
          reply_to: "support@buyawarranty.co.uk",
          subject: "A reply from Buy A Warranty",
          html: `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#1f2937"><div style="max-width:620px;margin:0 auto;padding:28px 16px"><div style="background:#ffffff;border-top:4px solid #175cd3;padding:28px"><p style="margin:0 0 18px">Hi ${escapeHtml(firstName)},</p><div style="font-size:16px;line-height:1.65">${messageHtml}</div><p style="margin:24px 0 0">Kind regards,<br><strong>${escapeHtml(staffName)}</strong><br>Buy A Warranty</p></div><p style="font-size:12px;color:#667085;text-align:center">This response relates to your recent website chat. Reply to this email if you still need help.</p></div></body></html>`,
        }),
      });
      if (!emailResponse.ok) {
        console.error("[chat-live-reply] email failed", emailResponse.status, await emailResponse.text());
        return json({ ok: false, error: "email_send_failed" }, 502);
      }
    }

    const content = `${AGENT_PREFIX} ${text}`;
    const { data: inserted, error: insertError } = await admin
      .from("ai_sandbox_messages")
      .insert({
        thread_id: threadId,
        user_id: user.id,
        role: "agent",
        content,
        parts: [{ type: "text", text: content }],
      })
      .select("id, created_at")
      .maybeSingle();

    if (insertError) {
      console.error("[chat-live-reply] insert failed", insertError);
      return json({ ok: false, error: "save_failed" }, 500);
    }

    await admin
      .from("ai_sandbox_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", threadId);

    return json({ ok: true, delivery: action === "email" ? "email" : "live", id: inserted?.id ?? null, created_at: inserted?.created_at ?? null });
  } catch (e) {
    console.error("[chat-live-reply] threw", e);
    return json({ ok: false, error: "unexpected" }, 500);
  }
});
