/**
 * Fair-fill lead distribution.
 *
 * Hands out leads ONE AT A TIME, always to the agent with the fewest leads
 * today (counting what this pass has already granted them). This levels the
 * team up instead of giving a big block to whoever has the most remaining
 * capacity (the old proportional-weight behaviour).
 *
 * Ties break on the caller's array order (which should already be sorted by
 * rotation / sort_order).
 */
export type FairFillAgent = {
  id: string;
  /** Leads already assigned to this agent today. */
  usedToday: number;
  /** Remaining daily capacity (use a large number for uncapped agents). */
  remaining: number;
};

export function fairFillShares(agents: FairFillAgent[], totalToMove: number): Record<string, number> {
  const pool = agents
    .filter(a => a.remaining > 0)
    .map(a => ({ ...a, share: 0 }));

  const shares: Record<string, number> = {};
  if (!pool.length || totalToMove <= 0) return shares;

  let left = Math.min(
    totalToMove,
    pool.reduce((s, a) => s + a.remaining, 0),
  );

  while (left > 0) {
    let target: (typeof pool)[number] | null = null;
    for (const a of pool) {
      if (a.share >= a.remaining) continue;
      if (!target || a.usedToday + a.share < target.usedToday + target.share) target = a;
    }
    if (!target) break;
    target.share += 1;
    left -= 1;
  }

  pool.forEach(a => {
    if (a.share > 0) shares[a.id] = a.share;
  });
  return shares;
}
