import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { logCustomerEmail } from '../_shared/log-email.ts';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// ---------------------------------------------------------------------------
// TEST MODE
// While CLAIMS_TEST_MODE !== "false" we redirect every claim email (both the
// internal notification AND the customer confirmation) to a fixed list of
// test addresses. This lets us validate the whole flow without spamming real
// customers or the live support inboxes. Flip to "false" to go live.
// ---------------------------------------------------------------------------
// Default to LIVE so real claimants get their confirmation email.
// Set CLAIMS_TEST_MODE="true" in edge function secrets to re-enable redirection to the test inbox.
const CLAIMS_TEST_MODE = (Deno.env.get("CLAIMS_TEST_MODE") ?? "false") === "true";
const CLAIMS_TEST_RECIPIENTS = ["claims@buyawarranty.co.uk"];

function routeClaimEmail(payload: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  attachments?: any[];
  intendedFor?: string; // for the test banner only
}) {
  if (!CLAIMS_TEST_MODE) {
    const { intendedFor, ...rest } = payload;
    return rest;
  }
  const banner = `
    <div style="background:#fde68a;border:2px solid #b45309;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-family:Arial,sans-serif;">
      <p style="margin:0;color:#7c2d12;font-weight:700;font-size:14px;">⚠️ TEST MODE — this email was redirected.</p>
      <p style="margin:4px 0 0;color:#7c2d12;font-size:13px;">
        Original recipient${payload.intendedFor ? `: <strong>${payload.intendedFor}</strong>` : "(s) suppressed"}.
        Sent to test inbox only. No live customer was emailed.
      </p>
    </div>`;
  return {
    from: payload.from,
    to: CLAIMS_TEST_RECIPIENTS,
    subject: `[TEST] ${payload.subject}`,
    html: banner + payload.html,
    ...(payload.attachments ? { attachments: payload.attachments } : {}),
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ClaimFile {
  name: string;
  size: number;
  type: string;
  data: string;
}

interface ClaimSubmissionRequest {
  name: string;
  email: string;
  phone?: string;
  vehicleReg?: string;
  currentMileage?: number;
  faultDescription?: string;
  dateOccurred?: string;
  faultDetails?: string;
  issueTiming?: string;
  additionalInfo?: string;
  file?: ClaimFile;
  files?: ClaimFile[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { name, email, phone, vehicleReg, currentMileage, faultDescription, dateOccurred, faultDetails, issueTiming, additionalInfo, file, files }: ClaimSubmissionRequest = await req.json();

    console.log('Received claim submission:', { name, email, phone: phone || 'N/A', vehicleReg: vehicleReg || 'N/A' });

    // --- Look up customer by reg plate to get purchase mileage & warranty start date ---
    let purchaseMileage: number | null = null;
    let warrantyStartDate: string | null = null;
    let daysOnRisk: number | null = null;
    let mileageDriven: number | null = null;
    let warrantyNumber: string | null = null;

    if (vehicleReg) {
      const normalizedReg = vehicleReg.replace(/\s+/g, '').toUpperCase();
      
      // Try customers table first
      const { data: customerData } = await supabase
        .from('customers')
        .select('mileage, signup_date, registration_plate, warranty_number, warranty_reference_number')
        .or(`registration_plate.eq.${normalizedReg},registration_plate.ilike.%${normalizedReg}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (customerData) {
        console.log('Found customer record for', normalizedReg, ':', customerData);
        
        // Parse purchase mileage (stored as string)
        if (customerData.mileage) {
          const parsed = parseInt(customerData.mileage.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(parsed) && parsed > 0) {
            purchaseMileage = parsed;
          }
        }
        
        // Get warranty start date
        if (customerData.signup_date) {
          warrantyStartDate = customerData.signup_date;
          
          // Calculate days on risk
          const startDate = new Date(customerData.signup_date);
          const now = new Date();
          const diffMs = now.getTime() - startDate.getTime();
          daysOnRisk = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }
        
        // Capture warranty number for customer-facing reference
        warrantyNumber = customerData.warranty_number || customerData.warranty_reference_number || null;

        // Calculate mileage driven since purchase
        if (purchaseMileage && currentMileage && currentMileage > 0) {
          mileageDriven = currentMileage - purchaseMileage;
        }
      } else {
        console.log('No customer found for reg:', normalizedReg);
        
        // Try customer_policies table as fallback
        const { data: policyData } = await supabase
          .from('customer_policies')
          .select('mileage, policy_start_date')
          .or(`policy_number.ilike.%${normalizedReg}%`)
          .limit(1)
          .maybeSingle();
          
        // Also try by joining through email if available
        if (!policyData && email) {
          const { data: policyByEmail } = await supabase
            .from('customer_policies')
            .select('mileage, policy_start_date')
            .ilike('email', email)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
            
          if (policyByEmail) {
            if (policyByEmail.mileage) {
              const parsed = parseInt(policyByEmail.mileage.replace(/[^0-9]/g, ''), 10);
              if (!isNaN(parsed) && parsed > 0) purchaseMileage = parsed;
            }
            if (policyByEmail.policy_start_date) {
              warrantyStartDate = policyByEmail.policy_start_date;
              const startDate = new Date(policyByEmail.policy_start_date);
              daysOnRisk = Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            }
            if (purchaseMileage && currentMileage && currentMileage > 0) {
              mileageDriven = currentMileage - purchaseMileage;
            }
          }
        }
      }

      console.log('Risk data:', { purchaseMileage, warrantyStartDate, daysOnRisk, mileageDriven });
    }

    // Build a unified list of files (support both legacy `file` and new `files[]`)
    const incomingFiles: ClaimFile[] = [];
    if (Array.isArray(files) && files.length > 0) {
      for (const f of files) {
        if (f && f.data) incomingFiles.push(f);
      }
    } else if (file && file.data) {
      incomingFiles.push(file);
    }

    type UploadedAttachment = {
      url: string; // storage path
      publicUrl: string;
      name: string;
      size: number;
      type: string;
      base64: string;
    };
    const uploadedAttachments: UploadedAttachment[] = [];

    for (const f of incomingFiles) {
      try {
        const base64 = f.data.includes(',') ? f.data.split(',')[1] : f.data;
        const binaryString = atob(base64);
        const fileBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          fileBytes[i] = binaryString.charCodeAt(i);
        }
        const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueFileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
        const storagePath = `claim-attachments/${uniqueFileName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('policy-documents')
          .upload(storagePath, fileBytes, { contentType: f.type || 'application/octet-stream' });

        if (uploadError) {
          console.error('File upload error for', f.name, uploadError);
          continue;
        }

        const publicUrl = `https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/${uploadData.path}`;
        uploadedAttachments.push({
          url: uploadData.path,
          publicUrl,
          name: f.name,
          size: f.size,
          type: f.type,
          base64,
        });
        console.log('File uploaded:', uploadData.path);
      } catch (fileError) {
        console.error('Error processing file', f?.name, fileError);
      }
    }

    // Legacy single-file fields (first attachment)
    const fileUrl = uploadedAttachments[0]?.url ?? null;
    const fileName = uploadedAttachments[0]?.name ?? null;
    const fileSize = uploadedAttachments[0]?.size ?? null;

    // Combine claim details into message for database storage
    const claimMessage = [
      vehicleReg && `Vehicle: ${vehicleReg}`,
      currentMileage && `Current Mileage: ${currentMileage.toLocaleString()}`,
      faultDescription && `Fault: ${faultDescription}`,
      dateOccurred && `Date: ${dateOccurred}`,
      faultDetails && `Details: ${faultDetails}`,
      issueTiming && `Timing: ${issueTiming}`,
      additionalInfo && `Additional Info: ${additionalInfo}`
    ].filter(Boolean).join('\n');

    // Try to link this claim to a specific customer policy (match by email + registration plate via customers)
    let matchedPolicyId: string | null = null;
    try {
      const normReg = (vehicleReg || '').toUpperCase().replace(/\s+/g, '');
      if (email && normReg) {
        const { data: cust } = await supabase
          .from('customers')
          .select('id, registration_plate, email')
          .ilike('email', email)
          .limit(20);
        const match = (cust || []).find(
          c => (c.registration_plate || '').toUpperCase().replace(/\s+/g, '') === normReg
        );
        if (match?.id) {
          const { data: pol } = await supabase
            .from('customer_policies')
            .select('id')
            .eq('customer_id', match.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (pol?.id) matchedPolicyId = pol.id;
        }
      }
    } catch (e) {
      console.warn('policy_id lookup failed (non-fatal):', e);
    }


    // Store submission in database with risk data
    const { data: submissionData, error: dbError } = await supabase
      .from('claims_submissions')
      .insert([
        {
          name,
          email,
          phone: phone || null,
          message: claimMessage || null,
          claim_reason: faultDescription || null,
          date_of_incident: dateOccurred || null,
          file_url: fileUrl,
          file_name: fileName,
          file_size: fileSize,
          file_urls: uploadedAttachments.map(a => ({
            url: a.url,
            publicUrl: a.publicUrl,
            name: a.name,
            size: a.size,
            type: a.type,
          })),
          status: 'new',
          vehicle_registration: vehicleReg || null,
          mileage_at_claim: currentMileage || null,
          purchase_mileage: purchaseMileage,
          mileage_driven: mileageDriven,
          days_on_risk: daysOnRisk,
          warranty_start_date: warrantyStartDate,
          policy_id: matchedPolicyId,
        }
      ])
      .select()
      .single();


    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to store submission');
    }

    console.log('Submission stored in database:', submissionData.id);

    // Build risk info banner for email
    const regPlateDisplay = vehicleReg ? vehicleReg.toUpperCase() : 'NO REG PROVIDED';
    
    let riskInfoHtml = '';
    if (daysOnRisk !== null || mileageDriven !== null) {
      riskInfoHtml = `
        <div style="background-color: #fef3c7; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #f59e0b;">
          <h2 style="color: #92400e; margin: 0 0 12px 0; font-size: 18px;">⚠️ Risk Assessment</h2>
          <table style="width: 100%; border-collapse: collapse;">
            ${daysOnRisk !== null ? `
            <tr>
              <td style="padding: 4px 8px; color: #78350f; font-weight: bold;">Days on Risk:</td>
              <td style="padding: 4px 8px; color: #92400e; font-size: 20px; font-weight: bold;">${daysOnRisk.toLocaleString()} days</td>
            </tr>` : ''}
            ${warrantyStartDate ? `
            <tr>
              <td style="padding: 4px 8px; color: #78350f; font-weight: bold;">Warranty Started:</td>
              <td style="padding: 4px 8px; color: #92400e;">${new Date(warrantyStartDate).toLocaleDateString('en-GB')}</td>
            </tr>` : ''}
            ${purchaseMileage ? `
            <tr>
              <td style="padding: 4px 8px; color: #78350f; font-weight: bold;">Mileage at Purchase:</td>
              <td style="padding: 4px 8px; color: #92400e;">${purchaseMileage.toLocaleString()} miles</td>
            </tr>` : ''}
            ${currentMileage ? `
            <tr>
              <td style="padding: 4px 8px; color: #78350f; font-weight: bold;">Current Mileage (Claim):</td>
              <td style="padding: 4px 8px; color: #92400e;">${currentMileage.toLocaleString()} miles</td>
            </tr>` : ''}
            ${mileageDriven !== null ? `
            <tr>
              <td style="padding: 4px 8px; color: #78350f; font-weight: bold;">Miles Driven Since Purchase:</td>
              <td style="padding: 4px 8px; color: #92400e; font-size: 20px; font-weight: bold;">${mileageDriven.toLocaleString()} miles</td>
            </tr>` : ''}
          </table>
        </div>
      `;
    }

    const emailSubject = `Claim: ${regPlateDisplay}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <!-- REG PLATE PROMINENTLY AT TOP -->
        <div style="background-color: #FFD700; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center; border: 3px solid #000;">
          <p style="margin: 0; font-size: 28px; font-weight: bold; color: #000; letter-spacing: 2px; font-family: 'Arial Black', Arial, sans-serif;">
            ${regPlateDisplay}
          </p>
        </div>
        
        <h1 style="color: #eb4b00;">New Claim Submission</h1>
        
        <!-- RISK ASSESSMENT - RIGHT AT THE TOP -->
        ${riskInfoHtml}
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Vehicle Details</h2>
          <p><strong>Registration:</strong> ${regPlateDisplay}</p>
          ${currentMileage ? `<p><strong>Current Mileage:</strong> ${currentMileage.toLocaleString()} miles</p>` : ''}
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Contact Information</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Claim Details</h2>
          <p><strong>Fault Description:</strong> ${faultDescription || 'Not provided'}</p>
          <p><strong>Date Issue Occurred:</strong> ${dateOccurred || 'Not provided'}</p>
          <p><strong>Fault Details:</strong></p>
          <p style="white-space: pre-wrap;">${faultDetails || 'Not provided'}</p>
          <p><strong>When Issue Was Noticed:</strong></p>
          <p style="white-space: pre-wrap;">${issueTiming || 'Not provided'}</p>
        </div>
        
        ${additionalInfo ? `
        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0ea5e9;">
          <h2 style="color: #333; margin-top: 0;">💬 Additional Information</h2>
          <p style="white-space: pre-wrap;">${additionalInfo}</p>
        </div>
        ` : ''}
        
        ${uploadedAttachments.length > 0 ? `
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h2 style="color: #333; margin-top: 0;">📎 Attachments (${uploadedAttachments.length})</h2>
          <ul style="padding-left: 20px; margin: 8px 0;">
            ${uploadedAttachments.map(a => `
              <li style="margin-bottom: 8px;">
                <strong>${a.name}</strong>
                ${a.size ? ` — ${Math.round(a.size / 1024)} KB` : ''}
                <br/>
                <a href="${a.publicUrl}" style="color: #eb4b00; text-decoration: underline;">Download</a>
              </li>
            `).join('')}
          </ul>
        </div>
        ` : ''}
        
        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #1976d2;"><strong>Submission ID:</strong> ${submissionData.id}</p>
          <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Submitted at: ${new Date().toLocaleString()}</p>
        </div>
        
        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          This email was sent automatically from the Buy a Warranty claims system.
          Please respond to the customer at ${email} to acknowledge their submission.
        </p>
      </div>
    `;

    // Prepare email with attachment
    const liveInternalRecipients = [
      "claims@buyawarranty.co.uk",
      "support@buyawarranty.co.uk",
      "support@warranties2000.co.uk",
    ];
    const emailPayload: any = routeClaimEmail({
      // Send from the verified notify subdomain (known-good deliverability).
      // reply_to below routes replies to the customer directly.
      from: "Buyawarranty Claims <noreply@notify.buyawarranty.co.uk>",

      to: liveInternalRecipients,
      subject: emailSubject,
      html: emailHtml,
      attachments: uploadedAttachments.length > 0
        ? uploadedAttachments.map(a => ({ filename: a.name, content: a.base64 }))
        : undefined,
      intendedFor: liveInternalRecipients.join(", "),
    });
    // Ensure "Reply" from the internal team goes straight back to the customer.
    if (email) {
      emailPayload.reply_to = email;
    }

    if (uploadedAttachments.length > 0) {
      console.log(`Adding ${uploadedAttachments.length} attachment(s) to email`);
    }

    const emailResponse = await resend.emails.send(emailPayload);

    if (emailResponse.error) {
      console.error('Email sending error:', emailResponse.error);
    } else {
      console.log(`Email sent (${CLAIMS_TEST_MODE ? "TEST mode" : "LIVE"}):`, emailResponse.data?.id);
    }

    // Send confirmation email to customer (mobile + desktop friendly)
    const firstName = (name || '').trim().split(/\s+/)[0] || 'there';
    const customerRef = warrantyNumber || regPlateDisplay;
    const refLabel = warrantyNumber ? 'Your warranty number' : 'Your vehicle registration';

    const customerEmailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>We've received your claim</title>
<style>
  body { margin:0; padding:0; background-color:#f3f4f6; -webkit-font-smoothing:antialiased; }
  table { border-collapse:collapse; }
  img { border:0; outline:none; text-decoration:none; display:block; }
  a { color:#1d3a8a; }
  .baw-wrap { width:100%; background-color:#f3f4f6; padding:24px 12px; }
  .baw-container { max-width:600px; margin:0 auto; }
  .baw-card { background-color:#ffffff; border-radius:8px; padding:28px 30px; margin-bottom:16px; border:1px solid #e5e7eb; }
  .baw-h1 { color:#1d3a8a; font-size:24px; font-weight:700; margin:0 0 8px 0; line-height:1.3; }
  .baw-h2 { color:#1d3a8a; font-size:17px; font-weight:700; margin:0 0 10px 0; }
  .baw-btn { display:inline-block; background-color:#eb6b1f; color:#ffffff !important; padding:14px 28px; border-radius:6px; text-decoration:none; font-weight:700; font-size:15px; }
  .baw-col { vertical-align:top; }
  @media only screen and (max-width:600px) {
    .baw-wrap { padding:12px 6px !important; }
    .baw-card { padding:20px 18px !important; border-radius:6px !important; }
    .baw-h1 { font-size:20px !important; }
    .baw-h2 { font-size:16px !important; }
    .baw-stack, .baw-stack > tbody > tr > td { display:block !important; width:100% !important; padding:0 0 12px 0 !important; }
    .baw-btn { display:block !important; text-align:center !important; padding:14px 16px !important; }
    .baw-hide-sm { display:none !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
<div class="baw-wrap">
  <div class="baw-container">

    <!-- Header -->
    <div style="text-align:center;padding:8px 0 18px 0;">
      <p style="margin:0;color:#1d3a8a;font-size:18px;font-weight:700;letter-spacing:0.3px;">Buy a Warranty</p>
    </div>

    <!-- Hero -->
    <div class="baw-card">
      <span style="display:inline-block;background-color:#dcfce7;color:#15803d;font-size:13px;font-weight:700;padding:5px 12px;border-radius:999px;margin-bottom:12px;">✓ Claim received</span>
      <h1 class="baw-h1">Thank you ${firstName}, we've got it from here.</h1>
      <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:6px 0 0 0;">We've received your claim for vehicle registration <strong style="color:#1d3a8a;">${regPlateDisplay}</strong> and our claims team will review it as soon as possible.</p>

      <div style="margin-top:22px;padding:16px 20px;background-color:#f9fafb;border-left:4px solid #eb6b1f;border-radius:4px;">
        <p style="margin:0;color:#6b7280;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${refLabel}</p>
        <p style="margin:4px 0 0 0;color:#1d3a8a;font-size:18px;font-weight:700;font-family:'Courier New',monospace;">${customerRef}</p>
      </div>
      <p style="color:#6b7280;font-size:13px;margin:10px 0 0 0;">Please quote this in any future correspondence about your claim.</p>
    </div>

    <!-- What happens next -->
    <div class="baw-card">
      <h2 class="baw-h2">What happens next</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
        <tr>
          <td width="36" style="vertical-align:top;padding:8px 0;"><div style="width:28px;height:28px;line-height:28px;text-align:center;background:#1d3a8a;color:#fff;border-radius:50%;font-weight:700;font-size:13px;">1</div></td>
          <td style="vertical-align:top;padding:8px 0 8px 12px;"><p style="margin:0;color:#1f2937;font-size:14px;font-weight:600;">We review your claim</p><p style="margin:2px 0 0 0;color:#6b7280;font-size:13px;line-height:1.5;">Our claims team will assess the details and supporting evidence you've provided.</p></td>
        </tr>
        <tr>
          <td width="36" style="vertical-align:top;padding:8px 0;"><div style="width:28px;height:28px;line-height:28px;text-align:center;background:#1d3a8a;color:#fff;border-radius:50%;font-weight:700;font-size:13px;">2</div></td>
          <td style="vertical-align:top;padding:8px 0 8px 12px;"><p style="margin:0;color:#1f2937;font-size:14px;font-weight:600;">We get in touch</p><p style="margin:2px 0 0 0;color:#6b7280;font-size:13px;line-height:1.5;">A member of our team will contact you to confirm next steps and request anything else we need.</p></td>
        </tr>
        <tr>
          <td width="36" style="vertical-align:top;padding:8px 0;"><div style="width:28px;height:28px;line-height:28px;text-align:center;background:#1d3a8a;color:#fff;border-radius:50%;font-weight:700;font-size:13px;">3</div></td>
          <td style="vertical-align:top;padding:8px 0 8px 12px;"><p style="margin:0;color:#1f2937;font-size:14px;font-weight:600;">Decision and authorisation</p><p style="margin:2px 0 0 0;color:#6b7280;font-size:13px;line-height:1.5;">Once authorised, we'll arrange payment in line with your warranty plan.</p></td>
        </tr>
      </table>
    </div>

    <!-- Two columns: Hours + Before repairs -->
    <table width="100%" cellpadding="0" cellspacing="0" class="baw-stack">
      <tr>
        <td class="baw-col" width="50%" style="padding-right:8px;">
          <div class="baw-card" style="margin-bottom:16px;">
            <h2 class="baw-h2">Claims Team Opening Hours</h2>
            <p style="color:#1f2937;font-size:14px;margin:6px 0;font-weight:600;">📅 Monday to Friday</p>
            <p style="color:#1f2937;font-size:14px;margin:6px 0;font-weight:600;">🕘 9:00am to 5:00pm</p>
            <p style="color:#6b7280;font-size:13px;margin:10px 0 0 0;line-height:1.5;">Submissions outside these hours will be reviewed on the next working day.</p>
          </div>
        </td>
        <td class="baw-col" width="50%" style="padding-left:8px;">
          <div class="baw-card" style="margin-bottom:16px;background-color:#fff7ed;border-color:#fdba74;">
            <h2 class="baw-h2" style="color:#9a3412;">⚠ Before any repairs begin</h2>
            <p style="color:#7c2d12;font-size:14px;line-height:1.5;margin:6px 0 0 0;">Please do <strong>not</strong> authorise any repairs until your claim has been reviewed and approved by our team.</p>
          </div>
        </td>
      </tr>
    </table>

    <!-- Add evidence -->
    <div class="baw-card" style="background-color:#eff6ff;border-color:#bfdbfe;">
      <h2 class="baw-h2">Need to send more evidence?</h2>
      <p style="color:#334155;font-size:14px;line-height:1.5;margin:0 0 14px 0;">No need to fill in the form again — upload extra photos, garage reports or invoices below. Diagnostic costs are reimbursed up to <strong>£50</strong> or <strong>1 hour</strong> of labour.</p>
      <a href="https://buyawarranty.co.uk/add-evidence/" class="baw-btn">Upload additional evidence</a>
    </div>

    <!-- Important notice -->
    <div class="baw-card" style="background-color:#fef2f2;border-color:#fecaca;">
      <h2 class="baw-h2" style="color:#991b1b;">⚠ Important</h2>
      <p style="color:#7f1d1d;font-size:14px;line-height:1.6;margin:0;">Once costs have been incurred against your policy, it cannot be cancelled and is no longer eligible for a refund.</p>
    </div>

    <!-- Contact + links -->
    <table width="100%" cellpadding="0" cellspacing="0" class="baw-stack">
      <tr>
        <td class="baw-col" width="50%" style="padding-right:8px;">
          <div class="baw-card" style="margin-bottom:16px;">
            <h2 class="baw-h2">Need to speak to us?</h2>
            <p style="color:#1f2937;font-size:14px;margin:6px 0;">📞 <a href="tel:03302295045" style="color:#1d3a8a;text-decoration:none;font-weight:600;">0330 229 5045</a></p>
            <p style="color:#1f2937;font-size:14px;margin:6px 0;">📧 <a href="mailto:claims@buyawarranty.co.uk" style="color:#1d3a8a;text-decoration:none;font-weight:600;">claims@buyawarranty.co.uk</a></p>
          </div>
        </td>
        <td class="baw-col" width="50%" style="padding-left:8px;">
          <div class="baw-card" style="margin-bottom:16px;">
            <h2 class="baw-h2">Helpful links</h2>
            <p style="margin:6px 0;font-size:14px;"><a href="https://buyawarranty.co.uk/make-a-claim/" style="color:#1d3a8a;font-weight:600;text-decoration:none;">Make a claim</a></p>
            <p style="margin:6px 0;font-size:14px;"><a href="https://buyawarranty.co.uk/cancellation-policy/" style="color:#1d3a8a;font-weight:600;text-decoration:none;">Cancellation policy</a></p>
            <p style="margin:6px 0;font-size:14px;"><a href="https://buyawarranty.co.uk/terms/" style="color:#1d3a8a;font-weight:600;text-decoration:none;">Terms &amp; conditions</a></p>
          </div>
        </td>
      </tr>
    </table>

    <!-- Sign off -->
    <div class="baw-card">
      <p style="color:#1f2937;font-size:15px;line-height:1.6;margin:0 0 6px 0;">Thank you for your patience — we're here to help.</p>
      <p style="color:#1f2937;font-size:15px;margin:14px 0 2px 0;">Kind regards,</p>
      <p style="color:#1d3a8a;font-size:15px;font-weight:700;margin:0;">Buy a Warranty Claims Team</p>
    </div>

    <!-- Footer -->
    <div style="background-color:#1d3a8a;border-radius:8px;padding:18px 22px;text-align:center;">
      <p style="margin:0;color:#ffffff;font-size:13px;line-height:1.6;">
        <a href="https://buyawarranty.co.uk" style="color:#ffffff;text-decoration:none;font-weight:600;">buyawarranty.co.uk</a>
        &nbsp;·&nbsp; 0330 229 5045 &nbsp;·&nbsp;
        <a href="mailto:claims@buyawarranty.co.uk" style="color:#ffffff;text-decoration:none;">claims@buyawarranty.co.uk</a>
      </p>
    </div>

  </div>
</div>
</body>
</html>`;

    const customerEmailResponse = await resend.emails.send(routeClaimEmail({
      // Send from the verified notify subdomain for reliable delivery.
      // reply_to points to the claims mailbox so customer replies land there.
      from: "Buy a Warranty Claims <noreply@notify.buyawarranty.co.uk>",
      to: [email],
      reply_to: "claims@buyawarranty.co.uk",
      subject: `We've received your claim — ${customerRef}`,
      html: customerEmailHtml,
      intendedFor: email,
    }));


    if (customerEmailResponse.error) {
      console.error('Customer confirmation email sending error:', customerEmailResponse.error);
    } else {
      console.log('Customer confirmation email sent:', customerEmailResponse.data?.id);
    }

    await logCustomerEmail({
      recipient_email: email,
      recipient_name: name,
      subject: `We've received your claim — ${customerRef}`,
      template_name: 'claim_confirmation',
      source_function: 'submit-claim',
      status: 'sent',
      registration_plate: regPlateDisplay,
      metadata: { submission_id: submissionData.id, warranty_number: warrantyNumber }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        submissionId: submissionData.id,
        message: "Claim submitted successfully. You will receive a confirmation email shortly."
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in submit-claim function:", error);
    return new Response(
      JSON.stringify({ 
        error: "Failed to submit claim. Please try again or contact us directly.",
        details: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
