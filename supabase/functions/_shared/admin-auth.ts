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

  // Under load the auth/REST gateway can answer with a plain-text body
  // ("Operation timed out"), which makes supabase-js throw while parsing JSON
  // and turns a transient blip into an opaque 500 for the agent. Retry once,
  // then fail with a readable JSON error.
  const withRetry = async <T,>(op: () => Promise<T>): Promise<T | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await op();
      } catch (e) {
        console.error(`[requireAdmin] transient auth/db failure (attempt ${attempt + 1})`, e);
        if (attempt === 1) return null;
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    return null;
  };

  const userResult = await withRetry(() => supabase.auth.getUser(token));
  if (!userResult) {
    return {
      ok: false as const,
      response: new Response(
        JSON.stringify({ error: "Auth service temporarily unavailable, please try again" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }
  const { data: userData, error: userError } = userResult;
  if (userError || !userData?.user) {
    return {
      ok: false as const,
      response: new Response(
        JSON.stringify({ error: "Unauthorized: invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  const adminResult = await withRetry(() =>
    supabase
      .from("admin_users")
      .select("id, user_id, email, role, is_active")
      .eq("user_id", userData.user.id)
      .eq("is_active", true)
      .maybeSingle()
  );
  if (!adminResult) {
    return {
      ok: false as const,
      response: new Response(
        JSON.stringify({ error: "Staff lookup temporarily unavailable, please try again" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }
  const { data: adminUser, error: adminError } = adminResult;


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
