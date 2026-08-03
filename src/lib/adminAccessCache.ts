/**
 * Last-known admin access cache.
 *
 * Purpose: graceful partial load. On a reload we can render the CRM shell
 * immediately from the last verified role/permissions instead of showing a
 * spinner while the network round-trip completes. The server check still runs
 * in the background and reconciles (or kicks the user out) straight after.
 *
 * SECURITY: this is a UI-latency optimisation only. It never grants data
 * access — every read/write is still enforced by Supabase RLS server-side.
 */

const KEY = 'baw_admin_access_cache_v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface CachedAdminAccess {
  userId: string;
  role: string;
  permissions: Record<string, boolean> | null;
  adminUserId: string | null;
  ts: number;
}

export function readAdminAccessCache(userId: string | null | undefined): CachedAdminAccess | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAdminAccess;
    if (!parsed?.userId || parsed.userId !== userId) return null;
    if (!parsed.role) return null;
    if (!parsed.ts || Date.now() - parsed.ts > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeAdminAccessCache(entry: Omit<CachedAdminAccess, 'ts'>): void {
  try {
    if (!entry?.userId || !entry?.role) return;
    localStorage.setItem(KEY, JSON.stringify({ ...entry, ts: Date.now() }));
  } catch {
    /* storage full / disabled — cache is optional */
  }
}

export function clearAdminAccessCache(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
