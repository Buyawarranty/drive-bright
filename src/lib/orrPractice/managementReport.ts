import type { PracticeAgent, PracticeLead } from './types';
import type { OrrPracticeSettings } from './settings';
import { canAttemptContact } from './contactSafety';

const minutes = (from: number, to: number) => Math.max(0, (to - from) / 60_000);
const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const openLead = (lead: PracticeLead) => lead.identified && !lead.purchased && !lead.suppressed && lead.stage !== 'closed';

/** Read-only projection of the current invented run; never changes allocation or credit. */
export const managementReport = (
  leads: PracticeLead[], agents: PracticeAgent[], settings: OrrPracticeSettings, at: number,
) => {
  const pending = leads.filter(openLead);
  const backlog = pending.filter(l => l.stage === 'queued' || l.stage === 'awaiting_release');
  const callbacks = pending.filter(l => l.callbackRequestedAt !== null && !l.outcomes.some(
    o => o.result === 'spoke' && o.durationSeconds > 0 && o.at >= (l.callbackRequestedAt ?? Infinity),
  )).sort((a, b) => (a.callbackTime ?? a.callbackRequestedAt ?? at) - (b.callbackTime ?? b.callbackRequestedAt ?? at));
  const attempts = leads.flatMap(l => {
    const first = [...l.outcomes].sort((a, b) => a.at - b.at)[0];
    return first ? [minutes(l.createdAt, first.at)] : [];
  });
  const conversations = leads.flatMap(l => {
    const first = l.outcomes.filter(o => o.result === 'spoke' && o.durationSeconds > 0).sort((a, b) => a.at - b.at)[0];
    return first ? [minutes(l.createdAt, first.at)] : [];
  });
  return {
    backlog: backlog.length,
    oldestEnquiryMinutes: backlog.length ? Math.max(...backlog.map(l => minutes(l.createdAt, at))) : null,
    callable: backlog.filter(l => canAttemptContact(l, settings, at).allowed).length,
    escalated: pending.filter(l => l.releaseCount >= settings.escalationPriorityAfterReleases).length,
    firstAttemptMinutes: average(attempts),
    firstAttemptSample: attempts.length,
    firstConversationMinutes: average(conversations),
    firstConversationSample: conversations.length,
    callbacks: callbacks.map(l => ({
      id: l.id, name: l.name, dueAt: l.callbackTime ?? l.callbackRequestedAt ?? at,
      overdue: (l.callbackTime ?? l.callbackRequestedAt ?? at) < at,
      contact: canAttemptContact(l, settings, at),
    })),
    workload: agents.map(a => ({
      id: a.id, name: a.name, available: a.available,
      held: pending.filter(l => l.stage === 'reserved' && l.reservedAgentId === a.id).length,
      owned: pending.filter(l => l.ownerAgentId === a.id).length,
      taken: a.usedToday, remaining: Math.max(0, a.dailyCap - a.usedToday),
      attempts: leads.reduce((n, l) => n + l.outcomes.filter(o => o.agentId === a.id).length, 0),
      conversations: leads.filter(l => l.outcomes.some(o => o.agentId === a.id && o.result === 'spoke' && o.durationSeconds > 0)).length,
    })),
  };
};