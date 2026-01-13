import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, firstName, vehicleMake, vehicleModel } = await req.json();

    console.log('Received SMS request:', { phone, firstName, vehicleMake, vehicleModel });

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

    // Build personalized message
    const customerName = firstName?.trim() || 'there';
    const vehicleInfo = vehicleMake && vehicleModel 
      ? ` for your ${vehicleMake} ${vehicleModel}` 
      : '';
    
    const message = `Hi ${customerName}! Thanks for getting a quote with BuyAWarranty${vehicleInfo}. Your personalised warranty prices are ready to view. Any questions? Reply to this text or call us on 0800 917 9270 - Team BAW`;

    console.log('Sending SMS message:', message);

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
            body: message,
            to: formattedPhone,
            from: 'BuyWarranty',
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
