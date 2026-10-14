import { describe, it, expect } from 'vitest';
import {
  SALE_AUTH_POPUP_DAYS,
  saleAuthPopupCutoff,
  isSaleAuthWithinPopupWindow,
  saleAuthAgentActions,
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

  it('an authorised sale offers "Accepted, thanks" and "I\'ll speak to manager"', () => {
    expect(saleAuthAgentActions('approved').map((a) => a.key)).toEqual([
      'accepted',
      'will_speak_to_manager',
    ]);
    expect(saleAuthAgentActions('approved').map((a) => a.label)).toEqual([
      'Accepted, thanks',
      "I'll speak to manager",
    ]);
  });

  it('a declined sale leads with speaking to the manager', () => {
    expect(saleAuthAgentActions('declined').map((a) => a.key)).toEqual([
      'will_speak_to_manager',
      'acknowledged',
    ]);
  });

  it('only stores the replies management can read', () => {
    const stored = new Set(['accepted', 'will_speak_to_manager', 'acknowledged']);
    for (const status of ['approved', 'declined']) {
      for (const action of saleAuthAgentActions(status)) {
        expect(stored.has(action.key)).toBe(true);
      }
    }
  });
});
