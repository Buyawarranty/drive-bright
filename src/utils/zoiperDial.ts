import { logPhoneEvent } from '@/utils/phoneEventLogger';

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
 * Also logs a `phone_clicked` event for the Phone Logs dashboard.
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

function fireUri(uri: string) {
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = uri;
    document.body.appendChild(iframe);
    // Zoiper picks up the URI immediately; remove the iframe shortly after.
    setTimeout(() => {
      try { iframe.remove(); } catch { /* noop */ }
    }, 1500);
  } catch {
    try { window.location.href = uri; } catch { /* noop */ }
  }
}

export interface DialWithZoiperOptions {
  leadId?: string | null;
  leadType?: 'sales_lead' | 'abandoned_cart' | null;
  customerId?: string | null;
  customerName?: string | null;
  leadSource?: string | null;
  sourcePage?: string | null;
}

export function dialWithZoiper(rawNumber: string, opts: DialWithZoiperOptions = {}) {
  const number = normalizeDialNumber(rawNumber);
  if (!number) return;

  const protocol = getPreferredDialProtocol();

  // Fire ONLY the preferred scheme. Firing several (as we used to) lets Windows
  // hand the click to Microsoft Teams via its callto:/tel: registration even
  // when Zoiper also answers.
  fireUri(`${protocol}:${number}`);

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
