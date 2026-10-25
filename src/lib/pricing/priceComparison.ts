/** Read-only comparison of already calculated totals; never changes pricing. */
export function priceDifference(candidate: number, baseline: number) {
  if (!Number.isFinite(candidate) || !Number.isFinite(baseline) || baseline <= 0) return null;
  const amount = candidate - baseline;
  return { amount, percent: amount / baseline * 100, direction: amount > 0 ? 'higher' : amount < 0 ? 'lower' : 'same' } as const;
}