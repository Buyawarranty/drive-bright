import { describe, it, expect } from 'vitest';
import { buildRecommendations, computeSalesGap } from './salesRecommendations';

const base = { today: new Date(2026, 9, 10), target: 31000, monthRevenue: 5000, monthSales: 10, lastMonthSameDayRevenue: 0, lastMonthSameDaySales: 0, bySource: {} };

describe('sales recommendations', () => {
  it('measures gap against pro-rata target pace', () => {
    const g = computeSalesGap(base);
    expect(g.expectedByNow).toBe(10000);
    expect(g.gap).toBe(5000);
    expect(g.salesNeeded).toBe(52);
  });
  it('flags behind-target as high priority first', () => {
    expect(buildRecommendations(base)[0].priority).toBe('high');
  });
  it('asks for a goal when none set', () => {
    expect(buildRecommendations({ ...base, target: 0 })[0].title).toMatch(/Set this month/);
  });
});
