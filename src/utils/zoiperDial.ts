import { logPhoneEvent } from '@/utils/phoneEventLogger';

/**
 * Trigger a Zoiper softphone dial.
 *
 * Zoiper Desktop registers the `callto:` and `zoiper:` URI schemes on the OS.
 * We prefer `callto:` (works with Zoiper 3/5 Windows + macOS) and fall back to
 * `zoiper:` via a hidden iframe so the current tab never navigates away.
 *
 * Also logs a `phone_clicked` event for the Phone Logs dashboard.
 */
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

  // Primary: callto: (Zoiper registers this). Secondary: zoiper: (Zoiper-specific).
  fireUri(`callto:${number}`);
  setTimeout(() => fireUri(`zoiper:${number}`), 150);

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
    metadata: { dialer: 'zoiper', scheme: 'callto+zoiper' },
  });
}
