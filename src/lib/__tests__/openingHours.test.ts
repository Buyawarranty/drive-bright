import { describe, expect, it } from 'vitest';
import { isSalesPhoneOpenNow } from '@/lib/aiSandbox/openingHours';

describe('sales phone opening hours in Europe/London', () => {
  it('is open Monday to Friday from 9am until 6pm', () => {
    expect(isSalesPhoneOpenNow(new Date('2026-10-02T08:00:00Z'))).toBe(true); // Friday 9am BST
    expect(isSalesPhoneOpenNow(new Date('2026-10-02T17:00:00Z'))).toBe(false); // Friday 6pm BST
  });

  it('is open Saturday from midday until 4pm', () => {
    expect(isSalesPhoneOpenNow(new Date('2026-10-03T10:59:00Z'))).toBe(false); // 11:59am BST
    expect(isSalesPhoneOpenNow(new Date('2026-10-03T11:00:00Z'))).toBe(true); // midday BST
    expect(isSalesPhoneOpenNow(new Date('2026-10-03T15:00:00Z'))).toBe(false); // 4pm BST
  });

  it('is closed on Sunday', () => {
    expect(isSalesPhoneOpenNow(new Date('2026-10-04T12:00:00Z'))).toBe(false);
  });
});