import { describe, it, expect } from 'vitest';
import { projectAgent } from './agentProjection';

describe('projectAgent', () => {
  it('extrapolates £10,000 by day 15 of 30 to £20,000 and 50% of a £40,000 target', () => {
    const p = projectAgent(10000, 10, 15, 30, 40000);
    expect(p.projectedRevenue).toBe(20000);
    expect(p.projectedSales).toBe(20);
    expect(p.projectedPct).toBe(50);
  });
  it('has no percentage when no target is set', () => {
    expect(projectAgent(500, 1, 10, 31, 0).projectedPct).toBeNull();
  });
});
