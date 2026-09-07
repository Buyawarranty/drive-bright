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
export async function resolveHighestQuotedTotal(
  reg: string,
  fallbackQuoted: number
): Promise<number> {
  let highest = Math.max(0, Math.round((Number(fallbackQuoted) || 0) * 100) / 100);
  const target = normalisePlate(reg);
  if (!target) return highest;

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const variants = plateVariants(reg);
  const orFilter = (column: string) => variants.map(v => `${column}.ilike.${v}`).join(',');

  const consider = (rows: any[] | null, field: string) => {
    for (const row of rows || []) {
      if (normalisePlate(row.vehicle_reg) !== target) continue;
      const value = Math.round((Number(row[field]) || 0) * 100) / 100;
      if (value > highest) highest = value;
    }
  };

  try {
    const [audit, sent] = await Promise.all([
      supabase
        .from('price_override_audit')
        .select('vehicle_reg, matrix_total')
        .or(orFilter('vehicle_reg'))
        .gte('created_at', since)
        .limit(100),
      supabase
        .from('admin_sent_quotes')
        .select('vehicle_reg, total_price')
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
