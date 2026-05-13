import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ComplaintRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  warrantyRef: string;
  category: string;
  description: string;
  desiredOutcome?: string;
}

function generateReference(): string {
  const year = new Date().getFullYear();
  const num = Math.floor(10000 + Math.random() * 90000);
  return `BAW-C-${year}-${num}`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ComplaintRequest = await req.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      warrantyRef,
      category,
      description,
      desiredOutcome,
    } = body;

    if (!firstName || !lastName || !email || !warrantyRef || !category || !description) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const reference = generateReference();
    console.log("Processing complaint:", reference, email);

    // Internal email to complaints@ and support@
    const internalHtml = `
      <!DOCTYPE html><html><head><meta charset="utf-8"></head>
      <body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:640px;margin:0 auto;padding:20px;">
        <div style="background:#1A2B4A;color:#fff;padding:20px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;font-size:20px;">⚠️ New Complaint Received</h1>
          <p style="margin:6px 0 0;opacity:.85;font-size:13px;">Reference: <strong>${reference}</strong></p>
        </div>
        <div style="background:#f7f8fa;padding:24px;border-radius:0 0 8px 8px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:6px 0;color:#666;width:170px;">Name</td><td style="padding:6px 0;"><strong>${firstName} ${lastName}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#666;">Email</td><td style="padding:6px 0;"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding:6px 0;color:#666;">Phone</td><td style="padding:6px 0;">${phone || "—"}</td></tr>
            <tr><td style="padding:6px 0;color:#666;">Warranty Reference</td><td style="padding:6px 0;"><strong>${warrantyRef}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#666;">Category</td><td style="padding:6px 0;">${category}</td></tr>
          </table>
          <div style="margin-top:18px;padding:14px;background:#fff;border-left:3px solid #E8541A;border-radius:6px;">
            <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">What happened</div>
            <div style="white-space:pre-wrap;font-size:14px;">${description.replace(/</g, "&lt;")}</div>
          </div>
          ${desiredOutcome ? `
          <div style="margin-top:12px;padding:14px;background:#fff;border-left:3px solid #1A2B4A;border-radius:6px;">
            <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Desired outcome</div>
            <div style="white-space:pre-wrap;font-size:14px;">${desiredOutcome.replace(/</g, "&lt;")}</div>
          </div>` : ""}
          <p style="margin-top:24px;font-size:13px;color:#666;">Please acknowledge within 2 working days and aim to resolve within 10 working days.</p>
        </div>
      </body></html>
    `;

    // Customer confirmation email
    const customerHtml = `
      <!DOCTYPE html><html><head><meta charset="utf-8"></head>
      <body style="font-family:Arial,sans-serif;background:#f0f2f5;margin:0;padding:20px;">
        <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #ddd;">
          <div style="background:#1A2B4A;padding:24px;text-align:center;">
            <div style="font-size:20px;font-weight:600;color:#fff;letter-spacing:-.01em;">buy<span style="color:#E8541A;">a</span>warranty</div>
          </div>
          <div style="padding:28px;">
            <h2 style="font-size:18px;color:#1A2B4A;margin:0 0 12px;">We've received your complaint</h2>
            <p style="font-size:14px;color:#444;line-height:1.65;margin:0 0 12px;">Hi ${firstName},</p>
            <p style="font-size:14px;color:#444;line-height:1.65;margin:0 0 12px;">Thank you for getting in touch. We've received your complaint and want to assure you that we take all feedback seriously. Your reference number is below — please quote this in any future correspondence with us.</p>
            <div style="background:#f7f8fa;border-radius:8px;padding:14px 18px;margin:16px 0;border-left:3px solid #E8541A;">
              <div style="font-size:11px;font-weight:500;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Your complaint reference</div>
              <div style="font-size:17px;font-weight:600;color:#1A2B4A;">${reference}</div>
            </div>
            <p style="font-size:14px;color:#444;line-height:1.65;margin:16px 0 8px;"><strong>What happens next:</strong></p>
            <div style="margin:12px 0;">
              <div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #eee;font-size:13px;color:#555;">
                <div style="min-width:24px;height:24px;border-radius:50%;background:#1A2B4A;color:#fff;font-size:11px;font-weight:600;text-align:center;line-height:24px;">1</div>
                <div><strong>Acknowledgement</strong> — We'll contact you within 2 working days to confirm who is handling your complaint.</div>
              </div>
              <div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #eee;font-size:13px;color:#555;">
                <div style="min-width:24px;height:24px;border-radius:50%;background:#1A2B4A;color:#fff;font-size:11px;font-weight:600;text-align:center;line-height:24px;">2</div>
                <div><strong>Investigation</strong> — We'll review your complaint in full and keep you updated on progress.</div>
              </div>
              <div style="display:flex;gap:10px;padding:10px 0;font-size:13px;color:#555;">
                <div style="min-width:24px;height:24px;border-radius:50%;background:#1A2B4A;color:#fff;font-size:11px;font-weight:600;text-align:center;line-height:24px;">3</div>
                <div><strong>Resolution</strong> — We aim to send a full written response within <strong>10 working days</strong>. In complex cases this may take up to 8 weeks.</div>
              </div>
            </div>
            <p style="font-size:14px;color:#444;line-height:1.65;margin:14px 0;">If you have any additional information to add, simply reply to this email quoting your reference number.</p>
            <p style="font-size:14px;color:#444;line-height:1.65;margin:14px 0;">If we haven't resolved your complaint within 8 weeks, you have the right to refer it to the <strong>Financial Ombudsman Service</strong> free of charge.</p>
          </div>
          <div style="background:#f7f8fa;padding:16px 24px;text-align:center;font-size:11px;color:#999;line-height:1.6;border-top:1px solid #eee;">
            Buy a Warranty Limited · Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT<br>
            Registered in England &amp; Wales · Company No. 10314860
          </div>
        </div>
      </body></html>
    `;

    // Send internal email
    const internalRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "BuyaWarranty Complaints <noreply@buyawarranty.co.uk>",
        to: ["complaints@buyawarranty.co.uk", "support@buyawarranty.co.uk"],
        reply_to: email,
        subject: `New complaint ${reference} — ${firstName} ${lastName} (${warrantyRef})`,
        html: internalHtml,
      }),
    });

    if (!internalRes.ok) {
      const errText = await internalRes.text();
      console.error("Internal email failed:", errText);
      throw new Error(`Failed to send internal email: ${errText}`);
    }

    // Send confirmation to customer
    const customerRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Buy A Warranty <support@buyawarranty.co.uk>",
        to: [email],
        subject: `We've received your complaint — ${reference}`,
        html: customerHtml,
      }),
    });

    if (!customerRes.ok) {
      const errText = await customerRes.text();
      console.error("Customer email failed:", errText);
    }

    return new Response(
      JSON.stringify({ success: true, reference }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in submit-complaint:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
