import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Gauge } from 'lucide-react';
import {
  getSoldVsReference,
  referenceGapClass,
  DISCOUNT_CEILING_PCT,
  type SoldOrderLike,
} from '@/lib/pricing/soldVsReference';
import {
  getPricingVersionHistoryCached,
  withPricingAsOf,
  type PricingVersionSnapshot,
} from '@/lib/pricing/historicalPricing';
import { getRecordedOrderDiscount, discountBandClass } from '@/lib/pricing/orderDiscount';
import { useIsManagement } from '@/hooks/useIsManagement';

/**
 * Customer management cell: what the system said this cover should cost on the
 * day it was sold (QOP = Quotes & Orders grid, RP = retail / Step 3) next to
 * what was actually sold, with the percentage gap.
 *
 * Prices change in Price Updates, so the reference is always priced with the
 * model that was live on the sale date — never with today's model.
 */
export const ReferencePriceCell: React.FC<{ order: SoldOrderLike | null | undefined }> = ({ order }) => {
  const [versions, setVersions] = React.useState<PricingVersionSnapshot[]>([]);
  const { isManagement } = useIsManagement();

  React.useEffect(() => {
    let alive = true;
    getPricingVersionHistoryCached().then(v => {
      if (alive) setVersions(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  const soldOn = (order as any)?.signup_date || (order as any)?.created_at || null;

  const ref = React.useMemo(
    () => withPricingAsOf(versions, soldOn, () => getSoldVsReference(order)),
    [order, versions, soldOn]
  );

  const priceMatched = !!(order as any)?.price_match_applied;
  const matchCompetitor = (order as any)?.price_match_competitor || null;
  const matchCompetitorPrice = Number((order as any)?.price_match_competitor_price) || null;

  const priceMatchTag = priceMatched ? (
    <Badge
      variant="outline"
      className="w-fit text-[11px] whitespace-nowrap border-sky-300 bg-sky-50 text-sky-800"
      title={`Agent used a price match override${matchCompetitor ? ` against ${matchCompetitor}` : ''}${matchCompetitorPrice ? ` (competitor quote £${Math.round(matchCompetitorPrice)})` : ''}. Competitor evidence is on the customer record.`}
    >
      <Gauge className="mr-1 h-3 w-3" />
      Price match override
    </Badge>
  ) : null;

  // Date and time the quote was actually given. Agents dispute discounts weeks
  // later, so the timestamp is always shown; only managers additionally see the
  // price model that was live at that moment (checked in Price Updates).
  const quotedAtRaw = (order as any)?.sale_quoted_at || null;
  const quotedAt = quotedAtRaw ? new Date(quotedAtRaw) : null;
  const priceModelLabel = (order as any)?.sale_pricing_version_label || null;
  const quoteGivenAt = quotedAt && !Number.isNaN(quotedAt.getTime()) ? (
    <div className="flex flex-col text-[11px] leading-tight text-slate-500">
      <span title="Date and time the agent gave this quote">
        Quote given{' '}
        <span className="font-medium text-slate-700">
          {quotedAt.toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </span>
      {isManagement && priceModelLabel && (
        <span title="Price model that was live in Price Updates when the quote was given">
          Price model: <span className="font-medium text-slate-700">{priceModelLabel}</span>
        </span>
      )}
    </div>
  ) : null;

  const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
  const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

  // Recorded at the point of sale (what the agent actually gave away). This is the
  // figure commissions use, so it always wins over a recalculated estimate — BUT
  // only when it agrees with the two prices we are showing. Some sales had the
  // quoted total corrected after the discount was first written, leaving a stale
  // percentage (e.g. quoted £1,236 → sold £1,000 shown as "0.8% off"). When the
  // stored figures disagree with quoted − paid, the two visible prices win.
  const storedQuoted = Number((order as any)?.sale_quoted_total) || 0;
  const storedPct = (order as any)?.sale_discount_pct;
  const storedPaid = Number((order as any)?.final_amount) || 0;
  const trueAmount = storedQuoted > 0 && storedPaid > 0 ? storedQuoted - storedPaid : 0;
  const truePct = trueAmount > 0.5 ? Math.round((trueAmount / storedQuoted) * 1000) / 10 : 0;
  const storedPctIsConsistent =
    storedPct != null && Math.abs(Number(storedPct) - truePct) <= 0.6;
  const recorded =
    storedQuoted > 0 && storedPaid > 0
      ? { quoted: storedQuoted, pct: storedPctIsConsistent ? Number(storedPct) : truePct, paid: storedPaid }
      : getRecordedOrderDiscount(order as any);


  // Sold ABOVE the quoted price — a premium, not a discount. Shown explicitly so
  // "No discount given" only ever means sold exactly at the quote.
  const premiumPct =
    recorded && recorded.quoted > 0 && recorded.paid > recorded.quoted
      ? ((recorded.paid - recorded.quoted) / recorded.quoted) * 100
      : 0;

  if (recorded) {
    return (
      <div className="flex flex-col gap-1 min-w-[150px]">
        {priceMatchTag}
        <div className="text-[11px] text-slate-600">
          Quoted <span className="font-semibold text-slate-900">{gbp(recorded.quoted)}</span> → sold{' '}
          <span className="font-semibold text-emerald-700">{gbp(recorded.paid)}</span>
        </div>
        {quoteGivenAt}
        <Badge
          variant="outline"
          className={`text-xs whitespace-nowrap ${
            premiumPct > 0 && recorded.pct <= 0
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : discountBandClass(recorded.pct)
          }`}
          title={`Discount recorded when this sale was confirmed: ${gbp(recorded.quoted - recorded.paid)} off the quoted ${gbp(recorded.quoted)}. This is the figure used for commission.`}
        >
          {recorded.pct > 0
            ? `${recorded.pct.toFixed(1)}% off given`
            : premiumPct > 0
              ? `Sold above quote +${premiumPct.toFixed(1)}%`
              : 'No discount given'}
        </Badge>
        {recorded.pct > DISCOUNT_CEILING_PCT && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-red-700">
            <AlertTriangle className="h-3 w-3" />
            Over {DISCOUNT_CEILING_PCT}% off
          </span>
        )}
      </div>
    );
  }

  if (!ref) {
    return priceMatchTag ?? <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-col gap-1 min-w-[150px]">
      {priceMatchTag}
      <div className="flex items-center gap-2 text-[11px] leading-tight">
        <span className="text-slate-600" title="Quotes & Orders (admin grid) price for this reg, claim limit, excess, labour rate and duration, using the prices that were live on the sale date">
          QOP <span className="font-semibold text-slate-900">{gbp(ref.qop)}</span>
        </span>
        <span className="text-slate-600" title="Retail price shown to customers on Step 3 on the sale date">
          RP <span className="font-semibold text-slate-900">{gbp(ref.rp)}</span>
        </span>
      </div>
      <div className="text-[11px] text-slate-600">
        Sold <span className="font-semibold text-emerald-700">{gbp(ref.sold)}</span>
      </div>
      {quoteGivenAt}
      <Badge
        variant="outline"
        className={`text-xs whitespace-nowrap ${referenceGapClass(ref)}`}
        title={`Sold ${gbp(ref.sold)} vs QOP ${gbp(ref.qop)} (${signed(ref.diffVsQopPct)}) · vs RP ${gbp(ref.rp)} (${signed(ref.diffVsRpPct)}) · lowest price allowed ${gbp(ref.minAllowed)} (prices live on the sale date)`}
      >
        {signed(ref.diffVsQopPct)} vs QOP (est.)
      </Badge>
      {ref.breach && (
        <span
          className="flex items-center gap-1 text-[11px] font-semibold text-red-700"
          title={
            ref.underFloor
              ? `Sold for less than the lowest price we allow for this cover (${gbp(ref.netFloor)}). A manager needs to approve this.`
              : `More than ${DISCOUNT_CEILING_PCT}% off the quoted price. The lowest price allowed here is ${gbp(ref.minAllowed)}.`
          }
        >
          <AlertTriangle className="h-3 w-3" />
          {ref.underFloor ? 'Below lowest price' : 'Over 30% off'}
        </span>
      )}
    </div>
  );
};

export default ReferencePriceCell;
