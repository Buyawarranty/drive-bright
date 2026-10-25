import { deriveCustomerPriceFromAdmin, formatGBP, type PricingMatrixShape } from '@/lib/pricingMatrix';
import { clampToNetFloor, clampWebToNetFloor } from '@/lib/pricing/netFloor';
import { priceDifference } from '@/lib/pricing/priceComparison';

interface Props {
  matrix: PricingMatrixShape;
  discountPct: number;
  liveMatrix: PricingMatrixShape;
  liveDiscountPct: number;
  liveLabel: string;
}

function Difference({ candidate, baseline }: { candidate: number; baseline: number }) {
  const difference = priceDifference(candidate, baseline);
  if (!difference) return <span className="text-muted-foreground">Unavailable</span>;
  if (difference.direction === 'same') return <span className="text-muted-foreground">No change</span>;
  return <span className={difference.direction === 'higher' ? 'text-destructive' : 'text-primary'}>
    {formatGBP(Math.abs(difference.amount))} {difference.direction} ({Math.abs(difference.percent).toFixed(1)}%)
  </span>;
}

export default function PlanLiveComparison({ matrix, discountPct, liveMatrix, liveDiscountPct, liveLabel }: Props) {
  return <section className="space-y-3" aria-label="Plan versus live pricing">
    <h3 className="font-semibold">Compared with live: {liveLabel}</h3>
    <p className="text-xs text-muted-foreground">Matching £2,000 grid column · £70/hour labour · £0 and £150 excess. Grid references only, before vehicle adjustments or offers. Each website column uses its own plan’s percentage; existing minimums apply.</p>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b text-left text-xs text-muted-foreground">
          {['Term / excess', 'Live Q&O', 'Plan Q&O', 'Q&O change', 'Live Step 3', 'Plan Step 3', 'Step 3 change', 'Plan Q&O versus Step 3'].map(heading => <th key={heading} className="p-2 align-bottom">{heading}</th>)}
        </tr></thead>
        <tbody>{(['12months', '24months', '36months'] as const).flatMap((period, index) => [0, 150].map(excess => {
          const raw = matrix[period]?.[String(excess)]?.['2000'];
          const liveRaw = liveMatrix[period]?.[String(excess)]?.['2000'];
          if (!raw || !liveRaw) return <tr key={`${period}-${excess}`}><td className="p-2">{index + 1} year · £{excess}</td><td colSpan={7} className="p-2 text-muted-foreground">Reference cell unavailable</td></tr>;
          const params = { paymentPeriod: period, voluntaryExcess: excess, claimLimit: 2000 };
          const qo = clampToNetFloor(raw, params);
          const liveQo = clampToNetFloor(liveRaw, params);
          const web = clampWebToNetFloor(deriveCustomerPriceFromAdmin(raw, discountPct), params);
          const liveWeb = clampWebToNetFloor(deriveCustomerPriceFromAdmin(liveRaw, liveDiscountPct), params);
          return <tr key={`${period}-${excess}`} className="border-b last:border-0">
            <td className="p-2 whitespace-nowrap font-medium">{index + 1} year{index > 0 ? 's' : ''} · £{excess}</td>
            <td className="p-2">{formatGBP(liveQo)}</td><td className="p-2 font-semibold">{formatGBP(qo)}</td>
            <td className="p-2"><Difference candidate={qo} baseline={liveQo} /></td>
            <td className="p-2">{formatGBP(liveWeb)}</td><td className="p-2 font-semibold">{formatGBP(web)}</td>
            <td className="p-2"><Difference candidate={web} baseline={liveWeb} /></td>
            <td className="p-2"><Difference candidate={qo} baseline={web} /></td>
          </tr>;
        }))}</tbody>
      </table>
    </div>
  </section>;
}