import { describe, expect, it } from 'vitest';
import { monthlyChartTarget } from './monthlyRevenueGoal';

describe('monthly target visibility', () => {
  const now = new Date('2026-10-19T06:41:00Z');
  it('plots the current month target', () => {
    expect(monthlyChartTarget('2026-10', 140000, now)).toBe(140000);
  });
  it('does not plot saved targets for previous months', () => {
    expect(monthlyChartTarget('2025-11', 140000, now)).toBe(0);
    expect(monthlyChartTarget('2026-09', 140000, now)).toBe(0);
  });
  it('uses the London month at the UTC month boundary', () => {
    const boundary = new Date('2026-09-30T23:30:00Z');
    expect(monthlyChartTarget('2026-10', 140000, boundary)).toBe(140000);
    expect(monthlyChartTarget('2026-09', 140000, boundary)).toBe(0);
  });
});