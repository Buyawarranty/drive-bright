import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from "https://esm.sh/resend@2.0.0";

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
        from: 'Buy a Warranty <noreply@buyawarranty.co.uk>',
        to: ['support@buyawarranty.co.uk'],
        subject: `New Contact Form Submission from ${body.name}`,
        html: emailContent,
      });

      console.log('Contact notification email sent:', emailResponse);

      // Send confirmation email to customer
      const confirmationEmailContent = `
        <h2>Thank you for contacting us!</h2>
        <p>Dear ${body.name},</p>
        <p>We have received your message and will get back to you within 1-2 business days.</p>
        ${body.message ? `<p><strong>Your message:</strong><br>${body.message.replace(/\n/g, '<br>')}</p>` : ''}
        <p>If you have any urgent queries, please don't hesitate to contact us:</p>
        <ul>
          <li>Email: support@buyawarranty.co.uk</li>
          <li>Phone: 0330 229 5040</li>
        </ul>
        <p>Best regards,<br>The Buy a Warranty Team</p>
        <hr>
        <p><small>Reference ID: ${submission.id}</small></p>
      `;

      const confirmationResponse = await resend.emails.send({
        from: 'Buy a Warranty <support@buyawarranty.co.uk>',
        to: [body.email],
        subject: 'Thank you for contacting Buy a Warranty',
        html: confirmationEmailContent,
      });

      console.log('Confirmation email sent:', confirmationResponse);

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