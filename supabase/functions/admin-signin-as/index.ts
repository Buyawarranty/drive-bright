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

    // Determine a safe default redirect (never localhost)
    const originHeader = req.headers.get("origin") || "";
    const safeOrigin = originHeader && !originHeader.includes("localhost")
      ? originHeader
      : "https://buyawarranty.co.uk";
    let finalRedirect = redirectTo && !redirectTo.includes("localhost")
      ? redirectTo
      : `${safeOrigin}/admin-dashboard`;

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: targetEmail,
      options: { redirectTo: finalRedirect },
    });
    if (linkErr) throw linkErr;

    // Supabase may override redirect_to if Site URL allow-list doesn't include ours.
    // Rebuild the action link from the hashed_token so we control redirect_to.
    const hashedToken = (linkData.properties as any)?.hashed_token;
    let actionLink = linkData.properties?.action_link;
    if (hashedToken) {
      const url = new URL(`${SUPABASE_URL}/auth/v1/verify`);
      url.searchParams.set("token", hashedToken);
      url.searchParams.set("type", "magiclink");
      url.searchParams.set("redirect_to", finalRedirect);
      actionLink = url.toString();
    }

    // Audit log
    await admin.from("admin_activity_log").insert({
      admin_user_id: userData.user.id,
      action: "signin_as",
      details: { target_email: targetEmail },
    }).then(() => {}, () => {});

    return new Response(
      JSON.stringify({ action_link: actionLink, target: targetEmail, redirect_to: finalRedirect }),
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
