import { describe, it, expect } from 'vitest';
import { shouldHideOtherAgentNames, dealOwnerLabel } from '../agentDataVisibility';

describe('shouldHideOtherAgentNames', () => {
  it('hides other agents names for sales agents with the switch off (default)', () => {
    expect(shouldHideOtherAgentNames('sales', false)).toBe(true);
  });

  it('hides other agents names for sales leads with the switch off (default)', () => {
    expect(shouldHideOtherAgentNames('sales_lead', false)).toBe(true);
  });

  it('shows names for sales agents when management turns the switch on', () => {
    expect(shouldHideOtherAgentNames('sales', true)).toBe(false);
    expect(shouldHideOtherAgentNames('sales_lead', true)).toBe(false);
  });

  it('never hides names from management regardless of the switch', () => {
    expect(shouldHideOtherAgentNames('admin', false)).toBe(false);
    expect(shouldHideOtherAgentNames('super_admin', false)).toBe(false);
    expect(shouldHideOtherAgentNames('sales_manager', false)).toBe(false);
  });
});

describe('dealOwnerLabel', () => {
  it('shows the real name on the viewer\'s own deal', () => {
    expect(dealOwnerLabel(true, 'agent-1', 'agent-1', 'James Reed')).toBe('James Reed');
  });

  it('masks another agent\'s name and email when the switch is off', () => {
    expect(dealOwnerLabel(true, 'agent-2', 'agent-1', 'Adam Walker')).toBe('Sales agent');
    expect(dealOwnerLabel(true, 'agent-2', 'agent-1', 'adam@buyawarranty.co.uk')).toBe('Sales agent');
  });

  it('shows the real name when the switch is on or the viewer is management', () => {
    expect(dealOwnerLabel(false, 'agent-2', 'agent-1', 'Adam Walker')).toBe('Adam Walker');
  });

  it('shows the real name for unassigned/website deals (no agent to hide)', () => {
    expect(dealOwnerLabel(true, null, 'agent-1', 'Website')).toBe('Website');
  });
});
