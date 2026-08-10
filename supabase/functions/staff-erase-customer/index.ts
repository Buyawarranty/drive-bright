import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MANAGER_ROLES = ["admin", "super_admin", "sales_manager"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Not signed in" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return json({ error: "Invalid session" }, 401);
    const userId = userRes.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: staff } = await admin
      .from("admin_users")
      .select("id, first_name, last_name, email, role, is_active")
      .eq("user_id", userId)
      .maybeSingle();

    if (!staff || staff.is_active === false) return json({ error: "Only active staff can do this" }, 403);
    if (!MANAGER_ROLES.includes(String(staff.role))) {
      return json({ error: "Only managers can permanently erase a customer" }, 403);
    }

    const staffName =
      [staff.first_name, staff.last_name].filter(Boolean).join(" ") || staff.email || userRes.user.email || null;

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const phoneRaw = String(body?.phone ?? "").replace(/\D/g, "");
    const tail = phoneRaw.slice(-9);
    const reason = body?.reason ? String(body.reason) : "Customer asked to be permanently deleted";

    if (!email && !tail) return json({ error: "Provide an email or phone number" }, 400);

    // ---------- 1. Collect leads ----------
    const leadFilters: string[] = [];
    if (email) leadFilters.push(`email.ilike.${email}`);
    if (tail) leadFilters.push(`phone.ilike.%${tail}%`);

    const { data: leads, error: leadsErr } = await admin
      .from("sales_leads")
      .select("*")
      .or(leadFilters.join(","));
    if (leadsErr) throw leadsErr;

    const leadIds = (leads ?? []).map((l: any) => l.id);

    // ---------- 2. Collect customers ----------
    const custFilters: string[] = [];
    if (email) custFilters.push(`email.ilike.${email}`);
    if (tail) custFilters.push(`phone.ilike.%${tail}%`);
    const { data: customers } = await admin.from("customers").select("*").or(custFilters.join(","));

    // ---------- 3. Collect related lead data ----------
    const other: Record<string, unknown> = {};
    const childTables = ["lead_quick_notes", "lead_call_logs", "lead_activities", "lead_reminders"];
    if (leadIds.length) {
      for (const t of childTables) {
        const { data } = await admin.from(t).select("*").in("lead_id", leadIds);
        if (data?.length) other[t] = data;
      }
    }
    if (email) {
      const { data: carts } = await admin.from("abandoned_carts").select("*").ilike("email", email);
      if (carts?.length) other["abandoned_carts"] = carts;
      const { data: audience } = await admin.from("marketing_audience").select("*").ilike("email", email);
      if (audience?.length) other["marketing_audience"] = audience;
    }

    const name =
      (leads?.[0] &&
        [leads[0].first_name, leads[0].last_name].filter(Boolean).join(" ")) ||
      (customers?.[0]?.name as string | undefined) ||
      null;

    // ---------- 4. Write archive first ----------
    const { data: archive, error: archErr } = await admin
      .from("erased_customers")
      .insert({
        email: email || null,
        phone: phoneRaw || null,
        customer_name: name,
        reason,
        status: "unsubscribed",
        lead_ids: leadIds,
        leads_archive: leads ?? [],
        customers_archive: customers ?? [],
        other_archive: other,
        erased_by: staff.id,
        erased_by_name: staffName,
      })
      .select("id")
      .single();
    if (archErr) throw archErr;

    // ---------- 5. Suppress marketing / calls ----------
    const now = new Date().toISOString();
    if (email) {
      await admin.from("email_unsubscribes").upsert(
        {
          email,
          reason,
          source: "staff_erasure",
          customer_name: name,
          unsubscribed_by: staff.id,
          unsubscribed_by_name: staffName,
          frequency: "off",
        },
        { onConflict: "email" },
      );
      await admin
        .from("marketing_audience")
        .update({ is_subscribed: false, unsubscribed_at: now, frequency: "off" })
        .ilike("email", email);
    }

    // ---------- 6. Delete lead data ----------
    let deletedLeads = 0;
    if (leadIds.length) {
      for (const t of childTables) {
        await admin.from(t).delete().in("lead_id", leadIds);
      }
      const { data: del, error: delErr } = await admin
        .from("sales_leads")
        .delete()
        .in("id", leadIds)
        .select("id");
      if (delErr) throw delErr;
      deletedLeads = del?.length ?? 0;
    }
    if (email) {
      await admin.from("abandoned_carts").delete().ilike("email", email);
    }

    // ---------- 7. Anonymise customer/policy records (kept for legal/financial records) ----------
    let anonymisedCustomers = 0;
    for (const c of customers ?? []) {
      const { error } = await admin
        .from("customers")
        .update({
          name: "Erased customer",
          email: `erased+${archive.id}@buyawarranty.invalid`,
          phone: null,
          street: null,
          town: null,
          postcode: null,
          country: null,
          building_name: null,
          building_number: null,
          flat_number: null,
        })
        .eq("id", c.id);
      if (!error) anonymisedCustomers += 1;
    }

    return json({
      success: true,
      archiveId: archive.id,
      deletedLeads,
      anonymisedCustomers,
      archivedLeads: leads?.length ?? 0,
    });
  } catch (error: any) {
    console.error("staff-erase-customer error:", error);
    return json({ error: error?.message || "Unexpected error" }, 500);
  }
});
