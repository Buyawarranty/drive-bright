import { describe, expect, it } from 'vitest';
import { canSwitchOrrView } from './OrrSandboxTabView';

describe('ORR presentation view switch', () => {
  it('is offered to sales managers', () => expect(canSwitchOrrView('sales_manager')).toBe(true));
  it('is offered to admins', () => expect(canSwitchOrrView('admin')).toBe(true));
  it('is offered to super admins', () => expect(canSwitchOrrView('super_admin')).toBe(true));
  it('does not treat sales leads as management', () => expect(canSwitchOrrView('sales_lead')).toBe(false));
  it('is not offered to sales or unknown roles', () => {
    expect(canSwitchOrrView('sales')).toBe(false);
    expect(canSwitchOrrView(null)).toBe(false);
  });
});