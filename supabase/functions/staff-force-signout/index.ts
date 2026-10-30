import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { requireAdmin, corsHeaders } from "../_shared/admin-auth.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const auth = await requireAdmin(req, { allowedRoles: ["admin", "super_admin", "sales_manager", "performance_manager", "claims_manager"] });
  if (!auth.ok) return auth.response;

  let adminUserId = "";
  try { adminUserId = String((await req.json())?.adminUserId ?? ""); } catch { /* ignore */ }
  if (!/^[0-9a-f-]{36}$/i.test(adminUserId)) return json({ error: "Missing staff member" }, 400);

  const db = auth.supabase;
  const { data: target, error } = await db.from("admin_users").select("id,user_id,role").eq("id", adminUserId).maybeSingle();
  if (error) return json({ error: "Unable to find staff member" }, 503);
  if (!target?.user_id) return json({ error: "This staff member has no login" }, 404);
  if (target.user_id === auth.user.id) return json({ error: "You can't sign yourself out here" }, 400);
  if (target.role === "super_admin" && auth.adminUser.role !== "super_admin") {
    return json({ error: "Only a super admin can sign out a super admin" }, 403);
  }

  const { data: count, error: rpcError } = await db.rpc("force_sign_out_staff_user", { _user_id: target.user_id });
  if (rpcError) return json({ error: "Unable to sign them out" }, 503);
  console.log(`[STAFF-FORCE-SIGNOUT] ${auth.user.id} signed out ${target.user_id} (${count} sessions)`);
  return json({ signedOut: true, sessions: count ?? 0 });
});
