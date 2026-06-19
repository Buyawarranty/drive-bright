import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 6-step Confused.com-style cadence. Each cart can receive every reminder
// whose delay has elapsed (so missed cycles still send on the next cron tick).
const REMINDER_TRIGGERS = [
  'reminder_1h',
  'reminder_2d',
  'reminder_7d',
  'reminder_14d',
  'reminder_18d',
  'reminder_21d',
] as const;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    console.log('Processing abandoned cart reminder cadence (6-step)...');

    // Load active reminder templates (delay map)
    const { data: templates, error: tplErr } = await supabase
      .from('abandoned_cart_email_templates')
      .select('trigger_type, send_delay_minutes')
      .in('trigger_type', REMINDER_TRIGGERS as unknown as string[])
      .eq('is_active', true);

    if (tplErr) throw tplErr;
    const delayByTrigger = new Map<string, number>();
    (templates || []).forEach(t => delayByTrigger.set(t.trigger_type, t.send_delay_minutes));

    if (delayByTrigger.size === 0) {
      console.log('No active reminder templates configured');
      return new Response(JSON.stringify({ success: true, message: "No active templates" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Pull unconverted carts within the cadence window (22 days covers 21-day final email)
    const windowStart = new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString();
    const { data: abandonedCarts, error: cartsError } = await supabase
      .from('abandoned_carts')
      .select('*')
      .eq('is_converted', false)
      .gte('created_at', windowStart)
      .order('created_at', { ascending: false });

    if (cartsError) throw cartsError;
    if (!abandonedCarts || abandonedCarts.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No abandoned carts to process" }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Found ${abandonedCarts.length} candidate carts`);

    // Bulk-load unsubscribed emails for this batch
    const emails = Array.from(new Set(
      abandonedCarts.map(c => (c.email || '').trim().toLowerCase()).filter(e => e.includes('@'))
    ));
    const { data: unsubRows } = await supabase
      .from('email_unsubscribes')
      .select('email')
      .in('email', emails);
    const unsubSet = new Set((unsubRows || []).map((r: any) => r.email));

    let emailsSent = 0;
    let errorsCount = 0;
    const now = Date.now();

    for (const cart of abandonedCarts) {
      try {
        if (!cart.email || !cart.email.includes('@')) continue;
        if (unsubSet.has(cart.email.trim().toLowerCase())) continue;
        // Only carts that actually reached pricing or checkout
        if (cart.step_abandoned !== 3 && cart.step_abandoned !== 4) continue;

        // Fetch all reminder emails already sent for this cart
        const { data: alreadySent } = await supabase
          .from('triggered_emails_log')
          .select('trigger_type')
          .eq('cart_id', cart.id)
          .in('trigger_type', REMINDER_TRIGGERS as unknown as string[]);
        const sentSet = new Set((alreadySent || []).map((r: any) => r.trigger_type));

        const cartTime = new Date(cart.created_at).getTime();
        const metadata = cart.cart_metadata || {};

        for (const trigger of REMINDER_TRIGGERS) {
          if (sentSet.has(trigger)) continue;
          const delayMinutes = delayByTrigger.get(trigger);
          if (delayMinutes === undefined) continue;
          if (now < cartTime + delayMinutes * 60 * 1000) continue; // not yet due

          const emailPayload = {
            cartId: cart.id,
            email: cart.email,
            firstName: cart.full_name?.split(' ')[0] || 'there',
            lastName: cart.full_name?.split(' ').slice(1).join(' ') || '',
            phone: cart.phone || '',
            vehicleReg: cart.vehicle_reg,
            vehicleMake: cart.vehicle_make,
            vehicleModel: cart.vehicle_model,
            vehicleYear: cart.vehicle_year || '',
            vehicleType: cart.vehicle_type,
            mileage: cart.mileage || '0',
            fuelType: '',
            transmission: '',
            triggerType: trigger,
            planName: cart.plan_name,
            paymentType: cart.payment_type,
            stepAbandoned: cart.step_abandoned, // ← step 3 → step 3, step 4 → checkout
            voluntaryExcess: metadata.voluntary_excess ?? metadata.excess,
            claimLimit: metadata.claim_limit ?? metadata.claimLimit,
            labourRate: metadata.labourRate ?? metadata.labour_rate,
            boostAddon: metadata.boostAddon ?? metadata.boost_addon,
            protectionAddons: metadata.protection_addons,
          };

          console.log(`Sending ${trigger} for cart ${cart.id} (step ${cart.step_abandoned})`);
          const emailResponse = await supabase.functions.invoke('send-abandoned-cart-email', {
            body: emailPayload,
          });

          if (emailResponse.error) {
            console.error(`Error sending ${trigger} for cart ${cart.id}:`, emailResponse.error);
            errorsCount++;
          } else {
            emailsSent++;
          }
        }
      } catch (cartErr) {
        console.error('Error processing cart:', cart.id, cartErr);
        errorsCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${abandonedCarts.length} carts`,
      emailsSent,
      errors: errorsCount,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in schedule-abandoned-cart-emails:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
