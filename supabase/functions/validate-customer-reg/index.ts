import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalize = (s: string) => s.replace(/\s+/g, "").toUpperCase();
const normalizeEmail = (s: string) => s.trim().toLowerCase();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { registrationPlate, email } = await req.json();
    const reg = typeof registrationPlate === "string" ? normalize(registrationPlate) : "";
    if (!reg || reg.length < 2 || reg.length > 12) {
      return new Response(JSON.stringify({ valid: false, reason: "invalid_format" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Build common stored variants (no-space, and space at typical UK positions)
    const variants = new Set<string>([reg]);
    if (reg.length >= 5) variants.add(reg.slice(0, reg.length - 3) + " " + reg.slice(-3));
    if (reg.length >= 5) variants.add(reg.slice(0, 4) + " " + reg.slice(4));
    // Lowercase / mixed are handled with ilike, but plates are usually upper. Use in() with both cases.
    const all: string[] = [];
    for (const v of variants) { all.push(v); all.push(v.toLowerCase()); }

    const { data, error } = await supabase
      .from("customers")
      .select("id, first_name, last_name, registration_plate, email")
      .in("registration_plate", all)
      .limit(20);

    if (error) {
      console.error("DB error:", error);
      return new Response(JSON.stringify({ valid: false, reason: "lookup_failed" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const providedEmail = typeof email === "string" && email.trim() ? normalizeEmail(email) : null;

    const match = (data || []).find((c: any) => {
      const regMatch = normalize(c.registration_plate || "") === reg;
      if (!regMatch) return false;
      if (providedEmail) {
        const custEmail = normalizeEmail(c.email || "");
        return custEmail === providedEmail;
      }
      return true;
    });

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
