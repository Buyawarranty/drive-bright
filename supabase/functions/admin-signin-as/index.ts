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

    // Safe default redirect (never localhost)
    const originHeader = req.headers.get("origin") || "";
    const safeOrigin = originHeader && !originHeader.includes("localhost")
      ? originHeader
      : "https://buyawarranty.co.uk";
    const finalRedirect = redirectTo && !redirectTo.includes("localhost")
      ? redirectTo
      : `${safeOrigin}/admin-dashboard`;

    // 1) Generate a magic link (we use its hashed_token to verify server-side)
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
      options: { redirectTo: finalRedirect },
    });
    if (linkErr) throw linkErr;

    const hashedToken = (linkData.properties as any)?.hashed_token;
    if (!hashedToken) throw new Error("No hashed_token returned");

    // 2) Exchange the hashed token for a real session immediately, server-side.
    //    This avoids the email-link being prefetched/expired by browsers or mail
    //    scanners, and lets the client just call setSession with the tokens.
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
