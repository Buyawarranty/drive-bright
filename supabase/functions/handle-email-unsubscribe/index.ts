import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  const token = url.searchParams.get("token");
  // 'essentials' = keep on list but essential-only; 'off' = full unsubscribe; absent = show chooser
  const choice = url.searchParams.get("choice");

  if (!email) {
    return new Response(renderPage("Invalid Request", "No email address provided."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Accept both legacy base64 and URL-safe base64 tokens, and tolerate gateway-mangled '+' -> ' '
  const expectedLegacy = btoa(email + "_baw_unsub_2024");
  const expectedUrlSafe = expectedLegacy.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const normalizedToken = (token || "").replace(/ /g, "+").replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  const expectedNormalized = expectedLegacy.replace(/=+$/, "");
  const tokenOk = token === expectedLegacy || token === expectedUrlSafe || normalizedToken === expectedNormalized;
  if (!tokenOk) {
    return new Response(
      renderPage(
        "Invalid Link",
        "This unsubscribe link is invalid or has expired. Please email <a href='mailto:support@buyawarranty.co.uk' style='color:#FF7A00;'>support@buyawarranty.co.uk</a> and we'll remove you immediately."
      ),
      { status: 403, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Step 1: no choice yet -> show the "would you like fewer emails instead?" rescue page.
  if (choice !== "essentials" && choice !== "off") {
    return new Response(renderChooser(email, token || ""), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Step 2: apply the chosen preference.
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    if (choice === "essentials") {
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
      return new Response(
        renderPage(
          "You're on the essentials list",
          `Thanks - we'll only send <strong>${email}</strong> the important stuff (renewal reminders and the occasional claims tip). No promotions, no newsletters.<br><br>Changed your mind? <a href="${Deno.env.get("SUPABASE_URL")}/functions/v1/handle-email-unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token || "")}&choice=off" style="color:#FF7A00;">Unsubscribe completely</a>.`
        ),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
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
      return new Response(
        renderPage("Error", "Something went wrong. Please try again or contact support@buyawarranty.co.uk."),
        { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    await supabase
      .from("marketing_audience")
      .update({ is_subscribed: false, frequency: "off", unsubscribed_at: new Date().toISOString() })
      .eq("email", email);

    console.log(`Successfully unsubscribed: ${email}`);

    const resubUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/handle-email-resubscribe?email=${encodeURIComponent(email)}`;
    return new Response(
      renderPage(
        "Unsubscribed successfully",
        `<strong>${email}</strong> has been removed from our marketing email list.<br><br>You won't receive promotional emails from Buy A Warranty again. Policy documents and claims updates will still come through.<br><br>Changed your mind one day? <a href="${resubUrl}" style="color:#FF7A00;">Re-subscribe in one click</a>.`
      ),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return new Response(
      renderPage("Error", "Something went wrong. Please contact support@buyawarranty.co.uk."),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
};

function renderChooser(email: string, token: string): string {
  const base = `${Deno.env.get("SUPABASE_URL")}/functions/v1/handle-email-unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
  const essentialsUrl = `${base}&choice=essentials`;
  const offUrl = `${base}&choice=off`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email preferences - Buy A Warranty</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f6f9fc;display:flex;justify-content:center;align-items:center;min-height:100vh;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);padding:48px;text-align:center;">
    <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" width="180" alt="Buy A Warranty" style="margin-bottom:32px;" />
    <h1 style="color:#1a1a1a;font-size:24px;font-weight:700;margin:0 0 12px 0;">Before you go…</h1>
    <p style="color:#484848;font-size:16px;line-height:24px;margin:0 0 28px 0;">
      Would you like to hear from us <strong>less often</strong> instead?
    </p>

    <div style="text-align:left;border:1px solid #e5e7eb;border-radius:10px;padding:20px;margin-bottom:14px;">
      <div style="font-weight:700;color:#1a1a1a;font-size:16px;margin-bottom:6px;">Just the essentials</div>
      <div style="color:#6b7280;font-size:14px;margin-bottom:14px;line-height:20px;">
        Only renewal reminders when your warranty is ending, and the occasional claims/policy tip. About 3-4 emails a year.
      </div>
      <a href="${essentialsUrl}" style="display:inline-block;background-color:#FF7A00;border-radius:6px;color:#fff;font-size:15px;font-weight:bold;text-decoration:none;padding:12px 22px;">Yes, fewer emails please</a>
    </div>

    <div style="text-align:left;border:1px solid #e5e7eb;border-radius:10px;padding:20px;">
      <div style="font-weight:700;color:#1a1a1a;font-size:16px;margin-bottom:6px;">No marketing emails at all</div>
      <div style="color:#6b7280;font-size:14px;margin-bottom:14px;line-height:20px;">
        Stop everything. Policy documents and claims updates will still come through.
      </div>
      <a href="${offUrl}" style="display:inline-block;background-color:#ffffff;border:1px solid #d1d5db;border-radius:6px;color:#374151;font-size:15px;font-weight:bold;text-decoration:none;padding:12px 22px;">Unsubscribe me fully</a>
    </div>

    <p style="color:#9ca3af;font-size:13px;margin-top:24px;">
      Updating preferences for <strong>${email}</strong>
    </p>
  </div>
</body>
</html>`;
}

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
