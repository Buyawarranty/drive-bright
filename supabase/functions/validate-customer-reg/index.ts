import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalize = (s: string) => s.replace(/\s+/g, "").toUpperCase();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { registrationPlate } = await req.json();
    const reg = typeof registrationPlate === "string" ? normalize(registrationPlate) : "";
    if (!reg || reg.length < 2 || reg.length > 12) {
      return new Response(JSON.stringify({ valid: false, reason: "invalid_format" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check customers table — match normalized reg (strip spaces, upper).
    const { data, error } = await supabase
      .from("customers")
      .select("id, first_name, last_name, registration_plate")
      .not("registration_plate", "is", null)
      .limit(2000);

    if (error) {
      console.error("DB error:", error);
      return new Response(JSON.stringify({ valid: false, reason: "lookup_failed" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const match = (data || []).find((c: any) => normalize(c.registration_plate || "") === reg);
    if (match) {
      return new Response(JSON.stringify({
        valid: true,
        customerName: [match.first_name, match.last_name].filter(Boolean).join(" ").trim() || null,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ valid: false, reason: "not_found" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("validate-customer-reg error:", err);
    return new Response(JSON.stringify({ valid: false, reason: "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
