import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERIFY_TAG_ID = "15247506-5c13-4ea6-91a5-d08b0a83229f"; // 'VERIFY vehicle'

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const firstName = (body.first_name || "").toString().trim().slice(0, 100);
    const lastName = (body.last_name || "").toString().trim().slice(0, 100);
    const email = (body.email || "").toString().trim().toLowerCase().slice(0, 255);
    const phone = (body.phone || "").toString().trim().slice(0, 40);
    const regNumber = (body.vehicle_reg || "").toString().trim().toUpperCase().slice(0, 20);
    const mileage = (body.mileage || "").toString().trim().slice(0, 20);
    const notes = (body.notes || "").toString().slice(0, 1000);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Valid email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!phone) {
      return new Response(JSON.stringify({ error: "Phone is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!regNumber) {
      return new Response(JSON.stringify({ error: "Registration is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const noteBody = [
      "Northern Ireland registration — needs manual verification (DVLA/DVA lookup unavailable).",
      notes ? `Customer note: ${notes}` : null,
    ].filter(Boolean).join("\n");

    const { data: lead, error: insertErr } = await supabase
      .from("sales_leads")
      .insert({
        first_name: firstName || null,
        last_name: lastName || null,
        email,
        phone,
        vehicle_reg: regNumber,
        mileage: mileage || null,
        lead_source: "website",
        status: "new",
        priority: "high",
        notes: noteBody,
      })
      .select("id")
      .single();

    if (insertErr || !lead) {
      console.error("NI lead insert failed:", insertErr);
      return new Response(JSON.stringify({ error: "Could not create lead" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: tagErr } = await supabase
      .from("lead_tag_assignments")
      .insert({ lead_id: lead.id, tag_id: VERIFY_TAG_ID });

    if (tagErr) {
      console.error("Tag assign failed (non-fatal):", tagErr);
    }

    return new Response(JSON.stringify({ ok: true, lead_id: lead.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("submit-ni-verification-lead error:", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
