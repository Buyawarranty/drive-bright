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
    const action = body?.action === "send" ? "send" : "poll";

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

    return json({ ok: true, id: inserted?.id ?? null, created_at: inserted?.created_at ?? null });
  } catch (e) {
    console.error("[chat-live-reply] threw", e);
    return json({ ok: false, error: "unexpected" }, 500);
  }
});
