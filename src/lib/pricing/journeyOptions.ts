/**
 * CANONICAL CUSTOMER JOURNEY OPTIONS (Step 3 → Step 4).
 *
 * Every pricing sandbox on Admin → Price updates must offer exactly these
 * options, in this wording, so a test model can never be pushed live with a
 * variable (term, labour rate, excess, claim limit, add-on) that the customer
 * journey has but the test never priced.
 *
 * Single source of truth: the arrays below are what Step 3 renders. Do not
 * fork these lists inside a panel — import them.
 */
import { CLAIM_LIMIT_TIERS } from '@/lib/claimLimitTiers';
import { getAutoIncludedAddOns, getAddOnInfo } from '@/lib/addOnsUtils';

export type JourneyPeriod = '12months' | '24months' | '36months';

/** Cover terms exactly as Step 3 shows them (labels, badges and perks). */
export const JOURNEY_DURATIONS: {
  id: JourneyPeriod;
  key: string;
  months: number;
  label: string;
  badge: string;
  perks: string[];
}[] = [
  { id: '12months', key: '12', months: 12, label: '1-year cover', badge: '', perks: ['Lowest monthly cost', 'Flexible shorter-term cover'] },
  { id: '24months', key: '24', months: 24, label: '2-year cover', badge: 'MOST POPULAR', perks: ['Year 2 FREE — only 12 instalments', 'No renewal needed next year'] },
  { id: '36months', key: '36', months: 36, label: '3-year cover', badge: 'BEST VALUE', perks: ['Years 2 & 3 FREE — only 12 instalments', 'Locked-in protection for 3 years'] },
];

/** Voluntary excess options as shown on Step 3 (visibility rules live in pricingMatrix). */
export const JOURNEY_EXCESS_OPTIONS: { value: number; label: string; description: string }[] = [
  { value: 0, label: '£0', description: 'No Excess' },
  { value: 50, label: '£50', description: 'Low Excess' },
  { value: 100, label: '£100', description: 'Balanced' },
  { value: 150, label: '£150', description: 'Best Value' },
  { value: 250, label: '£250', description: 'Lower Monthly Cost' },
  { value: 500, label: '£500', description: 'Maximum Saving' },
];

/** Claim limit tiers, keyed by the value the customer sees (£1,000 … £5,000). */
export const JOURNEY_CLAIM_TIERS = CLAIM_LIMIT_TIERS.map(t => ({
  value: t.displayValue,
  internalValue: t.value,
  name: t.name,
  shortName: t.shortName,
  badge: t.popular ? 'MOST POPULAR' : '',
}));

/** Labour rates and the per-month uplift the live journey applies. */
export const JOURNEY_LABOUR_OPTIONS: {
  rate: number;
  title: string;
  badge: string;
  monthlyAdjust: number;
}[] = [
  { rate: 50, title: 'Local Garages', badge: 'BEST VALUE', monthlyAdjust: -5 },
  { rate: 70, title: 'Independent Garages', badge: 'POPULAR', monthlyAdjust: 0 },
  { rate: 100, title: 'Approved Garages', badge: '', monthlyAdjust: 8 },
  { rate: 150, title: 'Specialist garages', badge: '', monthlyAdjust: 24 },
];

/** Add-ons the customer can see on Step 3/4, split into free and chargeable. */
export function getJourneyAddOns(period: JourneyPeriod, months: number) {
  const auto = getAutoIncludedAddOns(period);
  return getAddOnInfo(period, months).map(a => ({
    ...a,
    isAutoIncluded: auto.includes(a.key),
  }));
}

/** Bonus (free) cover months offered by agents: none, +1 per year, +3 or +6. */
export const JOURNEY_BONUS_MONTHS = [0, 1, 3, 6];

export const periodForMonths = (months: number): JourneyPeriod =>
  months === 24 ? '24months' : months === 36 ? '36months' : '12months';
