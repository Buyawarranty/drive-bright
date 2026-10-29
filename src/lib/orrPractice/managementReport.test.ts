import { describe, expect, it } from 'vitest';
import { managementReport } from './managementReport';
import { makeSyntheticLead, makeSyntheticAgents } from './syntheticLeads';
import { DEFAULT_ORR_PRACTICE_SETTINGS as settings } from './settings';
import type { PracticeLead } from './types';

const at = Date.UTC(2026, 9, 29, 10);
const min = 60_000;
const lead = (patch: Partial<PracticeLead> = {}): PracticeLead => ({
  ...makeSyntheticLead(at, 1), identified: true, activeSession: false, stage: 'queued',
  tpsClear: true, phoneConsent: true, ...patch,
});
const report = (leads: PracticeLead[]) => managementReport(leads, makeSyntheticAgents(), settings, at + 10 * min);

describe('Practice management reports', () => {
  it('excludes anonymous, bought, closed and suppressed enquiries from backlog', () => {
    expect(report([lead(), lead({ identified: false }), lead({ purchased: true }), lead({ stage: 'closed' }), lead({ suppressed: true })]).backlog).toBe(1);
  });
  it('measures enquiry age without resetting it on re-release', () => {
    expect(report([lead({ lastStageChangeAt: at + 9 * min, releaseCount: 8 })]).oldestEnquiryMinutes).toBe(10);
  });
  it('flags six hand-offs for management without closing the lead', () => {
    const l = lead({ releaseCount: 6 });
    expect(report([l]).escalated).toBe(1);
    expect(l.stage).toBe('queued');
  });
  it('reports first attempts separately from genuine conversations, ignoring voicemail', () => {
    const l = lead({ outcomes: [
      { agentId: 'a', at: at + 2 * min, result: 'voicemail', source: 'zoiper', durationSeconds: 100 },
      { agentId: 'a', at: at + 5 * min, result: 'spoke', source: 'dial_nine', durationSeconds: 20 },
    ] });
    expect(report([l]).firstAttemptMinutes).toBe(2);
    expect(report([l]).firstConversationMinutes).toBe(5);
  });
  it('shows missing response evidence as unknown rather than zero', () => {
    expect(report([lead()]).firstConversationMinutes).toBeNull();
    expect(report([lead()]).firstAttemptSample).toBe(0);
  });
  it('keeps callback pending after voicemail and clears it only after a later conversation', () => {
    const l = lead({ callbackRequestedAt: at + min, callbackTime: at + 5 * min, outcomes: [
      { agentId: 'a', at: at + 6 * min, result: 'voicemail', source: 'zoiper', durationSeconds: 90 },
    ] });
    expect(report([l]).callbacks[0]?.overdue).toBe(true);
    expect(report([{ ...l, outcomes: [...l.outcomes, { agentId: 'a', at: at + 7 * min, result: 'spoke', source: 'zoiper', durationSeconds: 30 }] }]).callbacks).toHaveLength(0);
  });
  it('separates current holds from durable ownership and clamps spare capacity', () => {
    const agents = makeSyntheticAgents();
    const agent = agents[0];
    const r = managementReport([lead({ stage: 'reserved', reservedAgentId: agent.id }), lead({ stage: 'owned', ownerAgentId: agent.id })], [{ ...agent, dailyCap: 1, usedToday: 3 }], settings, at);
    expect(r.workload[0]).toMatchObject({ held: 1, owned: 1, remaining: 0 });
  });
  it('keeps contact-blocked enquiries in backlog but never counts them as callable', () => {
    expect(report([lead({ phoneConsent: false })])).toMatchObject({ backlog: 1, callable: 0 });
  });
});