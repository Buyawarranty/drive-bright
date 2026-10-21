import { describe, it, expect } from 'vitest';
import { isAutomatedLeadNote } from './leadNoteLock';
describe('note lock', () => {
  it('no-answer shorthand does not lock', () => {
    for (const t of ['na', 'a na', 'CRK // NA', 'CRK // No answer.', '[03 Jul 2026, 17:29 — Ash] Status changed to "contacted"']) expect(isAutomatedLeadNote(t)).toBe(true);
  });
  it('real notes still lock', () => {
    expect(isAutomatedLeadNote('Customer wants a call Friday')).toBe(false);
    expect(isAutomatedLeadNote('nana is buying the car')).toBe(false);
  });
});
