import { describe, expect, it } from 'vitest';
import { canOpenFailedPaymentPanel, canSeeFailedPaymentAlert } from '../failedPaymentAccess';

describe('Failed payment privacy', () => {
  for (const role of ['sales', 'sales_lead']) {
    it(`${role} sees only verified own alerts`, () => {
      expect(canSeeFailedPaymentAlert(role, true)).toBe(true);
      expect(canSeeFailedPaymentAlert(role, false)).toBe(false);
    });
  }
  for (const role of ['admin', 'super_admin']) {
    it(`${role} retains all alerts`, () => expect(canSeeFailedPaymentAlert(role, false)).toBe(true));
  }
  for (const role of ['sales_manager', 'accounts', 'lead_gen', 'dev_tester', null]) {
    it(`${role} cannot open or bypass the panel`, () => {
      expect(canOpenFailedPaymentPanel(role)).toBe(false);
      expect(canSeeFailedPaymentAlert(role, true)).toBe(false);
    });
  }
});