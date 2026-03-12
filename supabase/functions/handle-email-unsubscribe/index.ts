import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  const token = url.searchParams.get("token");

  if (!email) {
    return new Response(renderPage("Invalid Request", "No email address provided."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Simple token verification: base64(email + secret salt)
  const expectedToken = btoa(email + "_baw_unsub_2024");
  if (token !== expectedToken) {
    return new Response(renderPage("Invalid Link", "This unsubscribe link is invalid or has expired."), {
      status: 403,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Add to email_unsubscribes (upsert to avoid duplicates)
    const { error: unsubError } = await supabase
      .from("email_unsubscribes")
      .upsert(
        {
          email,
          reason: "Email unsubscribe link clicked",
          unsubscribed_by: "self",
          source: "email_link",
        },
        { onConflict: "email" }
      );

    if (unsubError) {
      console.error("Error unsubscribing:", unsubError);
      return new Response(renderPage("Error", "Something went wrong. Please try again or contact support@buyawarranty.co.uk."), {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Also update marketing_audience if exists
    await supabase
      .from("marketing_audience")
      .update({ is_subscribed: false })
      .eq("email", email);

    console.log(`Successfully unsubscribed: ${email}`);

    return new Response(
      renderPage(
        "Unsubscribed Successfully",
        `<strong>${email}</strong> has been removed from our marketing email list.<br><br>You will no longer receive promotional emails from Buy A Warranty.<br><br>If this was a mistake, please contact us at <a href="mailto:support@buyawarranty.co.uk" style="color: #FF7A00;">support@buyawarranty.co.uk</a>.`
      ),
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return new Response(renderPage("Error", "Something went wrong. Please contact support@buyawarranty.co.uk."), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
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
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f6f9fc; display: flex; justify-content: center; align-items: center; min-height: 100vh;">
  <div style="max-width: 500px; margin: 40px auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 48px; text-align: center;">
    <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" width="180" alt="Buy A Warranty" style="margin-bottom: 32px;" />
    <h1 style="color: #1a1a1a; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">${title}</h1>
    <p style="color: #484848; font-size: 16px; line-height: 24px; margin: 0;">${message}</p>
    <div style="margin-top: 32px;">
      <a href="https://buyawarranty.co.uk" style="background-color: #FF7A00; border-radius: 6px; color: #fff; font-size: 16px; font-weight: bold; text-decoration: none; padding: 12px 24px; display: inline-block;">Back to Website</a>
    </div>
  </div>
</body>
</html>`;
}

serve(handler);
