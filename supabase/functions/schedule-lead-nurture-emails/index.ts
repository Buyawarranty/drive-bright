import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';
import { getPurchasedEmails } from '../_shared/purchase-guard.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Long-term nurture cadence. Picks up AFTER the 3-step abandoned-cart chase
 * (1h / 2d / 7d) has finished, so a quote that never converted keeps getting a
 * gentle, value-led email instead of going silent forever.
 *
 * Day 14, Day 30, then roughly monthly for six months. Each step is a distinct
 * trigger so the existing per-cart dedupe in send-abandoned-cart-email applies
 * and nobody can ever receive the same step twice.
 */
const NURTURE_STEPS = [
  { trigger: 'nurture_14d', days: 14 },
  { trigger: 'nurture_30d', days: 30 },
  { trigger: 'nurture_60d', days: 60 },
  { trigger: 'nurture_90d', days: 90 },
  { trigger: 'nurture_120d', days: 120 },
  { trigger: 'nurture_150d', days: 150 },
  { trigger: 'nurture_180d', days: 180 },
] as const;

// Frequency protection (per recipient, across ALL marketing triggers)
const MIN_DAYS_BETWEEN_EMAILS = 14;   // never two nurture emails inside a fortnight
const MAX_EMAILS_PER_30_DAYS = 2;     // hard ceiling per recipient per month
const HISTORY_WINDOW_DAYS = 200;      // enough to cover the whole 6-month journey

// Lead outcomes that must never be emailed again
const EXCLUDED_LEAD_STATUSES = [
  'fake_lead',
  'not_interested',
  'do_not_contact',
  'unsubscribed',
  'lost',
  'converted',
  'upgraded',
  'bought_elsewhere',
  'vehicle_sold',
  'not_eligible',
  'archived',
];

