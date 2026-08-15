import { NET_FLOOR_BY_PERIOD } from '@/lib/pricing/netFloor';

interface BaseFloorNoticeProps {
  /** Optional hard global floor that overrides the per-term base when higher. */
  minFloor?: number;
  /** Show the discount guidance lines (Quick discounts wording). */
  showDiscountNote?: boolean;
  className?: string;
}

/**
 * Staff-only explainer of the base sale-price floor per term, discount included.
 * Shared by Get a quote and Confirm external payment so the rule reads identically
 * on both surfaces.
 */
export function BaseFloorNotice({ minFloor = 0, showDiscountNote = false, className }: BaseFloorNoticeProps) {
  const floor = (period: '12months' | '24months' | '36months') =>
    Math.max(NET_FLOOR_BY_PERIOD[period], minFloor);

  return (
    <div
      className={`rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-[11px] text-slate-700 ${className ?? ''}`}
    >
      <p className="font-bold text-slate-900">Base floor — minimum sale price, including any discount</p>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-semibold">
        <span>1 year — £{floor('12months')}</span>
        <span>2 year — £{floor('24months')}</span>
        <span>3 year — £{floor('36months')}</span>
      </div>
      <p className="mt-1 font-normal">
        These are the lowest totals you can sell at after discount — unless it's a price match with the
        competitor quote uploaded. Richer claim limits, a higher labour rate or a lower excess lift the
        floor above these figures; motorbikes are half. Staff only — customers never see this.
      </p>
      {showDiscountNote && (
        <div className="mt-2 border-t border-slate-200 pt-2">
          <p className="font-bold text-slate-900">Quick discounts</p>
          <p className="font-normal">
            Applied to calculated total ·{' '}
            <span className="font-semibold text-emerald-700">
              Any discount allowed down to the minimum price for this term
            </span>
          </p>
          <p className="mt-0.5 font-normal">
            Your cap is judged on your average discount across sales, not each individual sale.
          </p>
        </div>
      )}
    </div>
  );
}

export default BaseFloorNotice;
