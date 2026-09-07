import { supabase } from '@/integrations/supabase/client';

/**
 * On/off history for staff logins.
 *
 * Every change to admin_users.is_active is already recorded by a database trigger
 * into admin_user_access_periods (start_date / started_by, end_date / ended_by).
 * These helpers stamp the screen the change was made from and read the history
 * back with the actor's name resolved.
 */

export type AccessChangeSource =
  | 'Staff list (User permissions)'
  | 'Agents on/off (Lead teams)'
  | 'Offboarding panel'
  | 'Temporary logins panel'
  | 'Restored from archive (User permissions)';

export type AccessEvent = {
  id: string;
  at: string;
  turnedOn: boolean;
  byName: string;
  reason: string | null;
};

/** Add "· via <screen>" to the period row the trigger just wrote. */
export async function tagAccessChange(
  adminUserId: string,
  turnedOn: boolean,
  source: AccessChangeSource,
): Promise<void> {
  try {
    const table = supabase.from('admin_user_access_periods') as any;
    if (turnedOn) {
      const { data } = await table
        .select('id, reason')
        .eq('admin_user_id', adminUserId)
        .is('end_date', null)
        .order('start_date', { ascending: false })
        .limit(1);
      const row = data?.[0];
      if (row) {
        await table
          .update({ reason: `${row.reason || 'Reactivated'} · via ${source}` })
          .eq('id', row.id);
      }
    } else {
      const { data } = await table
        .select('id, reason')
        .eq('admin_user_id', adminUserId)
        .not('end_date', 'is', null)
        .order('end_date', { ascending: false })
        .limit(1);
      const row = data?.[0];
      if (row) {
        await table
          .update({ reason: `${row.reason || 'Deactivated'} · via ${source}` })
          .eq('id', row.id);
      }
    }
  } catch {
    /* history stamping must never block the switch itself */
  }
}

const nameFor = (
  actorId: string | null,
  people: Map<string, { first_name: string | null; last_name: string | null; email: string }>,
): string => {
  if (!actorId) return 'Unknown (no signed-in user recorded)';
  const p = people.get(actorId);
  if (!p) return 'Unknown account';
  const full = `${p.first_name || ''} ${p.last_name || ''}`.trim();
  return full ? `${full} (${p.email})` : p.email;
};

/** Read the on/off history for one staff member, newest first. */
export async function fetchAccessHistory(adminUserId: string): Promise<AccessEvent[]> {
  const { data, error } = await (supabase.from('admin_user_access_periods') as any)
    .select('id, start_date, started_by, end_date, ended_by, reason')
    .eq('admin_user_id', adminUserId)
    .order('start_date', { ascending: false })
    .limit(100);
  if (error || !data) return [];

  const actorIds = Array.from(
    new Set(
      data.flatMap((r: any) => [r.started_by, r.ended_by]).filter(Boolean) as string[],
    ),
  );

  const people = new Map<string, { first_name: string | null; last_name: string | null; email: string }>();
  if (actorIds.length > 0) {
    const { data: staff } = await (supabase.from('admin_users') as any)
      .select('user_id, email, first_name, last_name')
      .in('user_id', actorIds);
    (staff || []).forEach((s: any) => {
      if (s.user_id) people.set(s.user_id, { first_name: s.first_name, last_name: s.last_name, email: s.email });
    });
  }

  const events: AccessEvent[] = [];
  data.forEach((r: any) => {
    events.push({
      id: `${r.id}-on`,
      at: r.start_date,
      turnedOn: true,
      byName: nameFor(r.started_by, people),
      reason: r.reason,
    });
    if (r.end_date) {
      events.push({
        id: `${r.id}-off`,
        at: r.end_date,
        turnedOn: false,
        byName: nameFor(r.ended_by, people),
        reason: r.reason,
      });
    }
  });

  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export const formatLondon = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
