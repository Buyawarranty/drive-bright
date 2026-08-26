import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Customer-facing helper for the appeal form page.
 * Given an appeal form token, returns the independent inspection payment link
 * for the same claim (creating one on request if the customer opts in).
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { token, create } = await req.json();
    if (!token || typeof token !== "string") return json({ error: "Missing token" }, 400);

    const { data: appeal } = await supabase
      .from("claim_update_requests")
      .select("id, claim_id, recipient_email, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!appeal) return json({ error: "not_found" }, 404);
    if (appeal.expires_at && new Date(appeal.expires_at) < new Date()) return json({ error: "expired" }, 410);

    const { data: existing } = await supabase
      .from("claim_inspection_requests")
      .select("token, fee_amount, status, paid_at, expires_at")
      .eq("claim_id", appeal.claim_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const current = existing?.[0];
    const live = current && (!current.expires_at || new Date(current.expires_at) > new Date());

    const siteUrl = Deno.env.get("SITE_URL") || "https://buyawarranty.co.uk";

    if (live) {
      return json({
        inspection: {
          link: `${siteUrl}/independent-inspection/${current!.token}`,
          fee: Number(current!.fee_amount) || 140,
          status: current!.status,
          paidAt: current!.paid_at,
        },
      });
    }

    if (!create) return json({ inspection: null });

    const { data: claim } = await supabase
      .from("claims_submissions")
      .select("id, name, email, phone, vehicle_registration, claim_reason")
      .eq("id", appeal.claim_id)
      .maybeSingle();

    if (!claim) return json({ error: "Claim not found" }, 404);

    const { data: inserted, error: insertError } = await supabase
      .from("claim_inspection_requests")
      .insert({
        claim_id: claim.id,
        customer_name: claim.name,
        customer_email: (appeal.recipient_email || claim.email || "").toLowerCase(),
        customer_phone: claim.phone,
        vehicle_registration: claim.vehicle_registration,
        claim_reason: claim.claim_reason,
        inspection_company: "ACE",
        fee_amount: 140,
      })
      .select("token, fee_amount, status, paid_at")
      .single();

    if (insertError || !inserted) throw new Error(insertError?.message || "Could not create inspection request");

    return json({
      inspection: {
        link: `${siteUrl}/independent-inspection/${inserted.token}`,
        fee: Number(inserted.fee_amount) || 140,
        status: inserted.status,
        paidAt: inserted.paid_at,
      },
    });
  } catch (error: any) {
    console.error("appeal-inspection-option error", error);
    return json({ error: error.message }, 500);
  }
});
