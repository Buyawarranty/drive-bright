import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_UNWORKED_PER_AGENT,
  MAX_UNWORKED_HARD_CAP,
  freeSlotsFor,
  planCapacityRelease,
  sanitiseMaxUnworked,
  totalFreeSlots,
  type CapacityAgent,
} from './capacityRelease';

const agent = (id: string, eligible: boolean, unworkedClaimed: number): CapacityAgent => ({
  id,
  eligible,
  unworkedClaimed,
});

describe('sanitiseMaxUnworked', () => {
  it('defaults to 2 for rubbish input', () => {
    expect(sanitiseMaxUnworked(undefined)).toBe(DEFAULT_MAX_UNWORKED_PER_AGENT);
    expect(sanitiseMaxUnworked('abc')).toBe(DEFAULT_MAX_UNWORKED_PER_AGENT);
  });
  it('clamps between 1 and the hard cap', () => {
    expect(sanitiseMaxUnworked(0)).toBe(1);
    expect(sanitiseMaxUnworked(99)).toBe(MAX_UNWORKED_HARD_CAP);
    expect(sanitiseMaxUnworked(3)).toBe(3);
  });
});

describe('freeSlotsFor / totalFreeSlots', () => {
  it('an eligible agent with no unworked leads has the full allowance', () => {
    expect(freeSlotsFor(agent('a', true, 0), 2)).toBe(2);
  });
  it('an agent at the cap has no free slots', () => {
    expect(freeSlotsFor(agent('a', true, 2), 2)).toBe(0);
    expect(freeSlotsFor(agent('a', true, 5), 2)).toBe(0);
  });
  it('an ineligible agent contributes nothing', () => {
    expect(freeSlotsFor(agent('a', false, 0), 2)).toBe(0);
  });
  it('totals across the team', () => {
    const agents = [agent('a', true, 0), agent('b', true, 1), agent('c', false, 0), agent('d', true, 2)];
    expect(totalFreeSlots(agents, 2)).toBe(3);
  });
});

describe('planCapacityRelease', () => {
  it('releases only enough leads to match capacity (6 agents x 2 slots = 12 max)', () => {
    const agents = Array.from({ length: 6 }, (_, i) => agent(`a${i}`, true, 0));
    const plan = planCapacityRelease({ backlog: 186, agents, maxUnworkedPerAgent: 2 });
    expect(plan.releaseCount).toBe(12);
    expect(plan.backlogAfter).toBe(174);
    expect(plan.freeSlotsBefore).toBe(12);
  });

  it('never releases more than the backlog', () => {
    const agents = [agent('a', true, 0), agent('b', true, 0)];
    const plan = planCapacityRelease({ backlog: 3, agents, maxUnworkedPerAgent: 2 });
    expect(plan.releaseCount).toBe(3);
    expect(plan.backlogAfter).toBe(0);
  });

  it('releases nothing when nobody is eligible', () => {
    const plan = planCapacityRelease({
      backlog: 10,
      agents: [agent('a', false, 0), agent('b', false, 1)],
      maxUnworkedPerAgent: 2,
    });
    expect(plan.releaseCount).toBe(0);
    expect(plan.backlogAfter).toBe(10);
  });

  it('releases nothing when every eligible agent is full', () => {
    const plan = planCapacityRelease({
      backlog: 10,
      agents: [agent('a', true, 2), agent('b', true, 2)],
      maxUnworkedPerAgent: 2,
    });
    expect(plan.releaseCount).toBe(0);
  });

  it('tops up as capacity frees — an agent with one unworked lead opens one slot', () => {
    const plan = planCapacityRelease({
      backlog: 5,
      agents: [agent('a', true, 1), agent('b', true, 0)],
      maxUnworkedPerAgent: 2,
    });
    expect(plan.releaseCount).toBe(3);
    expect(plan.slotsByAgent).toEqual({ a: 1, b: 2 });
  });

  it('handles an empty or negative backlog safely', () => {
    const plan = planCapacityRelease({ backlog: -4, agents: [agent('a', true, 0)] });
    expect(plan.releaseCount).toBe(0);
    expect(plan.backlogAfter).toBe(0);
  });
});
