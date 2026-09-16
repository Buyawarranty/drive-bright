import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from "https://esm.sh/resend@2.0.0";
import { logCustomerEmail } from '../_shared/log-email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContactSubmissionRequest {
  name: string;
  email: string;
  phone?: string;
  message?: string;
  file?: {
    name: string;
    size: number;
    type: string;
    data: string; // base64
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const resend = new Resend(resendApiKey);

    const body: ContactSubmissionRequest = await req.json();

    console.log('Processing contact submission:', {
      name: body.name,
      email: body.email,
      phone: body.phone,
      hasFile: !!body.file,
      fileName: body.file?.name
    });

    let fileUrl = null;
    let fileName = null;
    let fileSize = null;

    // Handle file upload if provided
    if (body.file) {
      try {
        // Convert base64 to Uint8Array
        const base64Data = body.file.data.split(',')[1];
        const fileBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        
        // Generate unique filename
        const timestamp = Date.now();
        const uniqueFileName = `${timestamp}_${body.file.name}`;
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('policy-documents')
          .upload(`contact-attachments/${uniqueFileName}`, fileBytes, {
            contentType: body.file.type,
          });

        if (uploadError) {
          console.error('File upload error:', uploadError);
        } else {
          // Get public URL
          const { data: urlData } = supabase.storage
            .from('policy-documents')
            .getPublicUrl(`contact-attachments/${uniqueFileName}`);
          
          fileUrl = urlData.publicUrl;
          fileName = body.file.name;
          fileSize = body.file.size;
          console.log('File uploaded successfully:', fileUrl);
        }
      } catch (fileError) {
        console.error('File processing error:', fileError);
        // Continue without file if upload fails
      }
    }

    // Insert into contact_submissions table
    const { data: submission, error: dbError } = await supabase
      .from('contact_submissions')
      .insert({
        name: body.name,
        email: body.email,
        phone: body.phone || null,
        message: body.message || null,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        status: 'new'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(JSON.stringify({ error: 'Failed to save contact submission' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Contact submission saved:', submission.id);

    // Send email notification
    try {
      const emailContent = `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${body.name}</p>
        <p><strong>Email:</strong> ${body.email}</p>
        ${body.phone ? `<p><strong>Phone:</strong> ${body.phone}</p>` : ''}
        ${body.message ? `<p><strong>Message:</strong><br>${body.message.replace(/\n/g, '<br>')}</p>` : ''}
        ${fileUrl ? `<p><strong>File Attached:</strong> <a href="${fileUrl}" target="_blank">${fileName}</a></p>` : ''}
        <hr>
        <p><small>Submitted on: ${new Date().toLocaleString()}</small></p>
        <p><small>Submission ID: ${submission.id}</small></p>
      `;

      const emailResponse = await resend.emails.send({
        from: 'BuyaWarranty Team <noreply@buyawarranty.co.uk>',
        to: ['support@buyawarranty.co.uk'],
        subject: `New Contact Form Submission from ${body.name}`,
        html: emailContent,
      });

      console.log('Contact notification email sent:', emailResponse);

      // Send confirmation email to customer
      const confirmationEmailContent = `
        <div style="font-family: Arial, sans-serif; color: #1a1a1a; line-height: 1.6; max-width: 600px;">
          <p>Dear ${body.name},</p>

          <p>Thank you for getting in touch with Buy a Warranty.</p>

          <p>We've successfully received your enquiry and a member of our customer support team will review your message and get back to you as soon as possible, usually within <strong>1–2 business days</strong>.</p>

          ${body.message ? `
            <p>For your reference, here is a copy of your message:</p>
            <blockquote style="border-left: 3px solid #ddd; padding: 10px 15px; margin: 15px 0; color: #555; background: #f9f9f9;">
              ${body.message.replace(/\n/g, '<br>')}
            </blockquote>
          ` : ''}

          <p style="margin-top: 25px;"><strong>Why customers choose Buy a Warranty:</strong></p>
          <ul style="padding-left: 20px;">
            <li>UK-based support team</li>
            <li>Simple and straightforward claims process</li>
            <li>Flexible warranty options for most vehicles</li>
            <li>Friendly customer service you can rely on</li>
          </ul>

          <p>We appreciate you contacting us and look forward to assisting you.</p>

          <p style="margin-top: 25px;">Kind regards,<br>
          <strong>Customer Support Team</strong><br>
          Buy a Warranty</p>

          <p style="margin-top: 15px;">
            📞 <a href="tel:03302295045" style="color: #1a1a1a; text-decoration: none;">0330 229 5045</a><br>
            📧 <a href="mailto:support@buyawarranty.co.uk" style="color: #1a1a1a; text-decoration: none;">support@buyawarranty.co.uk</a>
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
          <p style="font-size: 12px; color: #999;">Reference ID: ${submission.id}</p>
        </div>
      `;

      const confirmationResponse = await resend.emails.send({
        from: 'Buy a Warranty <support@buyawarranty.co.uk>',
        to: [body.email],
        subject: "We've Received Your Enquiry – Buy a Warranty",
        html: confirmationEmailContent,
      });

      console.log('Confirmation email sent:', confirmationResponse);
      await logCustomerEmail({
        recipient_email: body.email,
        recipient_name: body.name,
        subject: "We've Received Your Enquiry – Buy a Warranty",
        template_name: 'contact_confirmation',
        source_function: 'submit-contact',
        status: (confirmationResponse as any)?.error ? 'failed' : 'sent',
        error_message: (confirmationResponse as any)?.error ? String((confirmationResponse as any).error?.message || (confirmationResponse as any).error) : null,
        metadata: { submission_id: submission.id, resend_message_id: (confirmationResponse as any)?.data?.id },
      });


    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Continue even if email fails
    }

    return new Response(JSON.stringify({ 
      success: true, 
      id: submission.id 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Contact submission error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'An unexpected error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);