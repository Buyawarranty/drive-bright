import { describe, expect, it } from 'vitest';
import { adjustPriceMatrix } from './percentageAdjustment';

describe('saved percentage price adjustments', () => {
  const matrix = { '12months': { '0': { '1000': 500 } }, '24months': { '0': { '1000': 1000 } }, '36months': { '0': { '1000': 1500 } } };
  it('increases every term by the chosen 10%', () => {
    expect(adjustPriceMatrix(matrix, 10)).toEqual({ '12months': { '0': { '1000': 550 } }, '24months': { '0': { '1000': 1100 } }, '36months': { '0': { '1000': 1650 } } });
    expect(matrix['12months']['0']['1000']).toBe(500);
  });
  it('decreases every term by the chosen 10%', () => {
    expect(adjustPriceMatrix(matrix, -10)).toEqual({ '12months': { '0': { '1000': 450 } }, '24months': { '0': { '1000': 900 } }, '36months': { '0': { '1000': 1350 } } });
  });
  it('keeps whole-pound rounding', () => {
    expect(adjustPriceMatrix({ '12months': { '0': { '1000': 499 } } }, 5)['12months']['0']['1000']).toBe(524);
  });
  it('rejects zero, invalid and non-positive resulting prices', () => {
    for (const pct of [0, NaN, Infinity, -100, -110, 201]) expect(() => adjustPriceMatrix(matrix, pct)).toThrow();
    expect(() => adjustPriceMatrix({ '12months': { '0': { '1000': 1 } } }, -99)).toThrow();
  });
});