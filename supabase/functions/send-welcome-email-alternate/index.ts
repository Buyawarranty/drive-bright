import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

function logStep(step: string, details?: any) {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-WELCOME-ALTERNATE] ${timestamp} ${step}${detailsStr}`);
}

interface EmailRequest {
  policyId: string;
  customerId: string;
  alternateEmail: string;
  customerName?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const body: EmailRequest = await req.json();
    const { policyId, customerId, alternateEmail, customerName } = body;
    
    logStep("Request received", { policyId, customerId, alternateEmail });
    
    if (!policyId || !alternateEmail) {
      return new Response(JSON.stringify({ 
        error: 'policyId and alternateEmail are required' 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get policy and customer data
    const { data: policy, error: policyError } = await supabase
      .from('customer_policies')
      .select(`
        *,
        customers!customer_id (
          id, name, email, first_name, last_name, registration_plate,
          vehicle_make, vehicle_model, vehicle_year
        )
      `)
      .eq('id', policyId)
      .single();

    if (policyError || !policy) {
      logStep("Policy not found", { policyId, error: policyError?.message });
      return new Response(JSON.stringify({ 
        error: 'Policy not found' 
      }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const customer = policy.customers;
    const displayName = customerName || customer?.first_name || customer?.name || 'Customer';
    
    logStep("Data loaded", { 
      warrantyNumber: policy.warranty_number, 
      planType: policy.plan_type 
    });

    // Helper function to encode binary to base64
    const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 0x8000;
      
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode(...chunk);
      }
      
      return btoa(binary);
    };

    // Load PDF attachments
    const attachments = [];
    
    try {
      const termsResponse = await fetch('https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/terms/terms-and-conditions-v3.1-2026-02.pdf');
      if (termsResponse.ok) {
        const termsBuffer = await termsResponse.arrayBuffer();
        attachments.push({
          filename: 'Terms-and-Conditions-v3.1.pdf',
          content: arrayBufferToBase64(termsBuffer),
          type: 'application/pdf',
          disposition: 'attachment'
        });
      }

      const platinumResponse = await fetch('https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/platinum/platinum-warranty-plan-v3.1-2026-02.pdf');
      if (platinumResponse.ok) {
        const platinumBuffer = await platinumResponse.arrayBuffer();
        attachments.push({
          filename: 'Platinum-Warranty-Plan-v3.1.pdf',
          content: arrayBufferToBase64(platinumBuffer),
          type: 'application/pdf',
          disposition: 'attachment'
        });
      }
    } catch (pdfError) {
      logStep("PDF loading error", { error: pdfError instanceof Error ? pdfError.message : String(pdfError) });
    }

    logStep("PDFs loaded", { attachmentCount: attachments.length });

    // Format dates
    const startDate = policy.policy_start_date 
      ? new Date(policy.policy_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'N/A';
    const endDate = policy.policy_end_date 
      ? new Date(policy.policy_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'N/A';

    const vehicleInfo = customer?.registration_plate 
      ? `${customer.vehicle_make || ''} ${customer.vehicle_model || ''} (${customer.registration_plate})`.trim()
      : 'N/A';

    // Build email HTML
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Your Warranty Confirmation</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 30px 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px 20px; background: #ffffff; }
            .warranty-box { background: #f8fafc; border: 2px solid #f97316; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .warranty-number { font-size: 24px; font-weight: bold; color: #f97316; text-align: center; }
            .details-grid { display: table; width: 100%; margin: 20px 0; }
            .detail-row { display: table-row; }
            .detail-label { display: table-cell; padding: 8px 0; font-weight: bold; width: 40%; }
            .detail-value { display: table-cell; padding: 8px 0; }
            .button { display: inline-block; background: #f97316; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
            .footer { padding: 20px; font-size: 12px; color: #666; text-align: center; background: #f8fafc; }
            .note { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🛡️ Your Warranty is Confirmed!</h1>
            </div>
            <div class="content">
                <p>Dear ${displayName},</p>
                
                <p>Great news! Your vehicle warranty has been successfully activated. Here are your policy details:</p>
                
                <div class="warranty-box">
                    <p style="margin: 0 0 10px 0; text-align: center; font-size: 14px;">Your Warranty Number</p>
                    <p class="warranty-number">${policy.warranty_number || 'Pending'}</p>
                </div>
                
                <div class="details-grid">
                    <div class="detail-row">
                        <span class="detail-label">Policy Number:</span>
                        <span class="detail-value">${policy.policy_number}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Plan Type:</span>
                        <span class="detail-value">${policy.plan_type}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Vehicle:</span>
                        <span class="detail-value">${vehicleInfo}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Coverage Period:</span>
                        <span class="detail-value">${startDate} to ${endDate}</span>
                    </div>
                </div>
                
                <div class="note">
                    <strong>📄 Important Documents Attached</strong><br>
                    Please find your Terms & Conditions and Warranty Plan documents attached to this email. Keep these for your records.
                </div>
                
                <p style="text-align: center;">
                    <a href="https://buyawarranty.co.uk/customer-dashboard" class="button">Access Your Dashboard</a>
                </p>
                
                <p>If you have any questions about your coverage, please don't hesitate to contact our support team.</p>
                
                <p>Best regards,<br><strong>The Buy-A-Warranty Team</strong></p>
            </div>
            <div class="footer">
                <p>© 2025 Buy-A-Warranty. All rights reserved.</p>
                <p>This email was sent to ${alternateEmail} as requested.</p>
                <p>Original policy holder: ${customer?.email || 'N/A'}</p>
            </div>
        </div>
    </body>
    </html>
    `;

    // Send email via Resend
    const emailPayload: any = {
      from: 'Buyawarranty Customer Care <info@buyawarranty.co.uk>',
      to: [alternateEmail],
      subject: `Your Warranty Confirmation - ${policy.policy_number}`,
      html: emailHtml,
    };

    if (attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      logStep("Email send failed", { status: emailResponse.status, error: errorText });
      throw new Error(`Email send failed: ${errorText}`);
    }

    const emailResult = await emailResponse.json();
    logStep("Email sent successfully", { emailId: emailResult.id, to: alternateEmail });

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResult.id,
      sentTo: alternateEmail 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ 
      error: errorMessage 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
