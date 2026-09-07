import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


// The functions gateway serves responses as text/plain, so we redirect to a real
// branded page on the website instead of returning HTML from here.
const SITE = "https://buyawarranty.co.uk";
function redirectTo(state: string, email?: string): Response {
  const params = new URLSearchParams({ state });
  if (email) params.set("email", email);
  return new Response(null, {
    status: 303,
    headers: { ...corsHeaders, location: `${SITE}/email-preferences/?${params.toString()}`, "cache-control": "no-store" },
  });
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  // Optional second-step: 'essentials' downgrades them from 'all' to essentials-only.
  const choice = url.searchParams.get("choice");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return redirectTo("missing-email");
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const targetFrequency = choice === "essentials" ? "essentials" : "all";

    // Clear any unsubscribe block.
    await supabase.from("email_unsubscribes").delete().eq("email", email);

    // Re-enable marketing_audience with the chosen frequency.
    const { data: existing } = await supabase
      .from("marketing_audience")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("marketing_audience")
        .update({ is_subscribed: true, unsubscribed_at: null, frequency: targetFrequency })
        .eq("email", email);
    } else {
      await supabase
        .from("marketing_audience")
        .insert({
          email,
          is_subscribed: true,
          frequency: targetFrequency,
          source: "resubscribe_link",
        });
    }

    console.log(`Re-subscribed ${email} at frequency=${targetFrequency}`);

    if (targetFrequency === "essentials") {
      return redirectTo("essentials", email);
    }

    return redirectTo("resubscribed", email);
  } catch (error) {
    console.error("Resubscribe error:", error);
    return redirectTo("error", email);
  }
};

serve(handler);
