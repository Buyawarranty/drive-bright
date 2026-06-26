import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  // Optional second-step: 'essentials' downgrades them from 'all' to essentials-only.
  const choice = url.searchParams.get("choice");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(
      renderPage(
        "Invalid Request",
        "We couldn't read your email address from the link. Please email <a href='mailto:support@buyawarranty.co.uk' style='color:#FF7A00;'>support@buyawarranty.co.uk</a> and we'll re-subscribe you manually."
      ),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
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
      return new Response(
        renderPage(
          "You're on the essentials list",
          `Thanks - we'll only send <strong>${email}</strong> the important stuff (renewal reminders and the occasional claims tip).<br><br>About 3-4 emails a year. No promotions, no newsletters.`
        ),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const essentialsUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/handle-email-resubscribe?email=${encodeURIComponent(email)}&choice=essentials`;
    return new Response(
      renderPage(
        "Welcome back!",
        `<strong>${email}</strong> is back on the list.<br><br>You'll now receive our exclusive renewal discounts, free cover upgrades and members-only offers.<br><br>Prefer fewer emails? <a href="${essentialsUrl}" style="color:#FF7A00;">Just send me the essentials</a> instead.`
      ),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (error) {
    console.error("Resubscribe error:", error);
    return new Response(
      renderPage("Error", "Something went wrong. Please contact support@buyawarranty.co.uk and we'll re-subscribe you manually."),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
};

function renderPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Buy A Warranty</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f6f9fc;display:flex;justify-content:center;align-items:center;min-height:100vh;">
  <div style="max-width:500px;margin:40px auto;background:#ffffff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);padding:48px;text-align:center;">
    <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" width="180" alt="Buy A Warranty" style="margin-bottom:32px;" />
    <h1 style="color:#1a1a1a;font-size:24px;font-weight:700;margin:0 0 16px 0;">${title}</h1>
    <p style="color:#484848;font-size:16px;line-height:24px;margin:0;">${message}</p>
    <div style="margin-top:32px;">
      <a href="https://buyawarranty.co.uk" style="background-color:#FF7A00;border-radius:6px;color:#fff;font-size:16px;font-weight:bold;text-decoration:none;padding:12px 24px;display:inline-block;">Back to website</a>
    </div>
  </div>
</body>
</html>`;
}

serve(handler);
