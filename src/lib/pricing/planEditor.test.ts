import { describe, expect, it } from 'vitest';
import { hydratePlanModel, planWebsiteDifference } from './planEditor';

describe('plan editor isolation', () => {
  it('uses only the selected plan figures and preserves additional fields', () => {
    const defaults = { bands: [{ key: '6-7', label: '6–7 years', oneYear: 499 }], absoluteMinTotal: 399 };
    const selected = { bands: [{ key: '6-7', oneYear: 812 }], absoluteMinTotal: 450 };
    const editor = hydratePlanModel(defaults, selected);
    expect(editor.bands[0].oneYear).toBe(812);
    expect(editor.absoluteMinTotal).toBe(450);
    editor.bands[0].oneYear = 900;
    expect(selected.bands[0].oneYear).toBe(812);
  });
  it('keeps the selected plan percentage instead of a different browser draft', () => {
    expect(planWebsiteDifference(0, 10, 25)).toBe(0);
    expect(planWebsiteDifference(-15, 10, 25)).toBe(-15);
    expect(planWebsiteDifference(undefined, 8, 25)).toBe(8);
  });
});