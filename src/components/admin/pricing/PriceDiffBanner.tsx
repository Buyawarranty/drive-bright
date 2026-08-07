import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { PriceTestQuoteSnapshot } from './PriceTestStep2';

/**
 * Overall price difference between the two Step 2 columns of a comparison panel.
 * Averages the percentage gap across every cover term priced with the same
 * options, so "20% cheaper" means cheaper across 1, 2 and 3 year cover.
 */
export interface PriceDiffBannerProps {
  /** Reference column (the "compared against" side). */
  baseline: PriceTestQuoteSnapshot | null;
  baselineLabel: string;
  /** The column being judged cheaper or more expensive. */
  candidate: PriceTestQuoteSnapshot | null;
  candidateLabel: string;
}

const fmtGBP = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

export default function PriceDiffBanner({
  baseline,
  baselineLabel,
  candidate,
  candidateLabel,
}: PriceDiffBannerProps) {
  const pairs = (candidate?.terms ?? [])
    .map(t => {
      const base = baseline?.terms.find(b => b.months === t.months);
      return base && base.total > 0 ? { months: t.months, label: t.label, base: base.total, cand: t.total } : null;
    })
    .filter(Boolean) as { months: number; label: string; base: number; cand: number }[];

  if (!pairs.length) {
    return (
      <div className="rounded-lg border-2 border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        Overall price difference appears once both columns quote a price (a referral or blocked profile has no price
        to compare).
      </div>
    );
  }

  const avgPct = pairs.reduce((sum, p) => sum + ((p.cand - p.base) / p.base) * 100, 0) / pairs.length;
  const rounded = Math.round(avgPct * 10) / 10;
  const cheaper = rounded < -0.05;
  const dearer = rounded > 0.05;
  const abs = Math.abs(rounded).toFixed(1);

  const tone = cheaper
    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : dearer
      ? 'border-destructive/50 bg-destructive/10 text-destructive'
      : 'border-border bg-muted/40 text-foreground';

  const Icon = cheaper ? ArrowDownRight : dearer ? ArrowUpRight : Minus;

  return (
    <div className={`rounded-lg border-2 px-4 py-3 ${tone}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Icon className="h-5 w-5 shrink-0" />
        <span className="text-base font-bold">
          {cheaper
            ? `${candidateLabel} is ${abs}% cheaper overall than ${baselineLabel}`
            : dearer
              ? `${candidateLabel} is ${abs}% more expensive overall than ${baselineLabel}`
              : `${candidateLabel} and ${baselineLabel} price the same overall`}
        </span>
        <span className="text-xs font-medium opacity-80">
          average across {pairs.length} cover term{pairs.length === 1 ? '' : 's'}, same options on both sides
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs font-medium">
        {pairs.map(p => {
          const pct = ((p.cand - p.base) / p.base) * 100;
          const sign = pct > 0 ? '+' : '';
          return (
            <span key={p.months}>
              {p.label}: {fmtGBP(p.base)} → {fmtGBP(p.cand)} ({sign}
              {pct.toFixed(1)}%)
            </span>
          );
        })}
      </div>
    </div>
  );
}
