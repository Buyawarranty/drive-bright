import { describe, it, expect } from 'vitest';
import {
  SALE_AUTH_POPUP_DAYS,
  saleAuthPopupCutoff,
  isSaleAuthWithinPopupWindow,
} from '@/lib/saleAuthorisationPopupWindow';

describe('sale authorisation pop-up window', () => {
  const now = new Date('2026-10-14T22:00:00Z');

  it('is 3 days', () => {
    expect(SALE_AUTH_POPUP_DAYS).toBe(3);
  });

  it('cutoff is exactly 3 days before now', () => {
    expect(saleAuthPopupCutoff(now)).toBe('2026-10-11T22:00:00.000Z');
  });

  it('still shows a decision made 2 days ago', () => {
    expect(isSaleAuthWithinPopupWindow('2026-10-12T22:00:00.000Z', now)).toBe(true);
  });

  it('still shows a decision made just under 3 days ago', () => {
    expect(isSaleAuthWithinPopupWindow('2026-10-11T22:01:00.000Z', now)).toBe(true);
  });

  it('stops showing a decision made 3 days and a minute ago', () => {
    expect(isSaleAuthWithinPopupWindow('2026-10-11T21:59:00.000Z', now)).toBe(false);
  });

  it('never shows a decision with no timestamp', () => {
    expect(isSaleAuthWithinPopupWindow(null, now)).toBe(false);
  });
});
