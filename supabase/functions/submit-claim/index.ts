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
    data: string; // base64 encoded file data
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
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

    let fileUrl = null;
    let fileName = null;
    let fileSize = null;
    let fileBase64Content = null; // Store base64 content for email attachment

    // Handle file upload if present
    if (file && file.data) {
      try {
        // Extract base64 content (remove data URL prefix)
        fileBase64Content = file.data.split(',')[1];
        
        // Convert base64 to Uint8Array for storage upload
        const binaryString = atob(fileBase64Content);
        const fileData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          fileData[i] = binaryString.charCodeAt(i);
        }

        // Generate unique filename
        const timestamp = Date.now();
        const uniqueFileName = `${timestamp}-${file.name}`;

        // Upload to Supabase Storage
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

    // Store submission in database
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
          status: 'new'
        }
      ])
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to store submission');
    }

    console.log('Submission stored in database:', submissionData.id);

    // Prepare email content with all form fields
    const emailSubject = `New Claim Submission from ${name}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #eb4b00;">New Claim Submission</h1>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Contact Information</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #333; margin-top: 0;">Vehicle Details</h2>
          <p><strong>Vehicle Reg/Make/Model:</strong> ${vehicleReg || 'Not provided'}</p>
          ${currentMileage ? `<p><strong>Current Mileage:</strong> ${currentMileage.toLocaleString()} miles</p>` : ''}
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
      from: "Claims System <noreply@buyawarranty.co.uk>",
      to: ["claims@buyawarranty.co.uk", "info@buyawarranty.co.uk"],
      subject: emailSubject,
      html: emailHtml,
    };

    // Add attachment if file was uploaded
    if (fileBase64Content && fileName) {
      emailPayload.attachments = [
        {
          filename: fileName,
          content: fileBase64Content,
        }
      ];
      console.log('Adding attachment to email:', fileName);
    }

    // Send email to claims team
    const emailResponse = await resend.emails.send(emailPayload);

    if (emailResponse.error) {
      console.error('Email sending error:', emailResponse.error);
      // Don't fail the submission if email fails, just log the error
    } else {
      console.log('Email sent successfully with attachment:', emailResponse.data?.id);
    }

    // Send confirmation email to customer
    const customerEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #eb4b00;">Claim Submission Received</h1>
        
        <p>Dear ${name},</p>
        
        <p>Thank you for submitting your claim. We have received your request and our team will review it shortly.</p>
        
        <div style="background-color: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Submission ID:</strong> ${submissionData.id}</p>
          <p style="margin: 5px 0 0 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <p>Our claims team will contact you within 1-2 business days. If you have any urgent questions, please call us at <strong>0330 229 5045</strong>.</p>
        
        <p>Best regards,<br>
        Buy a Warranty Claims Team</p>
        
        <hr style="margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          Buy a Warranty | Claims Department<br>
          Email: claims@buyawarranty.co.uk | Phone: 0330 229 5045
        </p>
      </div>
    `;

    await resend.emails.send({
      from: "Buy a Warranty <claims@buyawarranty.co.uk>",
      to: [email],
      subject: "Claim Submission Confirmation - " + submissionData.id,
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