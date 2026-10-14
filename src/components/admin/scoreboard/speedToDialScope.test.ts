import { describe, expect, it } from 'vitest';
import { filterStatsByAgent } from './speedToDialScope';

const rows = [
  { ownerAgentId: 'james', label: 'james row' },
  { ownerAgentId: 'ajmal', label: 'ajmal row' },
  { ownerAgentId: null, label: 'unassigned row' },
];

describe('speed to dial row visibility', () => {
  it('shows a sales agent only their own row', () => {
    expect(filterStatsByAgent(rows, new Set(['james']))).toEqual([
      { ownerAgentId: 'james', label: 'james row' },
    ]);
  });

  it('never leaks a colleague row when an agent has no id yet', () => {
    expect(filterStatsByAgent(rows, new Set<string>([]))).toEqual([]);
  });

  it('shows management only the person the scoreboard is focused on', () => {
    expect(filterStatsByAgent(rows, new Set(['ajmal'])).map(r => r.label)).toEqual(['ajmal row']);
  });

  it('shows management every row when nothing is focused', () => {
    expect(filterStatsByAgent(rows, null)).toHaveLength(3);
  });
});
