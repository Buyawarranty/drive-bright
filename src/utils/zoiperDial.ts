import { logPhoneEvent } from '@/utils/phoneEventLogger';
import { markAgentOnCall } from '@/lib/agentCallState';

/**
 * Trigger a Zoiper softphone dial.
 *
 * IMPORTANT — Windows protocol handler hijack:
 *   On Windows, Microsoft Teams registers itself as the default handler for
 *   `callto:` AND `tel:` the moment it is installed. Firing those schemes
 *   launches Teams, not Zoiper — even when Zoiper is running.
 *
 *   Zoiper Pro always registers `sip:` on install. Teams does NOT touch `sip:`.
 *   So `sip:` is the ONLY scheme that is safe by default on a stock Windows
 *   machine with Teams installed.
 *
 * Strategy:
 *   - Fire ONE scheme, not a cascade. Firing multiple schemes gives Teams a
 *     chance to grab the click even when Zoiper also answers.
 *   - Default to `sip:`.
 *   - Allow per-machine override via `localStorage.setItem('zoiper.dialProtocol', 'zoiper' | 'sip' | 'callto' | 'tel')`
 *     for agents who have configured Zoiper to own a different scheme.
 *   - Always copy the number to clipboard as a safety net.
 *
 * Also logs a `phone_clicked` event for call analytics.
 *
 * Duplicate-call defence (see DIAL_DEDUP_MS below):
 *   Any dial for the same normalized number within the dedup window is
 *   silently dropped. Prevents React re-render / StrictMode double-invoke,
 *   double-clicks, and two visible dial affordances for the same lead from
 *   ringing the customer twice.
 */

export type DialProtocol = 'sip' | 'zoiper' | 'callto' | 'tel';
const VALID_PROTOCOLS: DialProtocol[] = ['sip', 'zoiper', 'callto', 'tel'];
const STORAGE_KEY = 'zoiper.dialProtocol';

export function getPreferredDialProtocol(): DialProtocol {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as DialProtocol | null;
    if (stored && VALID_PROTOCOLS.includes(stored)) return stored;
  } catch { /* noop */ }
  return 'sip';
}

export function setPreferredDialProtocol(p: DialProtocol) {
  try { localStorage.setItem(STORAGE_KEY, p); } catch { /* noop */ }
}

export function normalizeDialNumber(raw: string): string {
  // Keep leading +, strip everything else non-digit.
  const trimmed = (raw || '').trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  return plus + trimmed.replace(/[^\d]/g, '');
}

/**
 * Launch an external-protocol URI (sip:/callto:/tel:).
 *
 * MUST happen in the top-level document during the user gesture. Chrome blocks
 * external protocol launches initiated from an iframe ("Not allowed to launch
 * <scheme> ... from a frame"), which is why the click did nothing while copying
 * the number and pasting into Zoiper worked fine.
 */
function fireUri(uri: string) {
  // Direct top-level navigation is the most reliable way to hand a custom
  // scheme to the OS handler. The synthetic-anchor trick silently no-ops in
  // some Chrome/Edge builds when the click isn't the *original* trusted event
  // (e.g. dispatched from a React handler that already awaited something),
  // which is exactly the "click does nothing but paste works" symptom.
  try {
    window.location.href = uri;
    return;
  } catch { /* noop */ }
  try {
    const a = document.createElement('a');
    a.href = uri;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { a.remove(); } catch { /* noop */ } }, 500);
  } catch { /* noop */ }
}

/**
 * Fallback cascade: if the preferred scheme produced no handler launch, the
 * page keeps focus and stays visible. In that case (and only that case) try
 * the next scheme, so a machine where Zoiper owns `zoiper:`/`callto:` instead
 * of `sip:` still dials. One attempt per scheme, staggered, and aborted the
 * moment the browser loses focus (= a handler took over).
 */
function fireWithFallback(number: string, preferred: DialProtocol) {
  const order: DialProtocol[] = [preferred, ...VALID_PROTOCOLS.filter((p) => p !== preferred)];
  fireUri(`${order[0]}:${number}`);

  let aborted = false;
  const abort = () => { aborted = true; };
  window.addEventListener('blur', abort, { once: true });
  document.addEventListener('visibilitychange', abort, { once: true });

  order.slice(1).forEach((scheme, i) => {
    setTimeout(() => {
      if (aborted || document.hidden || !document.hasFocus()) return;
      // eslint-disable-next-line no-console
      console.warn('[zoiperDial] no handler took the call, retrying scheme', scheme);
      fireUri(`${scheme}:${number}`);
    }, 1400 * (i + 1));
  });

  setTimeout(() => {
    window.removeEventListener('blur', abort);
    document.removeEventListener('visibilitychange', abort);
  }, 1400 * order.length + 500);
}


/**
 * Suppression window used by the global `tel:` click tracker in
 * phoneEventLogger so a single click isn't logged twice (once here, once
 * there). Exported so the tracker can consult it.
 */
export function wasRecentlyDialled(number: string): boolean {
  return !!lastDial && lastDial.number === number && (Date.now() - lastDial.at) < DIAL_DEDUP_MS;
}


export interface DialWithZoiperOptions {
  leadId?: string | null;
  leadType?: 'sales_lead' | 'abandoned_cart' | null;
  customerId?: string | null;
  customerName?: string | null;
  leadSource?: string | null;
  sourcePage?: string | null;
}

/**
 * Module-level dedup guard shared across every caller (ZoiperDialButton,
 * PhoneCopyText in the lead row, NewLeadAlerts). Any dial for the same
 * normalized number within DIAL_DEDUP_MS of the last one is silently
 * dropped so the customer's phone only rings once.
 */
const DIAL_DEDUP_MS = 2500;
let lastDial: { number: string; at: number } | null = null;

export function dialWithZoiper(rawNumber: string, opts: DialWithZoiperOptions = {}) {
  const number = normalizeDialNumber(rawNumber);
  if (!number) return;

  const now = Date.now();
  if (lastDial && lastDial.number === number && (now - lastDial.at) < DIAL_DEDUP_MS) {
    // Duplicate suppressed — do NOT fire another URI or log another event.
    // eslint-disable-next-line no-console
    console.warn('[zoiperDial] duplicate dial suppressed', {
      number,
      sinceLastMs: now - lastDial.at,
    });
    return;
  }
  lastDial = { number, at: now };

  const protocol = getPreferredDialProtocol();

  // Fire ONLY the preferred scheme. Firing several (as we used to) lets Windows
  // hand the click to Microsoft Teams via its callto:/tel: registration even
  // when Zoiper also answers.
  fireWithFallback(number, protocol);

  // Mark the agent as "on a call" so new-lead pop-ups queue silently
  // (no beep, no auto-expand) until the call ends. Auto-clears after 15 min.
  markAgentOnCall();

  // eslint-disable-next-line no-console
  console.log('[zoiperDial] dial fired', { number, scheme: protocol });

  // Fire-and-forget audit log.
  logPhoneEvent({
    eventType: 'phone_clicked',
    phoneNumber: number,
    leadId: opts.leadId ?? null,
    leadType: opts.leadType ?? null,
    customerId: opts.customerId ?? null,
    customerName: opts.customerName ?? null,
    leadSource: opts.leadSource ?? null,
    sourcePage: opts.sourcePage ?? null,
    metadata: { dialer: 'zoiper', scheme: protocol },
  });
}
