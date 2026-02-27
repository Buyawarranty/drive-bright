import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Welcome message for new leads
const WELCOME_MESSAGE = `Your vehicle warranty quote is ready. Lock in your cover in under 60 seconds at https://buyawarranty.co.uk or call 0330 229 5040.`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, firstName, vehicleMake, vehicleModel, leadId, abandonedCartId } = await req.json();

    console.log('Received SMS request:', { phone, firstName, vehicleMake, vehicleModel, leadId, abandonedCartId });

    // Validate phone number
    if (!phone) {
      console.error('No phone number provided');
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get ClickSend credentials
    const clicksendUsername = Deno.env.get('CLICKSEND_USERNAME');
    const clicksendApiKey = Deno.env.get('CLICKSEND_API_KEY');

    if (!clicksendUsername || !clicksendApiKey) {
      console.error('ClickSend credentials not configured');
      return new Response(
        JSON.stringify({ error: 'ClickSend credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number to international format
    let formattedPhone = phone.trim().replace(/\s+/g, '');
    
    // Convert UK numbers to international format
    if (formattedPhone.startsWith('07')) {
      formattedPhone = '+44' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('0')) {
      formattedPhone = '+44' + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+44' + formattedPhone;
    }

    console.log('Formatted phone number:', formattedPhone);

    // Build vehicle info string for storage
    const vehicleInfo = vehicleMake && vehicleModel 
      ? `${vehicleMake} ${vehicleModel}` 
      : null;

    console.log('Sending welcome SMS message:', WELCOME_MESSAGE);

    // Create Basic Auth header
    const authString = btoa(`${clicksendUsername}:${clicksendApiKey}`);

    // Send SMS via ClickSend API
    const response = await fetch('https://rest.clicksend.com/v3/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify({
        messages: [
          {
            source: 'sdk',
            body: WELCOME_MESSAGE,
            to: formattedPhone,
            from: '+447344286145',
          }
        ]
      }),
    });

    const responseData = await response.json();
    console.log('ClickSend API response:', JSON.stringify(responseData));

    if (!response.ok) {
      console.error('ClickSend API error:', responseData);
      return new Response(
        JSON.stringify({ error: 'Failed to send SMS', details: responseData }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('SMS sent successfully to:', formattedPhone);

    // Create consent record in database
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        // Upsert SMS consent record
        const { error: consentError } = await supabase
          .from('sms_consents')
          .upsert({
            phone: phone,
            normalized_phone: formattedPhone,
            consent_status: 'pending',
            customer_name: firstName || null,
            vehicle_info: vehicleInfo,
            lead_id: leadId || null,
            abandoned_cart_id: abandonedCartId || null,
            last_message_sent: WELCOME_MESSAGE,
            last_interaction_at: new Date().toISOString(),
          }, {
            onConflict: 'normalized_phone',
          });

        if (consentError) {
          console.error('Error creating consent record:', consentError);
        } else {
          console.log('SMS consent record created/updated for:', formattedPhone);
        }
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Don't fail the request if DB insert fails - SMS was still sent
    }

    return new Response(
      JSON.stringify({ success: true, message: 'SMS sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-clicksend-sms function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
