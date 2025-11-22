import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 1x1 transparent pixel
const TRACKING_PIXEL = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
  0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b
]);

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const trackingId = url.searchParams.get('tracking_id');

    if (!trackingId) {
      // Return tracking pixel anyway
      return new Response(TRACKING_PIXEL, {
        headers: {
          'Content-Type': 'image/gif',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          ...corsHeaders,
        },
      });
    }

    // Find the email log by tracking ID
    const { data: emailLog, error: findError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('tracking_id', trackingId)
      .single();

    if (!findError && emailLog && !emailLog.open_tracked) {
      // Update email log
      await supabase
        .from('email_logs')
        .update({
          open_tracked: true,
          opened_at: new Date().toISOString(),
        })
        .eq('id', emailLog.id);

      // Insert tracking event
      await supabase
        .from('email_tracking_events')
        .insert({
          email_log_id: emailLog.id,
          event_type: 'open',
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
          user_agent: req.headers.get('user-agent'),
        });

      console.log('Email open tracked:', trackingId);
    }

    // Always return tracking pixel
    return new Response(TRACKING_PIXEL, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error('Error tracking email open:', error);
    // Return tracking pixel even on error
    return new Response(TRACKING_PIXEL, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        ...corsHeaders,
      },
    });
  }
};

serve(handler);
