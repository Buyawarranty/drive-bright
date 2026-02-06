import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppMessageRequest {
  phone: string;
  email?: string;
  firstName?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  leadId?: string;
  abandonedCartId?: string;
}

// Normalize UK phone numbers to international format
function normalizePhoneNumber(phone: string): string {
  let normalized = phone.trim().replace(/\s+/g, '');
  
  // Remove any non-digit characters except +
  normalized = normalized.replace(/[^\d+]/g, '');
  
  // Convert UK numbers to international format
  if (normalized.startsWith('07')) {
    normalized = '+44' + normalized.substring(1);
  } else if (normalized.startsWith('0')) {
    normalized = '+44' + normalized.substring(1);
  } else if (normalized.startsWith('44') && !normalized.startsWith('+')) {
    normalized = '+' + normalized;
  } else if (!normalized.startsWith('+')) {
    normalized = '+44' + normalized;
  }
  
  return normalized;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const uchatWebhookUrl = Deno.env.get('UCHAT_WEBHOOK_URL');

    if (!uchatWebhookUrl) {
      console.error('UCHAT_WEBHOOK_URL secret not configured');
      return new Response(
        JSON.stringify({ error: "uChat webhook URL not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const data: WhatsAppMessageRequest = await req.json();

    // Validate phone number exists
    if (!data.phone || data.phone.trim() === '') {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const normalizedPhone = normalizePhoneNumber(data.phone);
    console.log(`📱 Processing WhatsApp message for: ${normalizedPhone}`);

    // Deduplication temporarily disabled for testing
    console.log(`🔓 Deduplication disabled - proceeding with message to ${normalizedPhone}`);

    // Create pending log entry
    const { data: logEntry, error: insertError } = await supabase
      .from('whatsapp_message_log')
      .insert([{
        phone: data.phone,
        normalized_phone: normalizedPhone,
        message_type: 'welcome',
        status: 'pending',
        lead_id: data.leadId || null,
        abandoned_cart_id: data.abandonedCartId || null
      }])
      .select('id')
      .single();

    if (insertError) {
      console.error('Error creating log entry:', insertError);
    }

    // Prepare payload for uChat webhook
    const uchatPayload = {
      phone: normalizedPhone,
      email: data.email || '',
      firstName: data.firstName || 'there',
      vehicleMake: data.vehicleMake || '',
      vehicleModel: data.vehicleModel || ''
    };

    console.log(`📤 Sending to uChat webhook:`, uchatPayload);

    // Send to uChat webhook
    const uchatResponse = await fetch(uchatWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(uchatPayload)
    });

    const responseText = await uchatResponse.text();
    let uchatResponseData: any = null;
    
    try {
      uchatResponseData = JSON.parse(responseText);
    } catch {
      uchatResponseData = { raw: responseText };
    }

    console.log(`📥 uChat response (${uchatResponse.status}):`, uchatResponseData);

    // Update log entry with result
    if (logEntry?.id) {
      if (uchatResponse.ok) {
        await supabase
          .from('whatsapp_message_log')
          .update({
            status: 'sent',
            uchat_response: uchatResponseData
          })
          .eq('id', logEntry.id);
        
        console.log(`✅ WhatsApp welcome message sent successfully to ${normalizedPhone}`);
      } else {
        await supabase
          .from('whatsapp_message_log')
          .update({
            status: 'failed',
            uchat_response: uchatResponseData,
            error_message: `HTTP ${uchatResponse.status}: ${responseText}`
          })
          .eq('id', logEntry.id);
        
        console.error(`❌ Failed to send WhatsApp message: HTTP ${uchatResponse.status}`);
      }
    }

    if (!uchatResponse.ok) {
      return new Response(
        JSON.stringify({ 
          error: "Failed to send WhatsApp message",
          details: uchatResponseData
        }),
        { status: uchatResponse.status, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "WhatsApp welcome message sent successfully",
        logId: logEntry?.id
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-uchat-whatsapp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
