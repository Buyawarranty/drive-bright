import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
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

  if (!ref) return <span className="text-xs text-muted-foreground">—</span>;

  const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
  const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

  return (
    <div className="flex flex-col gap-1 min-w-[150px]">
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
      <Badge
        variant="outline"
        className={`text-xs whitespace-nowrap ${referenceGapClass(ref)}`}
        title={`Sold ${gbp(ref.sold)} vs QOP ${gbp(ref.qop)} (${signed(ref.diffVsQopPct)}) · vs RP ${gbp(ref.rp)} (${signed(ref.diffVsRpPct)}) · lowest price allowed ${gbp(ref.minAllowed)} (prices live on the sale date)`}
      >
        {signed(ref.diffVsQopPct)} vs QOP
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
