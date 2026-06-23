import React from 'react';
import { cn } from '@/lib/utils';
import { Gauge, AlertTriangle } from 'lucide-react';

interface Props {
  purchase?: number | null;
  current?: number | null;
}

const fmt = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : `${n}`);

/**
 * Compact mileage delta chip.
 * - Grey: no data
 * - Neutral: small delta
 * - Amber: high jump (>20k) — possible undisclosed use
 * - Red: claim mileage < purchase mileage (data mismatch)
 */
export const MileageChip: React.FC<Props> = ({ purchase, current }) => {
  if (current == null) {
    if (purchase == null) {
      return (
        <span
          title="No mileage on file"
          className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-500 border border-slate-200"
        >
          <Gauge className="h-2.5 w-2.5" />—
        </span>
      );
    }
    return (
      <span
        title={`Policy mileage: ${purchase.toLocaleString()} • no claim mileage yet`}
        className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
      >
        <Gauge className="h-2.5 w-2.5" />
        {fmt(purchase)}
      </span>
    );
  }
  if (purchase == null) {
    return (
      <span
        title={`Claim mileage: ${current.toLocaleString()} • no policy mileage on file`}
        className="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-200"
      >
        <Gauge className="h-2.5 w-2.5" />
        {fmt(current)}
      </span>
    );
  }
  const delta = current - purchase;
  const mismatch = delta < 0;
  const highJump = delta >= 20000;
  const cls = mismatch
    ? 'bg-red-50 text-red-700 border-red-200'
    : highJump
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';
  const sign = delta >= 0 ? '+' : '−';
  const Icon = mismatch ? AlertTriangle : Gauge;
  return (
    <span
      title={`Policy: ${purchase.toLocaleString()} → claim: ${current.toLocaleString()} (${sign}${Math.abs(delta).toLocaleString()} mi)`}
      className={cn(
        'inline-flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-semibold border whitespace-nowrap',
        cls,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {sign}{fmt(Math.abs(delta))}
    </span>
  );
};
