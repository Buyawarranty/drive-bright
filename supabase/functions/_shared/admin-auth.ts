// Shared helper to require an authenticated admin caller in edge functions.
// Returns { ok: true, user, adminUser } on success, or { ok: false, response } with
// a ready-to-return Response on failure.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_ROLES = new Set([
  "admin",
  "super_admin",
  "sales_manager",
  "performance_manager",
  "sales_lead",
  "sales",           // primary sales agent role in admin_users
  "sales_agent",     // legacy alias, keep for safety
  "lead_gen",
  "accounts_manager",
  "claims_agent",
]);

export interface RequireAdminOptions {
  allowedRoles?: string[];
}

export async function requireAdmin(req: Request, options: RequireAdminOptions = {}) {
  const allowed = options.allowedRoles ? new Set(options.allowedRoles) : ADMIN_ROLES;

  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      ok: false as const,
      response: new Response(
        JSON.stringify({ error: "Unauthorized: missing bearer token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return {
      ok: false as const,
      response: new Response(
        JSON.stringify({ error: "Unauthorized: invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  const { data: adminUser, error: adminError } = await supabase
    .from("admin_users")
    .select("id, user_id, email, role, is_active")
    .eq("user_id", userData.user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError || !adminUser || !allowed.has(adminUser.role)) {
    return {
      ok: false as const,
      response: new Response(
        JSON.stringify({ error: "Forbidden: admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  return { ok: true as const, user: userData.user, adminUser, supabase };
}
