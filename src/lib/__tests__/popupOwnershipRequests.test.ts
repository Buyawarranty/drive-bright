import { describe, expect, it } from 'vitest';
import { createPopupOwnershipRequests } from '../popupOwnershipRequests';

describe('pop-up ownership request ordering', () => {
  it('rejects an old approval after a newer ownership denial', () => {
    const requests = createPopupOwnershipRequests();
    const oldApproval = requests.begin();
    const newDenial = requests.begin();
    expect(requests.isCurrent(newDenial)).toBe(true);
    expect(requests.isCurrent(oldApproval)).toBe(false);
  });
  it('rejects a pending approval when the connection or ownership changes', () => {
    const requests = createPopupOwnershipRequests();
    const approval = requests.begin();
    requests.invalidate();
    expect(requests.isCurrent(approval)).toBe(false);
  });
});