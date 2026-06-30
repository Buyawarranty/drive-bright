import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) throw new Error("Missing auth");

    // Identify caller
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Unauthorized");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Verify super_admin
    const { data: callerAdmin } = await admin
      .from("admin_users")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!callerAdmin || callerAdmin.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Forbidden: super_admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { targetEmail, redirectTo } = await req.json();
    if (!targetEmail) throw new Error("targetEmail required");

    const normalizedEmail = String(targetEmail).trim().toLowerCase();

    // Safe default redirect (never localhost)
    const originHeader = req.headers.get("origin") || "";
    const safeOrigin = originHeader && !originHeader.includes("localhost")
      ? originHeader
      : "https://buyawarranty.co.uk";
    const finalRedirect = redirectTo && !redirectTo.includes("localhost")
      ? redirectTo
      : `${safeOrigin}/admin-dashboard`;

    // Look up admin_user row to get any linked user_id and confirm the agent exists
    const { data: targetAdmin } = await admin
      .from("admin_users")
      .select("user_id, email, first_name, last_name, role")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (!targetAdmin) {
      throw new Error(`Admin user not found for ${normalizedEmail}`);
    }

    // Resolve the target auth user without immediately trying to create one.
    // Some historic staff rows can have an auth.users record that makes GoTrue
    // list/create calls fail with "Database error checking email". In that case
    // the admin_users.user_id + email is still the canonical source of truth, so
    // use it directly for generateLink instead of falling into createUser().
    let authUserId: string | null = targetAdmin?.user_id || null;
    let authUserEmail: string | null = targetAdmin?.email || normalizedEmail;

    if (authUserId) {
      const { data: byId, error: byIdErr } = await admin.auth.admin.getUserById(authUserId);
      if (byId?.user?.email) {
        authUserEmail = byId.user.email;
      } else if (byIdErr) {
        console.warn("getUserById failed; continuing with admin_users email", {
          targetEmail: normalizedEmail,
          userId: authUserId,
          message: byIdErr.message,
        });
      }
    }

    if (!authUserId) {
      // Paginate listUsers to find by email (no direct getUserByEmail in admin API)
      for (let page = 1; page <= 20 && !authUserId; page++) {
        const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (listErr) {
          console.warn("listUsers failed while resolving View As target", { targetEmail: normalizedEmail, message: listErr.message });
          break;
        }
        const match = list?.users?.find((u: any) => (u.email || "").toLowerCase() === normalizedEmail);
        if (match) {
          authUserId = match.id;
          authUserEmail = match.email || authUserEmail;
          break;
        }
        if (!list?.users || list.users.length < 200) break;
      }
    }

    if (!authUserId) {
      // Create the auth user only when admin_users has no linked auth id and we
      // could not find one by email. Do not attempt this for linked users because
      // createUser() is exactly what fails on corrupted/duplicate historic rows.
      const tempPw = crypto.randomUUID() + "Aa1!";
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPw,
        email_confirm: true,
        user_metadata: {
          first_name: targetAdmin?.first_name || "",
          last_name: targetAdmin?.last_name || "",
        },
      });
      if (createErr || !created?.user) {
        throw new Error(`Could not provision auth user for ${normalizedEmail}: ${createErr?.message || "unknown"}`);
      }
      authUserId = created.user.id;
      authUserEmail = created.user.email!;
      // Link back into admin_users so future actions know the user_id
      await admin.from("admin_users").update({ user_id: authUserId }).ilike("email", normalizedEmail);
    }

    // 1) Generate a magic link against the canonical auth.users email
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: authUserEmail!,
      options: { redirectTo: finalRedirect },
    });
    if (linkErr) {
      console.error("generateLink failed for", authUserEmail, linkErr);
      throw new Error(`Could not generate magic link for ${authUserEmail}: ${linkErr.message}`);
    }

    const hashedToken = (linkData.properties as any)?.hashed_token;
    if (!hashedToken) throw new Error("No hashed_token returned");

    // 2) Exchange the hashed token for a real session immediately, server-side.
    const verifyClient = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
    const { data: verifyData, error: verifyErr } = await verifyClient.auth.verifyOtp({
      type: "magiclink",
      token_hash: hashedToken,
    });
    if (verifyErr || !verifyData.session) {
      throw new Error(`Verify failed: ${verifyErr?.message || "no session"}`);
    }

    // Fallback action link (kept for backward-compat / copy display)
    const fallbackUrl = new URL(`${SUPABASE_URL}/auth/v1/verify`);
    fallbackUrl.searchParams.set("token", hashedToken);
    fallbackUrl.searchParams.set("type", "magiclink");
    fallbackUrl.searchParams.set("redirect_to", finalRedirect);

    // Audit log
    await admin.from("admin_activity_log").insert({
      admin_user_id: userData.user.id,
      action: "signin_as",
      details: { target_email: targetEmail },
    }).then(() => {}, () => {});

    return new Response(
      JSON.stringify({
        access_token: verifyData.session.access_token,
        refresh_token: verifyData.session.refresh_token,
        target: targetEmail,
        redirect_to: finalRedirect,
        action_link: fallbackUrl.toString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: any) {
    console.error("admin-signin-as error:", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
