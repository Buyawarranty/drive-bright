import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const destinationUrl = url.searchParams.get('url');

    if (!trackingId || !destinationUrl) {
      return new Response('Missing parameters', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    // Find the email log by tracking ID
    const { data: emailLog, error: findError } = await supabase
      .from('email_logs')
      .select('*')
      .eq('tracking_id', trackingId)
      .single();

    if (!findError && emailLog) {
      // Update email log
      await supabase
        .from('email_logs')
        .update({
          click_tracked: true,
          clicked_at: emailLog.clicked_at || new Date().toISOString(),
        })
        .eq('id', emailLog.id);

      // Insert tracking event
      await supabase
        .from('email_tracking_events')
        .insert({
          email_log_id: emailLog.id,
          event_type: 'click',
          event_data: { url: destinationUrl },
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
          user_agent: req.headers.get('user-agent'),
        });

      console.log('Email click tracked:', trackingId, destinationUrl);
    }

    // Redirect to destination URL
    return new Response(null, {
      status: 302,
      headers: {
        'Location': destinationUrl,
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error('Error tracking email click:', error);
    // Redirect to destination URL anyway
    const url = new URL(req.url);
    const destinationUrl = url.searchParams.get('url');
    if (destinationUrl) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': destinationUrl,
          ...corsHeaders,
        },
      });
    }
    return new Response('Error', { status: 500, headers: corsHeaders });
  }
};

serve(handler);
