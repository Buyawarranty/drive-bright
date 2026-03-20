import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
  file?: {
    name: string;
    size: number;
    type: string;
    data: string;
  };
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

    const { name, email, phone, vehicleReg, currentMileage, faultDescription, dateOccurred, faultDetails, issueTiming, additionalInfo, file }: ClaimSubmissionRequest = await req.json();

    console.log('Received claim submission:', { name, email, phone: phone || 'N/A', vehicleReg: vehicleReg || 'N/A' });

    // --- Look up customer by reg plate to get purchase mileage & warranty start date ---
    let purchaseMileage: number | null = null;
    let warrantyStartDate: string | null = null;
    let daysOnRisk: number | null = null;
    let mileageDriven: number | null = null;

    if (vehicleReg) {
      const normalizedReg = vehicleReg.replace(/\s+/g, '').toUpperCase();
      
      // Try customers table first
      const { data: customerData } = await supabase
        .from('customers')
        .select('mileage, signup_date, registration_plate')
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

    let fileUrl = null;
    let fileName = null;
    let fileSize = null;
    let fileBase64Content = null;

    // Handle file upload if present
    if (file && file.data) {
      try {
        fileBase64Content = file.data.split(',')[1];
        const binaryString = atob(fileBase64Content);
        const fileData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          fileData[i] = binaryString.charCodeAt(i);
        }
        const timestamp = Date.now();
        const uniqueFileName = `${timestamp}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('policy-documents')
          .upload(`claim-attachments/${uniqueFileName}`, fileData, {
            contentType: file.type,
          });

        if (uploadError) {
          console.error('File upload error:', uploadError);
        } else {
          fileUrl = uploadData.path;
          fileName = file.name;
          fileSize = file.size;
          console.log('File uploaded successfully:', fileUrl);
        }
      } catch (fileError) {
        console.error('Error processing file:', fileError);
      }
    }

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

    // Store submission in database with risk data
    const { data: submissionData, error: dbError } = await supabase
      .from('claims_submissions')
      .insert([
        {
          name,
          email,
          phone: phone || null,
          message: claimMessage || null,
          file_url: fileUrl,
          file_name: fileName,
          file_size: fileSize,
          status: 'new',
          vehicle_registration: vehicleReg || null,
          mileage_at_claim: currentMileage || null,
          purchase_mileage: purchaseMileage,
          mileage_driven: mileageDriven,
          days_on_risk: daysOnRisk,
          warranty_start_date: warrantyStartDate,
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
        
        ${fileName ? `
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h2 style="color: #333; margin-top: 0;">📎 Attachment</h2>
          <p><strong>File:</strong> ${fileName}</p>
          <p><strong>Size:</strong> ${fileSize ? Math.round(fileSize / 1024) + ' KB' : 'Unknown'}</p>
          ${fileUrl ? `<p><a href="https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/${fileUrl}" style="color: #eb4b00; text-decoration: underline;">Download Attachment</a></p>` : ''}
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
    const emailPayload: any = {
      from: "Buyawarranty Customer Care <noreply@buyawarranty.co.uk>",
      to: ["support@buyawarranty.co.uk", "support@warranties2000.co.uk"],
      subject: emailSubject,
      html: emailHtml,
    };

    if (fileBase64Content && fileName) {
      emailPayload.attachments = [
        {
          filename: fileName,
          content: fileBase64Content,
        }
      ];
      console.log('Adding attachment to email:', fileName);
    }

    const emailResponse = await resend.emails.send(emailPayload);

    if (emailResponse.error) {
      console.error('Email sending error:', emailResponse.error);
    } else {
      console.log('Email sent successfully with attachment:', emailResponse.data?.id);
    }

    // Send confirmation email to customer
    const customerEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #eb4b00;">Claim Submission Received</h1>
        
        <p>Dear ${name},</p>
        
        <p>Thank you for submitting your claim for vehicle registration: <strong>${regPlateDisplay}</strong>. We've received your request and our team will review it during our working hours.</p>
        
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Submission ID:</strong> ${submissionData.id}</p>
          <p style="margin: 10px 0 0 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <p><strong>We'll respond Monday–Friday, 9:00 AM–5:00 PM.</strong></p>
        
        <p>If you need urgent assistance during these hours, you can:</p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;"><strong>Call us:</strong> 0330 229 5045</li>
          <li><strong>Email us:</strong> <a href="mailto:claims@buyawarranty.co.uk" style="color: #eb4b00;">claims@buyawarranty.co.uk</a></li>
        </ul>
        
        <p>Thank you for your patience – we're here to help!</p>
        
        <p style="margin-top: 30px;">Best regards,</p>
        <p style="margin: 5px 0;"><strong>Buy a Warranty Claims Team</strong></p>
      </div>
    `;

    await resend.emails.send({
      from: "Buyawarranty Customer Care <claims@buyawarranty.co.uk>",
      to: [email],
      subject: "Claim Submission Received",
      html: customerEmailHtml,
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
