import { describe, expect, it } from 'vitest';
import { canSeeLeadPopup, canSeeVerifiedLeadNotification, canSeePopup, isSalesPopupRole, POPUP_TYPES } from '../popupAccess';

describe.each(['sales', 'sales_lead'])('%s pop-ups', role => {
  it('shows only currently assigned own leads', () => {
    expect(canSeeLeadPopup(role, 'self', 'self')).toBe(true);
    expect(canSeeLeadPopup(role, 'self', 'other')).toBe(false);
    expect(canSeeLeadPopup(role, 'self', null)).toBe(false);
    expect(canSeeLeadPopup(role, null, 'self')).toBe(false);
  });
  it('blocks unscoped and chat pop-ups even with explicit grants', () => {
    for (const { id } of POPUP_TYPES.filter(p => !['new_leads', 'stuck_checkout', 'failed_payment', 'reminders'].includes(p.id))) {
      expect(canSeePopup(id, role, { [`popup_${id}`]: true })).toBe(false);
    }
    expect(canSeePopup('unknown', role, { popup_unknown: true })).toBe(false);
  });
  it('preserves on/off control for ownership-enforced alerts', () => {
    expect(canSeePopup('failed_payment', role, { popup_failed_payment: true })).toBe(true);
    expect(canSeePopup('failed_payment', role, { popup_failed_payment: false })).toBe(false);
  });
  it('requires a currently verified lead for WhatsApp, bell and authorisation notifications', () => {
    expect(canSeeVerifiedLeadNotification(role, 'own-lead', true)).toBe(true);
    expect(canSeeVerifiedLeadNotification(role, 'other-lead', false)).toBe(false);
    expect(canSeeVerifiedLeadNotification(role, 'reassigned-lead', false)).toBe(false);
    expect(canSeeVerifiedLeadNotification(role, null, true)).toBe(false);
  });
});
it('keeps management lead visibility unchanged', () => {
  for (const role of ['admin', 'super_admin', 'sales_manager']) expect(canSeeLeadPopup(role, 'self', 'other')).toBe(true);
});
it('defines sales as sales agents and sales leads only', () => {
  expect(isSalesPopupRole('sales')).toBe(true);
  expect(isSalesPopupRole('sales_lead')).toBe(true);
  expect(isSalesPopupRole('sales_manager')).toBe(false);
});
it('fails closed while role is unresolved', () => {
  expect(canSeeLeadPopup(null, 'self', 'self')).toBe(false);
  expect(canSeePopup('new_leads', null, { popup_new_leads: true })).toBe(false);
  expect(canSeeVerifiedLeadNotification(null, 'own-lead', true)).toBe(false);
});