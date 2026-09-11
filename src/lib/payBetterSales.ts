/**
 * PayBetter sales — target credit rules.
 *
 * PayBetter deals cancel far more easily than normal card sales, so an agent is
 * only credited with the ONE YEAR EQUIVALENT of the sale towards their monthly
 * scoreboard target. If they sell a 2 or 3 year warranty on PayBetter, the
 * target credit is the total divided by the number of cover years.
 *
 * Reported revenue elsewhere (analytics, customer records) is untouched — this
 * only affects what counts towards the sales target.
 */

import { getWarrantyDurationInMonths } from '@/lib/warrantyDurationUtils';

export const PAYBETTER_SOURCE = 'paybetter';
export const PAYBETTER_LABEL = 'PayBetter';

export const isPayBetterSale = (source?: string | null): boolean => {
  const s = String(source || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
  return s.includes('paybetter') || s.includes('pay better');
};

export const coverYearsFromPaymentType = (paymentType?: string | null): number =>
  Math.max(1, Math.round(getWarrantyDurationInMonths(String(paymentType || '12months')) / 12));

/**
 * Amount that counts towards the agent's monthly target for one sale.
 */
export const targetCreditAmount = (sale: {
  final_amount?: number | null;
  purchase_source?: string | null;
  payment_type?: string | null;
}): number => {
  const amount = Number(sale.final_amount) || 0;
  if (!isPayBetterSale(sale.purchase_source)) return amount;
  return amount / coverYearsFromPaymentType(sale.payment_type);
};

export const PAYBETTER_TARGET_NOTE =
  'PayBetter sales count towards target at the one-year equivalent — a 2 or 3 year PayBetter warranty is credited as the yearly figure (total ÷ cover years).';
