import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Response messages
const MESSAGES = {
  OPT_IN: (_name?: string) => `We'll call you shortly with your best price. Prefer to speak now? Call 0330 229 5040.`,
  
  OPT_OUT: `You're opted out from BuyaWarranty. No further messages will be sent.`,

  STOP: `You're opted out from BuyaWarranty. No further messages will be sent.`,
  
  RE_SUBSCRIBE: `Thanks for reconnecting with us.

A BuyaWarranty expert will be in touch shortly to help you with your warranty options.

If you would like to speak to us now, call 0330 229 5040.`,
};

// Helper to send SMS via ClickSend
async function sendSms(phone: string, message: string, authString: string): Promise<boolean> {
  try {
    const response = await fetch('https://rest.clicksend.com/v3/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify({
        messages: [
          {
            source: 'webhook',
            body: message,
            to: phone,
            from: '+447344286145',
          }
        ]
      }),
    });

    const responseData = await response.json();
    console.log('ClickSend response:', JSON.stringify(responseData));
    
    return response.ok;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return false;
  }
}

// Normalize phone to +44 format
function normalizePhone(phone: string): string {
  let formatted = phone.trim().replace(/\s+/g, '');
  
  if (formatted.startsWith('07')) {
    formatted = '+44' + formatted.substring(1);
  } else if (formatted.startsWith('0')) {
    formatted = '+44' + formatted.substring(1);
  } else if (!formatted.startsWith('+')) {
    formatted = '+44' + formatted;
  }
  
  return formatted;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('SMS Webhook received request');

  try {
    // ClickSend sends webhook data as form-urlencoded or JSON
    let incomingPhone: string;
    let messageBody: string;
    
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const data = await req.json();
      console.log('Webhook JSON payload:', JSON.stringify(data));
      
      // ClickSend format: from, to, body, etc.
      incomingPhone = data.from || data.message_from || data.sender || '';
      messageBody = data.body || data.message_body || data.message || '';
    } else {
      // Handle form-urlencoded data
      const formData = await req.formData();
      console.log('Webhook form data received');
      
      incomingPhone = formData.get('from')?.toString() || formData.get('sender')?.toString() || '';
      messageBody = formData.get('body')?.toString() || formData.get('message')?.toString() || '';
    }

    console.log('Parsed incoming SMS:', { phone: incomingPhone, message: messageBody });

    if (!incomingPhone || !messageBody) {
      console.error('Missing phone or message in webhook payload');
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize the incoming phone number
    const normalizedPhone = normalizePhone(incomingPhone);
    const messageUpper = messageBody.trim().toUpperCase();

    console.log('Processing reply:', { normalizedPhone, messageUpper });

    // Get credentials
    const clicksendUsername = Deno.env.get('CLICKSEND_USERNAME');
    const clicksendApiKey = Deno.env.get('CLICKSEND_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!clicksendUsername || !clicksendApiKey) {
      console.error('ClickSend credentials not configured');
      return new Response(
        JSON.stringify({ error: 'ClickSend credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Database credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authString = btoa(`${clicksendUsername}:${clicksendApiKey}`);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up the consent record
    const { data: consentRecord, error: lookupError } = await supabase
      .from('sms_consents')
      .select('*')
      .eq('normalized_phone', normalizedPhone)
      .single();

    if (lookupError && lookupError.code !== 'PGRST116') {
      console.error('Error looking up consent record:', lookupError);
    }

    let responseMessage: string;
    let newStatus: 'opted_in' | 'opted_out' | 'pending';
    let updateData: Record<string, unknown>;

    // Determine response based on message content
    if (messageUpper === 'YES' || messageUpper === 'Y') {
      // Get customer name from consent record if available
      const customerName = consentRecord?.customer_name || null;
      responseMessage = MESSAGES.OPT_IN(customerName);
      newStatus = 'opted_in';
      updateData = {
        consent_status: newStatus,
        consent_given_at: new Date().toISOString(),
        last_message_received: messageBody,
        last_message_sent: responseMessage,
        last_interaction_at: new Date().toISOString(),
      };
      console.log('Customer opted IN');
      
    } else if (messageUpper === 'NO' || messageUpper === 'N') {
      responseMessage = MESSAGES.OPT_OUT;
      newStatus = 'opted_out';
      updateData = {
        consent_status: newStatus,
        opted_out_at: new Date().toISOString(),
        last_message_received: messageBody,
        last_message_sent: responseMessage,
        last_interaction_at: new Date().toISOString(),
      };
      console.log('Customer opted OUT');

    } else if (messageUpper === 'STOP') {
      responseMessage = MESSAGES.STOP;
      newStatus = 'opted_out';
      updateData = {
        consent_status: newStatus,
        opted_out_at: new Date().toISOString(),
        last_message_received: messageBody,
        last_message_sent: responseMessage,
        last_interaction_at: new Date().toISOString(),
      };
      console.log('Customer STOPPED');
      
    } else if (messageUpper === 'BACK' || messageUpper === 'START') {
      responseMessage = MESSAGES.RE_SUBSCRIBE;
      newStatus = 'opted_in';
      updateData = {
        consent_status: newStatus,
        consent_given_at: new Date().toISOString(),
        opted_out_at: null,
        last_message_received: messageBody,
        last_message_sent: responseMessage,
        last_interaction_at: new Date().toISOString(),
      };
      console.log('Customer RE-SUBSCRIBED');
      
    } else {
      // Unknown response - just log it, don't send a reply
      console.log('Unknown response received, logging for manual review:', messageBody);
      
      if (consentRecord) {
        await supabase
          .from('sms_consents')
          .update({
            last_message_received: messageBody,
            last_interaction_at: new Date().toISOString(),
          })
          .eq('normalized_phone', normalizedPhone);
      }
      
      return new Response(
        JSON.stringify({ success: true, action: 'logged_unknown_response' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update or create consent record
    if (consentRecord) {
      const { error: updateError } = await supabase
        .from('sms_consents')
        .update(updateData)
        .eq('normalized_phone', normalizedPhone);

      if (updateError) {
        console.error('Error updating consent record:', updateError);
      }
    } else {
      // Create new record if it doesn't exist (edge case - received reply without initial message)
      const { error: insertError } = await supabase
        .from('sms_consents')
        .insert({
          phone: incomingPhone,
          normalized_phone: normalizedPhone,
          ...updateData,
        });

      if (insertError) {
        console.error('Error creating consent record:', insertError);
      }
    }

    // Send response SMS
    const smsSent = await sendSms(normalizedPhone, responseMessage, authString);
    
    if (!smsSent) {
      console.error('Failed to send response SMS');
      return new Response(
        JSON.stringify({ error: 'Failed to send response SMS' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Response SMS sent successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        action: newStatus,
        phone: normalizedPhone 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sms-webhook function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
