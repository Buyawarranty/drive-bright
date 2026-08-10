import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import {
  getSoldVsReference,
  referenceGapClass,
  DISCOUNT_CEILING_PCT,
  type SoldOrderLike,
} from '@/lib/pricing/soldVsReference';

/**
 * Customer management cell: what the system says this cover should cost
 * (QOP = Quotes & Orders grid, RP = retail / Step 3) next to what was actually
 * sold, with the percentage gap. Sales agreed outside the system show up here
 * immediately, and anything past the 30% ceiling / net floor is flagged red.
 */
export const ReferencePriceCell: React.FC<{ order: SoldOrderLike | null | undefined }> = ({ order }) => {
  const ref = React.useMemo(() => getSoldVsReference(order), [order]);

  if (!ref) return <span className="text-xs text-muted-foreground">—</span>;

  const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
  const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;

  return (
    <div className="flex flex-col gap-1 min-w-[150px]">
      <div className="flex items-center gap-2 text-[11px] leading-tight">
        <span className="text-slate-600" title="Quotes & Orders (admin grid) price for this reg, claim limit, excess, labour rate and duration">
          QOP <span className="font-semibold text-slate-900">{gbp(ref.qop)}</span>
        </span>
        <span className="text-slate-600" title="Retail price shown to customers on Step 3">
          RP <span className="font-semibold text-slate-900">{gbp(ref.rp)}</span>
        </span>
      </div>
      <div className="text-[11px] text-slate-600">
        Sold <span className="font-semibold text-emerald-700">{gbp(ref.sold)}</span>
      </div>
      <Badge
        variant="outline"
        className={`text-xs whitespace-nowrap ${referenceGapClass(ref)}`}
        title={`Sold ${gbp(ref.sold)} vs QOP ${gbp(ref.qop)} (${signed(ref.diffVsQopPct)}) · vs RP ${gbp(ref.rp)} (${signed(ref.diffVsRpPct)}) · minimum allowed ${gbp(ref.minAllowed)}`}
      >
        {signed(ref.diffVsQopPct)} vs QOP
      </Badge>
      {ref.breach && (
        <span
          className="flex items-center gap-1 text-[11px] font-semibold text-red-700"
          title={
            ref.underFloor
              ? `Below the ${gbp(ref.netFloor)} net payable floor for this cover — must be authorised by management.`
              : `More than ${DISCOUNT_CEILING_PCT}% below the quoted price. Minimum allowed is ${gbp(ref.minAllowed)}.`
          }
        >
          <AlertTriangle className="h-3 w-3" />
          {ref.underFloor ? 'Under floor' : 'Over 30% off'}
        </span>
      )}
    </div>
  );
};

export default ReferencePriceCell;
