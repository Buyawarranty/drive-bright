/**
 * Buying-intent scorer for inbound WhatsApp messages.
 *
 * Kept in sync with src/lib/whatsappHeat.ts so the badge the agent sees always
 * matches the score the webhook wrote.
 */

export type WhatsAppHeat = 'hot' | 'warm' | 'normal';

const HOT_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /\b(price|prices|pricing|how much|cost|costs|quote|quotation)\b/i, reason: 'Asking for a price or quote' },
  { re: /\b(buy|purchase|sign up|take it out|proceed|go ahead|order|pay now)\b/i, reason: 'Asking how to purchase' },
  { re: /\b(payment|instal?ments?|monthly|direct debit|deposit|finance|pay monthly)\b/i, reason: 'Asking about payment' },
  { re: /\b(cover|covered|warranty options?|plans?|platinum|gold|what.s included)\b/i, reason: 'Asking about cover options' },
  { re: /\b(yes please|lets do it|let.s do it|i.?m interested|i want|sounds good|happy with that|when can we start)\b/i, reason: 'Ready to proceed' },
  // UK registration plate, e.g. AB12 CDE / AB12CDE
  { re: /\b[A-Z]{2}\d{2}\s?[A-Z]{3}\b/, reason: 'Sent vehicle details' },
  { re: /\b(\d{2,3},?\d{3}\s?(miles|mileage))\b/i, reason: 'Sent vehicle details' },
];

const WARM_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /\b(how does (it|this) work|more info|information|tell me more|details)\b/i, reason: 'Asking for more information' },
  { re: /\b(thinking about|considering|maybe|later|next week|not sure)\b/i, reason: 'Showing interest' },
  { re: /\b(warranty|policy|claim limit|excess|garage)\b/i, reason: 'Asking about warranties' },
];

export function scoreWhatsAppMessage(
  body: string | null | undefined,
  opts: { repliedToAgent?: boolean } = {},
): { heat: WhatsAppHeat; reason: string | null } {
  const text = (body || '').trim();
  if (!text) return { heat: 'normal', reason: null };

  for (const p of HOT_PATTERNS) {
    if (p.re.test(text)) return { heat: 'hot', reason: p.reason };
  }

  if (opts.repliedToAgent && /\b(yes|yeah|yep|ok|okay|sure|please do|go on)\b/i.test(text)) {
    return { heat: 'hot', reason: 'Positive reply to our sales message' };
  }

  for (const p of WARM_PATTERNS) {
    if (p.re.test(text)) return { heat: 'warm', reason: p.reason };
  }

  return { heat: 'normal', reason: null };
}

const RANK: Record<WhatsAppHeat, number> = { normal: 0, warm: 1, hot: 2 };

/** Heat only ever moves up while a conversation is open. */
export function highestHeat(a: WhatsAppHeat, b: WhatsAppHeat): WhatsAppHeat {
  return RANK[a] >= RANK[b] ? a : b;
}

/** Digits-only UK normalisation, matching the CRM's tail-9 matching rule. */
export function normaliseUkPhone(raw: string): string {
  let d = String(raw || '').replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = `44${d.slice(1)}`;
  else if (d.length === 10 && d.startsWith('7')) d = `44${d}`;
  return d;
}
