import { supabase } from '@/integrations/supabase/client';

/**
 * Finds the highest price this vehicle was actually quoted, so a sale can never
 * be recorded as "no discount given" when the customer paid less than they were
 * quoted.
 *
 * Why this exists: the confirmation screen used to compare the collected amount
 * with a grid price recalculated on the day, and matched the number plate
 * exactly. A plate typed as "R20PTT" instead of "R20 PTT" (or a config tweak
 * between quote and payment) hid the original quote and the discount was saved
 * as zero.
 */

const LOOKBACK_DAYS = 30;

export const normalisePlate = (v: string | null | undefined) =>
  (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Every spacing variant a plate might have been saved under. */
function plateVariants(reg: string): string[] {
  const target = normalisePlate(reg);
  const spaced = target.length > 3 ? `${target.slice(0, target.length - 3)} ${target.slice(-3)}` : target;
  return Array.from(new Set([(reg || '').trim(), target, spaced].filter(Boolean)));
}

/**
 * Highest quoted total on record for this plate (price logs + quotes emailed to
 * the customer), never lower than the fallback passed in.
 */
/** Cover length in months from any payment_type spelling we store, or null. */
export function coverMonthsOf(paymentType: string | null | undefined): number | null {
  const t = String(paymentType || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!t) return null;
  if (t.startsWith('36') || t.startsWith('3year') || t === 'threeyear') return 36;
  if (t.startsWith('24') || t.startsWith('2year') || t === 'twoyear') return 24;
  if (t.startsWith('12') || t.startsWith('1year') || t === 'yearly' || t === 'monthly' || t === 'oneyear') return 12;
  return null;
}

export async function resolveHighestQuotedTotal(
  reg: string,
  fallbackQuoted: number,
  /** Cover being sold. Quotes for a different cover length are ignored, so a
   *  2-year quote can never be used as the "quoted price" of a 1-year sale. */
  paymentType?: string | null
): Promise<number> {
  const soldMonths = coverMonthsOf(paymentType);
  let highest = Math.max(0, Math.round((Number(fallbackQuoted) || 0) * 100) / 100);
  const target = normalisePlate(reg);
  if (!target) return highest;

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const variants = plateVariants(reg);
  const orFilter = (column: string) => variants.map(v => `${column}.ilike.${v}`).join(',');

  const consider = (rows: any[] | null, field: string) => {
    for (const row of rows || []) {
      if (normalisePlate(row.vehicle_reg) !== target) continue;
      const rowMonths = coverMonthsOf(row.payment_type);
      if (soldMonths && rowMonths && rowMonths !== soldMonths) continue;
      const value = Math.round((Number(row[field]) || 0) * 100) / 100;
      if (value > highest) highest = value;
    }
  };

  try {
    const [audit, sent] = await Promise.all([
      supabase
        .from('price_override_audit')
        .select('vehicle_reg, matrix_total, payment_type')
        .or(orFilter('vehicle_reg'))
        .gte('created_at', since)
        .limit(100),
      supabase
        .from('admin_sent_quotes')
        .select('vehicle_reg, total_price, payment_type')
        .or(orFilter('vehicle_reg'))
        .gte('created_at', since)
        .limit(100),
    ]);
    consider(audit.data as any[], 'matrix_total');
    consider(sent.data as any[], 'total_price');
  } catch {
    /* fall back to the price shown on screen */
  }

  return highest;
}

/** The discount actually given, rounded to the penny and never negative. */
export function discountGiven(quotedTotal: number, collected: number): number {
  return Math.max(0, Math.round(((Number(quotedTotal) || 0) - (Number(collected) || 0)) * 100) / 100);
}
