import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (s: string, d?: unknown) =>
  console.log(`[CUSTOMER-SELF-SIGNUP] ${s}${d ? " " + JSON.stringify(d) : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const password: string | undefined = body.password;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirm the email belongs to a real customer in our system.
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("id, email, first_name, last_name, name")
      .ilike("email", email)
      .maybeSingle();

    if (custErr) {
      log("Customer lookup failed", custErr);
    }

    if (!customer) {
      // Do not allow public self-signup for non-customers. They can buy a warranty first.
      return new Response(
        JSON.stringify({
          error:
            "We couldn't find a warranty linked to this email. Please use the email address you used when you purchased your warranty, or contact support.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Find existing auth user (paginated).
    let existing: { id: string; email?: string | null } | undefined;
    for (let page = 1; page <= 20 && !existing; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      existing = data.users.find((u) => u.email?.toLowerCase() === email);
      if ((data.users?.length ?? 0) < 1000) break;
    }

    let userId: string;
    if (existing) {
      log("Updating existing auth user", { userId: existing.id });
      const { error: upErr } = await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
      if (upErr) throw upErr;
      userId = existing.id;
    } else {
      log("Creating new auth user", { email });
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: customer.first_name || customer.name?.split(" ")[0] || "",
          last_name: customer.last_name || customer.name?.split(" ").slice(1).join(" ") || "",
        },
      });
      if (error) throw error;
      userId = data.user!.id;
    }

    return new Response(
      JSON.stringify({ success: true, userId, email, action: existing ? "updated" : "created" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    log("ERROR", err?.message || err);
    return new Response(
      JSON.stringify({ error: err?.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
