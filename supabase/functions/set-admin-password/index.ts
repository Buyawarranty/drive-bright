import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, requireAdmin } from "../_shared/admin-auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAdmin(req, {
    allowedRoles: ["super_admin", "admin", "sales_manager", "performance_manager", "claims_manager"],
  });
  if (!auth.ok) return auth.response;

  try {
    const { userId, email, password } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const rawPassword = String(password || "");

    if (!normalizedEmail) throw new Error("Email is required");
    if (!rawPassword || rawPassword.length < 6) throw new Error("Password must be at least 6 characters");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Deterministic lookup: id/user_id first, then exact email. Using .or() with
    // maybeSingle() blew up whenever two rows shared an email or user_id.
    const selectCols = "id, user_id, email, first_name, last_name, role, is_active, archived_at";
    let targetAdmin: any = null;

    if (userId) {
      const { data } = await admin
        .from("admin_users")
        .select(selectCols)
        .or(`user_id.eq.${userId},id.eq.${userId}`)
        .order("archived_at", { ascending: true, nullsFirst: true })
        .limit(1);
      targetAdmin = data?.[0] ?? null;
    }

    if (!targetAdmin) {
      const { data, error: adminErr } = await admin
        .from("admin_users")
        .select(selectCols)
        .ilike("email", normalizedEmail)
        .order("archived_at", { ascending: true, nullsFirst: true })
        .limit(1);
      if (adminErr) throw new Error(`Could not check admin user: ${adminErr.message}`);
      targetAdmin = data?.[0] ?? null;
    }

    if (!targetAdmin) throw new Error(`Admin user not found for ${normalizedEmail}`);
    if (targetAdmin.archived_at) {
      throw new Error("This staff account is archived. Reactivate it first before setting a password.");
    }

    let targetAuthId: string | null = targetAdmin.user_id || null;

    if (!targetAuthId) {
      for (let page = 1; page <= 20 && !targetAuthId; page++) {
        const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (listErr) throw new Error(`Could not find auth user: ${listErr.message}`);
        const match = list?.users?.find((u: any) => (u.email || "").toLowerCase() === normalizedEmail);
        if (match) targetAuthId = match.id;
        if (!list?.users || list.users.length < 200) break;
      }
    }

    if (!targetAuthId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password: rawPassword,
        email_confirm: true,
        user_metadata: {
          first_name: targetAdmin.first_name || "",
          last_name: targetAdmin.last_name || "",
        },
      });
      if (createErr || !created?.user) {
        throw new Error(`Could not create auth login: ${createErr?.message || "unknown error"}`);
      }
      targetAuthId = created.user.id;
    } else {
      const { error: updateErr } = await admin.auth.admin.updateUserById(targetAuthId, {
        password: rawPassword,
        email_confirm: true,
        user_metadata: {
          first_name: targetAdmin.first_name || "",
          last_name: targetAdmin.last_name || "",
        },
      });
      if (updateErr) throw new Error(`Could not update password: ${updateErr.message}`);
    }

    await admin
      .from("admin_users")
      .update({ user_id: targetAuthId, email: normalizedEmail })
      .eq("id", targetAdmin.id);

    await admin.from("user_roles").upsert(
      { user_id: targetAuthId, role: targetAdmin.role },
      { onConflict: "user_id,role" }
    );

    // Prove the password actually works before telling the admin it is live.
    // Retry a few times: Auth can briefly return a transient error or a rate
    // limit right after a password change, which previously made a saved
    // password look like a failure.
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const tokenUrl = `${Deno.env.get("SUPABASE_URL")}/auth/v1/token?grant_type=password`;
    let verified = false;
    let rejected = false; // Auth explicitly said the credentials are wrong
    let lastDetail = "";

    for (let attempt = 1; attempt <= 3 && !verified && !rejected; attempt++) {
      if (attempt > 1) await new Promise((r) => setTimeout(r, attempt * 700));
      try {
        const verifyRes = await fetch(tokenUrl, {
          method: "POST",
          headers: { apikey: anonKey, "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, password: rawPassword }),
        });
        if (verifyRes.ok) {
          verified = true;
          break;
        }
        const body = await verifyRes.text();
        lastDetail = `${verifyRes.status} ${body.slice(0, 200)}`;
        // 400 invalid_grant = genuinely wrong password. 429/5xx = transient.
        if (verifyRes.status === 400 && /invalid[_ ]grant|invalid login/i.test(body)) {
          rejected = true;
        }
      } catch (e: any) {
        lastDetail = e?.message || "network error";
      }
    }

    if (rejected) {
      console.error("set-admin-password verification rejected:", lastDetail);
      return new Response(
        JSON.stringify({
          success: false,
          error: "The login server rejected this password. Please try setting it again.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!verified) {
      // The password change itself succeeded; only the confirmation check could
      // not complete. Report success so the admin is not sent round in circles.
      console.warn("set-admin-password saved but unverified:", lastDetail);
      return new Response(
        JSON.stringify({
          success: true,
          verified: false,
          userId: targetAuthId,
          notice:
            "Password saved. The login check could not complete just now (login server busy), so ask the user to sign in once to confirm.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, verified, userId: targetAuthId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("set-admin-password error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || "Failed to set password" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});