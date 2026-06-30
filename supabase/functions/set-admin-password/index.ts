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

    const { data: targetAdmin, error: adminErr } = await admin
      .from("admin_users")
      .select("id, user_id, email, first_name, last_name, role, is_active")
      .or(`email.ilike.${normalizedEmail},user_id.eq.${userId || "00000000-0000-0000-0000-000000000000"}`)
      .maybeSingle();

    if (adminErr) throw new Error(`Could not check admin user: ${adminErr.message}`);
    if (!targetAdmin) throw new Error(`Admin user not found for ${normalizedEmail}`);
    if (!targetAdmin.is_active) throw new Error("This admin user is inactive");

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
      .update({ user_id: targetAuthId, email: normalizedEmail, is_active: true })
      .eq("id", targetAdmin.id);

    await admin.from("user_roles").upsert(
      { user_id: targetAuthId, role: targetAdmin.role },
      { onConflict: "user_id,role" }
    );

    return new Response(JSON.stringify({ success: true, userId: targetAuthId }), {
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