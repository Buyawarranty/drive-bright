/**
 * Shared reminder lookup for lead rows.
 *
 * Every row in New Leads renders a "Remind me" button, and each one used to run
 * its OWN two reads: one `admin_users` lookup to find the agent, then one
 * `lead_reminders` read for that single lead. A 50-row page therefore fired
 * ~100 requests in the same tick, which is exactly the signature we saw in the
 * slow-load telemetry (six-plus identical `lead_reminders` reads all finishing
 * 13-30s late while the page sat on a spinner).
 *
 * The agent's pending reminders are a tiny list, so we fetch them ONCE per page
 * and let every row read its own row out of the shared map.
 */

import { supabase } from '@/integrations/supabase/client';

const TTL_MS = 20_000;

let adminIdPromise: Promise<string | null> | null = null;

/** Current admin_users.id, resolved once per tab. */
export async function getCachedAdminUserId(): Promise<string | null> {
  if (!adminIdPromise) {
    adminIdPromise = (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', userData.user.id)
        .maybeSingle();
      return data?.id ?? null;
    })().catch(() => null);
  }
  return adminIdPromise;
}

export function clearCachedAdminUserId() {
  adminIdPromise = null;
}

type ReminderRow = { id: string; lead_id: string; [key: string]: any };

let cache: { userId: string; at: number; byLead: Map<string, ReminderRow> } | null = null;
let inflight: Promise<Map<string, ReminderRow>> | null = null;

/** All of this agent's pending/snoozed reminders, keyed by lead_id. */
export async function getMyPendingReminders(
  force = false,
): Promise<Map<string, ReminderRow>> {
  const userId = await getCachedAdminUserId();
  if (!userId) return new Map();

  if (
    !force &&
    cache &&
    cache.userId === userId &&
    Date.now() - cache.at < TTL_MS
  ) {
    return cache.byLead;
  }

  if (!force && inflight) return inflight;

  inflight = (async () => {
    const { data } = await (supabase
      .from('lead_reminders' as any)
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'snoozed']) as any);

    const byLead = new Map<string, ReminderRow>();
    ((data ?? []) as ReminderRow[]).forEach((row) => {
      if (row?.lead_id && !byLead.has(row.lead_id)) byLead.set(row.lead_id, row);
    });
    cache = { userId, at: Date.now(), byLead };
    return byLead;
  })()
    .catch(() => cache?.byLead ?? new Map<string, ReminderRow>())
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Call after creating, snoozing, completing or deleting a reminder. */
export function invalidateReminderCache() {
  cache = null;
}
