import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EvidenceFile {
  name: string;
  size: number;
  type: string;
  data: string;
}

interface EvidenceRequest {
  email: string;
  vehicleReg: string;
  notes?: string;
  files: EvidenceFile[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { email, vehicleReg, notes, files }: EvidenceRequest = await req.json();

    if (!email || !vehicleReg) {
      return new Response(JSON.stringify({ error: "Email and registration are required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if ((!files || files.length === 0) && !notes?.trim()) {
      return new Response(JSON.stringify({ error: "Please attach at least one file or add a note" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const normalizedReg = vehicleReg.replace(/\s+/g, "").toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();

    // Find most recent matching claim
    const { data: claim, error: lookupError } = await supabase
      .from("claims_submissions")
      .select("*")
      .ilike("email", normalizedEmail)
      .ilike("vehicle_registration", `%${normalizedReg}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) console.error("Lookup error:", lookupError);

    if (!claim) {
      return new Response(JSON.stringify({
        error: "We couldn't find a claim matching that registration and email. Please double-check the details, or call us on 0330 229 5045.",
      }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Upload files
    type Uploaded = { url: string; publicUrl: string; name: string; size: number; type: string; base64: string };
    const uploadedAttachments: Uploaded[] = [];

    for (const f of files || []) {
      try {
        const base64 = f.data.includes(",") ? f.data.split(",")[1] : f.data;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const uniqueFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
        const storagePath = `claim-attachments/evidence/${uniqueFileName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("policy-documents")
          .upload(storagePath, bytes, { contentType: f.type || "application/octet-stream" });
        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }
        const publicUrl = `https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/${uploadData.path}`;
        uploadedAttachments.push({
          url: uploadData.path, publicUrl, name: f.name, size: f.size, type: f.type, base64,
        });
      } catch (e) {
        console.error("File processing error:", e);
      }
    }

    // Merge into file_urls
    const existing = Array.isArray(claim.file_urls) ? claim.file_urls : [];
    const merged = [
      ...existing,
      ...uploadedAttachments.map((a) => ({
        url: a.url, publicUrl: a.publicUrl, name: a.name, size: a.size, type: a.type,
        addedAs: "evidence", addedAt: new Date().toISOString(),
      })),
    ];

    const timestamp = new Date().toLocaleString("en-GB");
    const evidenceNote = `\n\n[NEW EVIDENCE — ${timestamp}]\n${notes?.trim() ? notes.trim() + "\n" : ""}${uploadedAttachments.length > 0 ? `Attached: ${uploadedAttachments.map(a => a.name).join(", ")}` : ""}`;
    const newInternalNotes = (claim.internal_notes || "") + evidenceNote;

    const { error: updateError } = await supabase
      .from("claims_submissions")
      .update({
        file_urls: merged,
        internal_notes: newInternalNotes,
        updated_at: new Date().toISOString(),
        last_contacted_at: new Date().toISOString(),
        // Reset status to 'new' if it was closed, so admins notice
        status: ["closed", "rejected", "resolved"].includes(claim.status) ? "new" : claim.status,
      })
      .eq("id", claim.id);

    if (updateError) {
      console.error("Update error:", updateError);
      throw new Error("Failed to attach evidence to claim");
    }

    // Email claims team
    const regDisplay = (claim.vehicle_registration || normalizedReg).toUpperCase();
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #FFD700; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center; border: 3px solid #000;">
          <p style="margin: 0; font-size: 28px; font-weight: bold; color: #000; letter-spacing: 2px; font-family: 'Arial Black', Arial, sans-serif;">${regDisplay}</p>
        </div>
        <h1 style="color: #eb4b00;">New Evidence Submitted</h1>
        <div style="background-color: #f0f9ff; padding: 16px 20px; border-radius: 8px; border-left: 4px solid #0ea5e9; margin: 16px 0;">
          <p style="margin: 0 0 6px 0;"><strong>Customer:</strong> ${claim.name || "Unknown"} (${claim.email})</p>
          <p style="margin: 0 0 6px 0;"><strong>Phone:</strong> ${claim.phone || "Not provided"}</p>
          <p style="margin: 0;"><strong>Original claim ID:</strong> ${claim.id}</p>
          <p style="margin: 6px 0 0 0;"><strong>Submitted:</strong> ${timestamp}</p>
        </div>
        ${notes?.trim() ? `
          <div style="background-color: #f8f9fa; padding: 16px 20px; border-radius: 8px; margin: 16px 0;">
            <h3 style="margin-top: 0; color: #333;">Customer note</h3>
            <p style="white-space: pre-wrap; margin: 0;">${notes.trim()}</p>
          </div>
        ` : ""}
        ${uploadedAttachments.length > 0 ? `
          <div style="background-color: #fff3cd; padding: 16px 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 16px 0;">
            <h3 style="margin-top: 0; color: #333;">📎 New attachments (${uploadedAttachments.length})</h3>
            <ul style="padding-left: 20px; margin: 8px 0;">
              ${uploadedAttachments.map(a => `<li style="margin-bottom: 8px;"><strong>${a.name}</strong>${a.size ? ` — ${Math.round(a.size / 1024)} KB` : ""}<br/><a href="${a.publicUrl}" style="color: #eb4b00;">Download</a></li>`).join("")}
            </ul>
          </div>
        ` : ""}
        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">Evidence has been attached to the existing claim record in the admin dashboard.</p>
      </div>
    `;

    const emailPayload: any = {
      from: "Buyawarranty Customer Care <noreply@buyawarranty.co.uk>",
      to: ["claims@buyawarranty.co.uk", "support@buyawarranty.co.uk"],
      subject: `New evidence: ${regDisplay}`,
      html: emailHtml,
    };
    if (uploadedAttachments.length > 0) {
      emailPayload.attachments = uploadedAttachments.map(a => ({ filename: a.name, content: a.base64 }));
    }
    const sendRes = await resend.emails.send(emailPayload);
    if (sendRes.error) console.error("Email error:", sendRes.error);

    // Confirmation to customer
    await resend.emails.send({
      from: "Buyawarranty Customer Care <claims@buyawarranty.co.uk>",
      to: [claim.email],
      subject: `We've received your additional evidence — ${regDisplay}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #eb4b00;">Evidence received</h1>
          <p>Hi ${claim.name || "there"},</p>
          <p>Thank you — we've added your additional evidence for <strong>${regDisplay}</strong> to your existing claim. Our claims team will review it as soon as possible.</p>
          <p>If you need to speak with us, call <strong>0330 229 5045</strong> (Mon–Fri, 9am–5pm) or email <a href="mailto:claims@buyawarranty.co.uk">claims@buyawarranty.co.uk</a>.</p>
          <p style="margin-top: 24px;">Best regards,<br/><strong>Buy a Warranty Claims Team</strong></p>
        </div>
      `,
    });

    return new Response(JSON.stringify({
      success: true,
      claimId: claim.id,
      attachmentsAdded: uploadedAttachments.length,
    }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: any) {
    console.error("submit-claim-evidence error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