const MAX_SENDS_PER_RUN = 60;
const SEND_SPACING_MS = 1200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const isValidEmail = (raw?: string | null): boolean => {
  const e = (raw || '').trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return false;
  if (e.endsWith('.') || e.includes('..')) return false;
  if (/[£$%^*()<>,;:'"\\/]/.test(e)) return false;
  return true;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const now = Date.now();

    // Active templates decide which steps actually run — staff can switch any
    // step off in the database without a code change.
    const { data: templates, error: tplErr } = await supabase
      .from('abandoned_cart_email_templates')
      .select('trigger_type')
      .in('trigger_type', NURTURE_STEPS.map(s => s.trigger))
      .eq('is_active', true);
    if (tplErr) throw tplErr;
    const activeTriggers = new Set((templates || []).map((t: any) => t.trigger_type));
    if (activeTriggers.size === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No active nurture templates' }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Candidates: unconverted quotes between 14 and 190 days old that reached
    // pricing or checkout (so we know what to remind them about).
    const oldest = new Date(now - 190 * DAY_MS).toISOString();
    const newest = new Date(now - 14 * DAY_MS).toISOString();
    const { data: carts, error: cartsErr } = await supabase
      .from('abandoned_carts')
      .select('*')
      .eq('is_converted', false)
      .gte('created_at', oldest)
      .lte('created_at', newest)
      .in('step_abandoned', [3, 4])
      .order('created_at', { ascending: false })
      .limit(3000);
    if (cartsErr) throw cartsErr;
    if (!carts || carts.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No nurture candidates' }), {
        status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // One cart per recipient: the newest quote wins.
    const newestByEmail = new Map<string, any>();
    let invalidEmails = 0;
    for (const cart of carts) {
      if (!isValidEmail(cart.email)) { invalidEmails++; continue; }
      const key = cart.email.trim().toLowerCase();
      const existing = newestByEmail.get(key);
      if (!existing || new Date(cart.created_at) > new Date(existing.created_at)) {
        newestByEmail.set(key, cart);
      }
    }
    const candidates = Array.from(newestByEmail.entries());
    const emails = candidates.map(([e]) => e);

    // ---- Bulk exclusion lists ----
    const { data: unsubRows } = await supabase
      .from('email_unsubscribes').select('email').in('email', emails);
    const unsubSet = new Set((unsubRows || []).map((r: any) => (r.email || '').trim().toLowerCase()));

    const purchasedSet = await getPurchasedEmails(supabase, emails);

    const { data: prefRows } = await supabase
      .from('marketing_audience').select('email, frequency, is_subscribed').in('email', emails);
    const prefByEmail = new Map<string, any>();
    (prefRows || []).forEach((r: any) => prefByEmail.set((r.email || '').trim().toLowerCase(), r));

    // Anyone whose lead was closed down on the phone is out, even though the
    // email address itself may still be valid.
    const { data: leadRows } = await supabase
      .from('sales_leads').select('email, status').in('email', emails);
    const blockedByLead = new Set<string>();
    (leadRows || []).forEach((r: any) => {
      if (EXCLUDED_LEAD_STATUSES.includes(r.status)) {
        blockedByLead.add((r.email || '').trim().toLowerCase());
      }
    });

    // Send history per recipient (all marketing triggers count towards the caps)
    const historyStart = new Date(now - HISTORY_WINDOW_DAYS * DAY_MS).toISOString();
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

    let emailsSent = 0, errorsCount = 0, cappedCount = 0, deferredCount = 0;
    let skippedPurchased = 0, skippedLeadStatus = 0, skippedOptedOut = 0;
    const thirtyDaysAgo = now - 30 * DAY_MS;

    for (const [email, cart] of candidates) {
      try {
        if (unsubSet.has(email)) { skippedOptedOut++; continue; }
        if (purchasedSet.has(email)) { skippedPurchased++; continue; }
        if (blockedByLead.has(email)) { skippedLeadStatus++; continue; }

        const pref = prefByEmail.get(email);
        if (pref && (pref.is_subscribed === false || pref.frequency === 'off' || pref.frequency === 'essentials')) {
          skippedOptedOut++; continue;
        }

        const history = historyByEmail.get(email) || [];
        const sentTriggers = new Set(history.map(h => h.trigger_type));
        const sentTimes = history.map(h => new Date(h.created_at).getTime());

        if (sentTimes.filter(t => t >= thirtyDaysAgo).length >= MAX_EMAILS_PER_30_DAYS) { cappedCount++; continue; }
        const lastSent = sentTimes.length ? Math.max(...sentTimes) : 0;
        if (lastSent && now - lastSent < MIN_DAYS_BETWEEN_EMAILS * DAY_MS) { cappedCount++; continue; }

        // The furthest step that is due and not already sent — one email per run.
        const cartTime = new Date(cart.created_at).getTime();
        let dueTrigger: string | null = null;
        for (const step of NURTURE_STEPS) {
          if (!activeTriggers.has(step.trigger)) continue;
          if (sentTriggers.has(step.trigger)) continue;
          if (now < cartTime + step.days * DAY_MS) continue;
          dueTrigger = step.trigger;
        }
        if (!dueTrigger) continue;

        if (emailsSent + errorsCount >= MAX_SENDS_PER_RUN) { deferredCount++; continue; }

        const metadata = cart.cart_metadata || {};
        const payload = {
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

        console.log(`Nurture: sending ${dueTrigger} to ${email} (cart ${cart.id})`);

        let res: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          res = await supabase.functions.invoke('send-abandoned-cart-email', { body: payload });
          if (!res.error) break;
          const retryAfter = Number(res.error?.context?.retryAfterMs) || 0;
          if (!retryAfter) break;
          await sleep(Math.min(retryAfter + 500, 40_000));
        }

        if (res?.error) {
          console.error(`Nurture send failed for ${email}:`, res.error);
          errorsCount++;
        } else {
          emailsSent++;
          await sleep(SEND_SPACING_MS);
        }
      } catch (err) {
        console.error('Nurture error for', email, err);
        errorsCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      recipientsConsidered: candidates.length,
      emailsSent,
      cappedByFrequency: cappedCount,
      deferredToNextRun: deferredCount,
      skippedAlreadyPurchased: skippedPurchased,
      skippedLeadStatus,
      skippedOptedOut,
      invalidEmailsSkipped: invalidEmails,
      errors: errorsCount,
    }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });

  } catch (error: any) {
    console.error('Error in schedule-lead-nurture-emails:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
