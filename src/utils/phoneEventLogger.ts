import { supabase } from '@/integrations/supabase/client';
import { wasRecentlyDialled, normalizeDialNumber } from '@/utils/zoiperDial';

/**
 * Phone event logger — writes to public.phone_events (Phase 1 of the
 * Open Lead Pool verification system). All calls are fire-and-forget:
 * we never block the UI on a logging failure.
 */
export type PhoneEventType =
  | 'phone_clicked'
  | 'spoken_to_selected'
  | 'no_answer_selected'
  | 'voicemail_selected'
  | 'busy_selected'
  | 'callback_requested'
  | 'wrong_number_selected'
  | 'not_interested_selected'
  | 'retry_started'
  | 'retry_completed'
  | 'retry_missed'
  | 'reservation_expired'
  | 'manager_confirmed_match'
  | 'manager_confirmed_mismatch'
  | 'manager_unable_to_verify'
  | 'restriction_applied'
  | 'restriction_ended';

export interface LogPhoneEventInput {
  eventType: PhoneEventType;
  leadId?: string | null;
  leadType?: 'sales_lead' | 'abandoned_cart' | null;
  customerId?: string | null;
  customerName?: string | null;
  phoneNumber?: string | null;
  leadSource?: string | null;
  selectedOutcome?: string | null;
  reservationId?: string | null;
  sourcePage?: string | null;
  metadata?: Record<string, unknown>;
}

let cachedAgent: { adminId: string | null; name: string | null } | null = null;
async function getCurrentAgent() {
  if (cachedAgent) return cachedAgent;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      cachedAgent = { adminId: null, name: null };
      return cachedAgent;
    }
    const { data } = await supabase
      .from('admin_users')
      .select('id, first_name, last_name, email')
      .eq('user_id', user.id)
      .maybeSingle();
    const name = data
      ? [data.first_name, data.last_name].filter(Boolean).join(' ').trim() || data.email
      : user.email || null;
    cachedAgent = { adminId: data?.id || null, name };
  } catch {
    cachedAgent = { adminId: null, name: null };
  }
  return cachedAgent;
}

function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem('__phone_session_id');
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem('__phone_session_id', sid);
    }
    return sid;
  } catch {
    return '';
  }
}

export async function logPhoneEvent(input: LogPhoneEventInput): Promise<void> {
  try {
    const agent = await getCurrentAgent();
    await supabase.from('phone_events').insert({
      agent_id: agent.adminId,
      agent_name: agent.name,
      lead_id: input.leadId ?? null,
      lead_type: input.leadType ?? null,
      customer_id: input.customerId ?? null,
      customer_name: input.customerName ?? null,
      phone_number: input.phoneNumber ?? null,
      lead_source: input.leadSource ?? null,
      event_type: input.eventType,
      selected_outcome: input.selectedOutcome ?? null,
      reservation_id: input.reservationId ?? null,
      source_page: input.sourcePage ?? (typeof window !== 'undefined' ? window.location.pathname : null),
      session_id: getSessionId(),
      metadata: (input.metadata ?? {}) as any,
    });
  } catch (err) {
    console.warn('[phoneEventLogger] failed', err);
  }
}

/**
 * Global click listener — logs `phone_clicked` for any `<a href="tel:...">`
 * or element with `data-phone-click="<number>"`. Safe to call multiple times.
 *
 * Anything that goes through dialWithZoiper already logs its own event, so we
 * skip those here — otherwise a single click produced 2–4 identical rows
 * (Zoiper "Z" button, the tel: chip, the alert banner and this tracker).
 */
let attached = false;
export function initPhoneClickTracker() {
  if (attached || typeof document === 'undefined') return;
  attached = true;
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a[href^="tel:"]') as HTMLAnchorElement | null;
      const explicit = target.closest('[data-phone-click]') as HTMLElement | null;
      if (!anchor && !explicit) return;
      const phone = anchor
        ? anchor.getAttribute('href')?.replace(/^tel:/, '') || null
        : explicit?.dataset.phoneClick || null;
      if (!phone) return;
      // Deduplicate against dialWithZoiper's own log for the same number.
      if (wasRecentlyDialled(normalizeDialNumber(phone))) return;
      const leadId = (explicit || anchor)?.closest('[data-lead-id]')?.getAttribute('data-lead-id') || null;
      const customerId =
        (explicit || anchor)?.closest('[data-customer-id]')?.getAttribute('data-customer-id') || null;
      logPhoneEvent({
        eventType: 'phone_clicked',
        phoneNumber: phone,
        leadId,
        customerId,
      });
    },
    { capture: true }
  );
}

