import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Trimmed 3-step cadence (was 6). Anything beyond a week without a reply is spam.
const REMINDER_TRIGGERS = [
  'reminder_1h',
  'reminder_2d',
  'reminder_7d',
] as const;

// ---- Per-PERSON frequency caps (the old logic capped per cart, so a customer
// who re-quoted 11 times got 11 full cadences). ----
const MIN_HOURS_BETWEEN_EMAILS = 48;   // never two marketing emails inside 48h
const MAX_EMAILS_PER_30_DAYS = 3;      // hard ceiling per recipient per month
const DEDUPE_WINDOW_DAYS = 60;         // same trigger never repeats within 60 days

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

/** Reject malformed addresses instead of retrying them forever. */
const isValidEmail = (raw?: string | null): boolean => {
  const e = (raw || '').trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return false;
  if (e.endsWith('.')) return false;
  if (e.includes('..')) return false;
  if (/[£$%^*()<>,;:'"\\/]/.test(e)) return false;
  return true;
};

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

    console.log('Processing abandoned cart reminders (3-step, per-recipient capped)...');

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

    // Pull unconverted carts within the cadence window (8 days covers the 7-day final email)
    const windowStart = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
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

    // ---- Collapse to ONE cart per recipient: the newest quote wins. ----
    const newestCartByEmail = new Map<string, any>();
    let invalidEmails = 0;
    for (const cart of abandonedCarts) {
      if (!isValidEmail(cart.email)) { invalidEmails++; continue; }
      const key = cart.email.trim().toLowerCase();
      const existing = newestCartByEmail.get(key);
      if (!existing || new Date(cart.created_at) > new Date(existing.created_at)) {
        newestCartByEmail.set(key, cart);
      }
    }
    const candidates = Array.from(newestCartByEmail.entries());
    console.log(`${abandonedCarts.length} carts → ${candidates.length} unique recipients (${invalidEmails} invalid addresses skipped)`);

    const emails = candidates.map(([e]) => e);

    // Bulk-load unsubscribes / non-marketing preferences
    const { data: unsubRows } = await supabase
      .from('email_unsubscribes')
      .select('email')
      .in('email', emails);
    const unsubSet = new Set((unsubRows || []).map((r: any) => (r.email || '').trim().toLowerCase()));

    const { data: prefRows } = await supabase
      .from('marketing_audience')
      .select('email, frequency, is_subscribed')
      .in('email', emails);
    const prefByEmail = new Map<string, { frequency?: string | null; is_subscribed?: boolean | null }>();
    (prefRows || []).forEach((r: any) => prefByEmail.set((r.email || '').trim().toLowerCase(), r));

    // Bulk-load recent send history PER RECIPIENT (not per cart)
    const historyStart = new Date(Date.now() - DEDUPE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: historyRows } = await supabase
      .from('triggered_emails_log')
      .select('email, trigger_type, created_at')
      .in('email', emails)
      .gte('created_at', historyStart);

    const historyByEmail = new Map<string, { trigger_type: string; created_at: string }[]>();
    (historyRows || []).forEach((r: any) => {
      const key = (r.email || '').trim().toLowerCase();
      const list = historyByEmail.get(key) || [];
      list.push({ trigger_type: r.trigger_type, created_at: r.created_at });
      historyByEmail.set(key, list);
    });

    let emailsSent = 0;
    let errorsCount = 0;
    let cappedCount = 0;
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    for (const [email, cart] of candidates) {
      try {
        if (unsubSet.has(email)) continue;

        // Respect customer-chosen frequency: 'off' and 'essentials' get no cart chasing.
        const pref = prefByEmail.get(email);
        if (pref && (pref.is_subscribed === false || pref.frequency === 'off' || pref.frequency === 'essentials')) {
          continue;
        }

        // Only carts that actually reached pricing or checkout
        if (cart.step_abandoned !== 3 && cart.step_abandoned !== 4) continue;

        const history = historyByEmail.get(email) || [];
        const sentTriggers = new Set(history.map(h => h.trigger_type));
        const sentTimes = history.map(h => new Date(h.created_at).getTime());

        // Cap 1: max N marketing emails per recipient per 30 days
        if (sentTimes.filter(t => t >= thirtyDaysAgo).length >= MAX_EMAILS_PER_30_DAYS) {
          cappedCount++;
          continue;
        }

        // Cap 2: minimum quiet period since the last marketing email
        const lastSent = sentTimes.length ? Math.max(...sentTimes) : 0;
        if (lastSent && now - lastSent < MIN_HOURS_BETWEEN_EMAILS * 60 * 60 * 1000) {
          cappedCount++;
          continue;
        }

        const cartTime = new Date(cart.created_at).getTime();
        const metadata = cart.cart_metadata || {};

        // Send at most ONE email per recipient per run: the latest due step they
        // haven't already had. Never a burst.
        let dueTrigger: string | null = null;
        for (const trigger of REMINDER_TRIGGERS) {
          if (sentTriggers.has(trigger)) continue;           // per-person dedupe
          const delayMinutes = delayByTrigger.get(trigger);
          if (delayMinutes === undefined) continue;
          if (now < cartTime + delayMinutes * 60 * 1000) continue; // not yet due
          dueTrigger = trigger;                               // keep last (furthest) due step
        }
        if (!dueTrigger) continue;

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
          triggerType: dueTrigger,
          planName: cart.plan_name,
          paymentType: cart.payment_type,
          stepAbandoned: cart.step_abandoned,
          voluntaryExcess: metadata.voluntary_excess ?? metadata.excess,
          claimLimit: metadata.claim_limit ?? metadata.claimLimit,
          labourRate: metadata.labourRate ?? metadata.labour_rate,
          boostAddon: metadata.boostAddon ?? metadata.boost_addon,
          protectionAddons: metadata.protection_addons,
        };

        console.log(`Sending ${dueTrigger} to ${email} (cart ${cart.id}, step ${cart.step_abandoned})`);
        const emailResponse = await supabase.functions.invoke('send-abandoned-cart-email', {
          body: emailPayload,
        });

        if (emailResponse.error) {
          console.error(`Error sending ${dueTrigger} to ${email}:`, emailResponse.error);
          errorsCount++;
        } else {
          emailsSent++;
        }
      } catch (cartErr) {
        console.error('Error processing recipient:', email, cartErr);
        errorsCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${candidates.length} recipients from ${abandonedCarts.length} carts`,
      emailsSent,
      cappedByFrequency: cappedCount,
      invalidEmailsSkipped: invalidEmails,
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
