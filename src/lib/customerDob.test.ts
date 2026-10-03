import { describe, it, expect } from 'vitest';
import { validateCustomerDob, toIsoDob } from './customerDob';

const today = new Date(Date.UTC(2026, 9, 3));

describe('customer DOB for monthly checkout', () => {
  it('accepts someone who turned 18 today', () => {
    expect(validateCustomerDob({ day: '3', month: '10', year: '2008' }, today)).toBeNull();
  });
  it('rejects someone who turns 18 tomorrow', () => {
    expect(validateCustomerDob({ day: '4', month: '10', year: '2008' }, today)).toMatch(/18/);
  });
  it('rejects an impossible date', () => {
    expect(validateCustomerDob({ day: '31', month: '02', year: '1980' }, today)).toMatch(/real date/);
  });
  it('builds a padded ISO date', () => {
    expect(toIsoDob({ day: '1', month: '8', year: '1975' }, today)).toBe('1975-08-01');
  });
});
