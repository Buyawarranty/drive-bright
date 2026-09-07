import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";


// The Supabase functions gateway serves function responses as text/plain, which
// made HTML returned from here show up as raw markup in some browsers. So we do
// the work and redirect the customer to a real branded page on the website.
const SITE = "https://buyawarranty.co.uk";
function redirectTo(state: string, email?: string, token?: string): Response {
  const params = new URLSearchParams({ state });
  if (email) params.set("email", email);
  if (token) params.set("token", token);
  return new Response(null, {
    status: 303,
    headers: { location: `${SITE}/email-preferences/?${params.toString()}`, "cache-control": "no-store" },
  });
}

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  const token = url.searchParams.get("token");
  // 'essentials' = keep on list but essential-only; 'off' = full unsubscribe; absent = show chooser
  const choice = url.searchParams.get("choice");

  if (!email) {
    return redirectTo("missing-email");
  }

  // Accept both legacy base64 and URL-safe base64 tokens, and tolerate gateway-mangled '+' -> ' '
  // The address the customer typed may have had capitals or stray spaces, and
  // older emails built the token before normalising it — so check every variant.
  const rawEmail = (url.searchParams.get("email") || "").trim();
  const candidates = new Set([email, rawEmail, rawEmail.toUpperCase()]);
  const normalizedToken = (token || "").replace(/ /g, "+").replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  let tokenOk = false;
  for (const candidate of candidates) {
    if (!candidate) continue;
    let legacy: string;
    try {
      legacy = btoa(candidate + "_baw_unsub_2024");
    } catch (_e) {
      continue; // non-ASCII address, btoa cannot encode it
    }
    const urlSafe = legacy.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    if (token === legacy || token === urlSafe || normalizedToken === legacy.replace(/=+$/, "")) {
      tokenOk = true;
      break;
    }
  }
  if (!tokenOk) {
    return redirectTo("invalid", email);
  }

  // Default behaviour: immediately unsubscribe unless the user explicitly chose "essentials".
  // (Previously we showed an intermediate chooser page which confused users into thinking
  // the unsubscribe link was broken.)
  const effectiveChoice = choice === "essentials" ? "essentials" : "off";

  // Step 2: apply the chosen preference.
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    if (effectiveChoice === "essentials") {
      // Keep them on the list but flip to essentials-only; clear any prior unsubscribe block.
      await supabase.from("email_unsubscribes").delete().eq("email", email);

      const { data: existing } = await supabase
        .from("marketing_audience")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("marketing_audience")
          .update({ is_subscribed: true, unsubscribed_at: null, frequency: "essentials" })
          .eq("email", email);
      } else {
        await supabase.from("marketing_audience").insert({
          email,
          is_subscribed: true,
          frequency: "essentials",
          source: "unsubscribe_essentials_downgrade",
        });
      }

      console.log(`Downgraded to essentials-only: ${email}`);
      return redirectTo("essentials", email, token || undefined);
    }

    // choice === 'off' -> full unsubscribe
    const { error: unsubError } = await supabase.from("email_unsubscribes").upsert(
      {
        email,
        reason: "Email unsubscribe link clicked",
        unsubscribed_by: "self",
        source: "email_link",
        frequency: "off",
      },
      { onConflict: "email" }
    );

    if (unsubError) {
      console.error("Error unsubscribing:", unsubError);
      return redirectTo("error", email);
    }

    await supabase
      .from("marketing_audience")
      .update({ is_subscribed: false, frequency: "off", unsubscribed_at: new Date().toISOString() })
      .eq("email", email);

    console.log(`Successfully unsubscribed: ${email}`);

    return redirectTo("unsubscribed", email, token || undefined);
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return redirectTo("error", email);
  }
};

serve(handler);
