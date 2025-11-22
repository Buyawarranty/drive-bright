import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ForwardContactRequest {
  submissionId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { submissionId } = await req.json() as ForwardContactRequest;

    // Fetch the contact submission details
    const { data: submission, error: submissionError } = await supabaseClient
      .from('contact_submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (submissionError || !submission) {
      console.error('Error fetching contact submission:', submissionError);
      return new Response(
        JSON.stringify({ error: 'Contact submission not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Resend
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not found');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare email content
    let emailHtml = `
      <h3>New Contact Submission (Forwarded)</h3>
      <p><strong>Name:</strong> ${submission.name}</p>
      <p><strong>Email:</strong> ${submission.email}</p>
      <p><strong>Phone:</strong> ${submission.phone || 'Not provided'}</p>
      <p><strong>Submitted:</strong> ${new Date(submission.created_at).toLocaleString()}</p>
      
      <h4>Message:</h4>
      <p>${submission.message || 'No message provided'}</p>
    `;

    if (submission.file_url && submission.file_name) {
      emailHtml += `
        <h4>Attachment:</h4>
        <p>File: ${submission.file_name}</p>
        <p>Download: <a href="${submission.file_url}">${submission.file_name}</a></p>
      `;
    }

    // Send email to support team
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'support@buyawarranty.co.uk',
        to: ['support@buyawarranty.co.uk'],
        subject: `[FORWARDED] New Contact from ${submission.name}`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Failed to send email:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to forward email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Contact email forwarded successfully for submission:', submissionId);

    return new Response(
      JSON.stringify({ success: true, message: 'Contact email forwarded successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in forward-contact-email function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});