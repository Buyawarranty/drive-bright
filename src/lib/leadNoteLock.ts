import { supabase } from '@/integrations/supabase/client';

/**
 * Note lock — the rule for reassigning leads when an agent goes on annual
 * leave / holiday.
 *
 * Leads move freely even if they have been called or had their status changed:
 * those are routine, automatically logged events. But the moment an agent has
 * written a real note on the lead (a conversation, a promise, a callback
 * arrangement), the lead is "note locked": a manager must double-check with
 * that agent and explicitly authorise the move before it can be reassigned.
 *
 * Auto-generated quick notes (system arrival stamps, "Status changed: …",
 * call-attempt logs) are NOT agent notes and never lock a lead.
 */

const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

const AUTO_NOTE_PATTERNS: RegExp[] = [
  /🤖\s*System/i,
  /^\s*\[?[^\]]*\]?\s*Lead arrived at/i,
  /clock started/i,
  /^\s*Status changed:/i,
  /^\s*Call (attempt|logged|made|outcome)/i,
  /^\s*Dial\s*9\b/i,
  /^\s*Call count (adjusted|updated)/i,
  /^\s*Assigned to /i,
  /^\s*Reassigned (to|from) /i,
  /^\s*Ownership /i,
  /^\s*Arrival timestamp/i,
];

/** True when the note text was written by the system, not by an agent. */
export function isAutomatedLeadNote(text?: string | null, createdBy?: string | null): boolean {
  if (createdBy && createdBy === SYSTEM_ACTOR_ID) return true;
  const t = String(text ?? '').trim();
  if (!t) return true;
  return AUTO_NOTE_PATTERNS.some((re) => re.test(t));
}

/** True when the free-text `sales_leads.notes` column holds a real agent note. */
export function hasAgentWrittenNotesField(notes?: string | null): boolean {
  const t = String(notes ?? '').trim();
  if (!t) return false;
  return !isAutomatedLeadNote(t);
}

/**
 * Given a set of lead ids, returns the subset that is note locked — i.e. an
 * agent has written at least one real note on them.
 */
export async function fetchNoteLockedLeadIds(leadIds: string[]): Promise<Set<string>> {
  const locked = new Set<string>();
  const ids = Array.from(new Set(leadIds.filter(Boolean)));
  if (ids.length === 0) return locked;

  for (let i = 0; i < ids.length; i += 400) {
    const slice = ids.slice(i, i + 400);

    const [{ data: leadRows }, { data: noteRows }] = await Promise.all([
      supabase.from('sales_leads').select('id, notes').in('id', slice),
      supabase.from('lead_quick_notes').select('lead_id, note_text, created_by').in('lead_id', slice),
    ]);

    (leadRows ?? []).forEach((r: any) => {
      if (hasAgentWrittenNotesField(r.notes)) locked.add(r.id as string);
    });
    (noteRows ?? []).forEach((n: any) => {
      if (!isAutomatedLeadNote(n.note_text, n.created_by)) locked.add(n.lead_id as string);
    });
  }

  return locked;
}

/**
 * Splits lead ids into the ones a manager may move on their own and the ones
 * that need the agent's sign-off first.
 */
export async function splitByNoteLock(leadIds: string[]) {
  const locked = await fetchNoteLockedLeadIds(leadIds);
  return {
    movable: leadIds.filter((id) => !locked.has(id)),
    noteLocked: leadIds.filter((id) => locked.has(id)),
  };
}

export const NOTE_LOCK_EXPLAINER =
  'Leads with an agent-written note need the agent checked with first — calls and status changes on their own do not block a move.';
