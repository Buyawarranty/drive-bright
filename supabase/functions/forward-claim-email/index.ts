import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ForwardClaimRequest {
  claimId: string;
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

    const { claimId } = await req.json() as ForwardClaimRequest;

    // Fetch the claim details
    const { data: claim, error: claimError } = await supabaseClient
      .from('claims_submissions')
      .select('*')
      .eq('id', claimId)
      .single();

    if (claimError || !claim) {
      console.error('Error fetching claim:', claimError);
      return new Response(
        JSON.stringify({ error: 'Claim not found' }),
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
      <h3>New Claim Submission (Forwarded)</h3>
      <p><strong>Name:</strong> ${claim.name}</p>
      <p><strong>Email:</strong> ${claim.email}</p>
      <p><strong>Phone:</strong> ${claim.phone || 'Not provided'}</p>
      <p><strong>Submitted:</strong> ${new Date(claim.created_at).toLocaleString()}</p>
      
      <h4>Message:</h4>
      <p>${claim.message || 'No message provided'}</p>
    `;

    if (claim.file_url && claim.file_name) {
      emailHtml += `
        <h4>Attachment:</h4>
        <p>File: ${claim.file_name}</p>
        <p>Download: <a href="${claim.file_url}">${claim.file_name}</a></p>
      `;
    }

    // Send email to claims team
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'support@buyawarranty.co.uk',
        to: ['claims@buyawarranty.co.uk', 'info@buyawarranty.co.uk'],
        subject: `[FORWARDED] New Claim Submission from ${claim.name}`,
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

    console.log('Claim email forwarded successfully for claim:', claimId);

    return new Response(
      JSON.stringify({ success: true, message: 'Claim email forwarded successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in forward-claim-email function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});