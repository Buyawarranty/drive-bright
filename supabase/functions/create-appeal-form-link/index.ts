import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Creates the customer-facing APPEAL FORM link (no email sent).
 * The claims team pastes/previews the link inside the appeal email.
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { claimId, recipientEmail } = await req.json();
    if (!claimId || !recipientEmail) {
      return new Response(JSON.stringify({ error: "Missing claimId or recipientEmail" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: claim, error: claimError } = await supabase
      .from("claims_submissions")
      .select("id, name, vehicle_registration, claim_reason")
      .eq("id", claimId)
      .maybeSingle();

    if (claimError || !claim) {
      return new Response(JSON.stringify({ error: "Claim not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("claim_update_requests")
      .insert({
        claim_id: claim.id,
        recipient_email: String(recipientEmail).trim().toLowerCase(),
        vehicle_registration: claim.vehicle_registration,
        claim_reason: claim.claim_reason,
        customer_name: claim.name,
      })
      .select("id, token")
      .single();

    if (insertError || !inserted) throw new Error(insertError?.message || "Could not create appeal form");

    const siteUrl = Deno.env.get("SITE_URL") || "https://buyawarranty.co.uk";
    return new Response(
      JSON.stringify({ success: true, link: `${siteUrl}/claim-update/${inserted.token}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("create-appeal-form-link error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
