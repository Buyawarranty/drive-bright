export interface PresenceEvidence { started_at?: string; first_seen_at?: string }
export function firstCrmPresence(sessions: PresenceEvidence[], observations: PresenceEvidence[]) {
  const candidates = [
    ...sessions.map(row => ({ at: row.started_at, source: 'Detailed session' })),
    ...observations.map(row => ({ at: row.first_seen_at, source: 'CRM location observation' })),
  ].filter((item): item is { at: string; source: string } => Boolean(item.at && Number.isFinite(Date.parse(item.at))));
  return candidates.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0];
}