import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const KEY_PREFIX = 'admin-tab-usage:';
const EVENT = 'admin-tab-usage-change';

// Tabs that don't make sense as "shortcuts" — never suggest them.
const EXCLUDED = new Set<string>(['account', 'unsubscribe']);

export interface TabUsageEntry {
  id: string;
  count: number;
  lastVisited: number;
}

const storageKey = (userId: string | null | undefined) =>
  `${KEY_PREFIX}${userId || 'anon'}`;

const readMap = (userId: string | null | undefined): Record<string, TabUsageEntry> => {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
};

const writeMap = (userId: string | null | undefined, map: Record<string, TabUsageEntry>) => {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(map));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
};

export const recordTabVisit = (userId: string | null | undefined, tabId: string) => {
  if (!tabId || EXCLUDED.has(tabId)) return;
  const map = readMap(userId);
  const existing = map[tabId];
  map[tabId] = {
    id: tabId,
    count: (existing?.count || 0) + 1,
    lastVisited: Date.now(),
  };
  writeMap(userId, map);
};

/**
 * Returns the top-N most visited tab ids for the given user, ordered by
 * visit count (desc), then most recent visit. Updates live when other parts
 * of the app record a visit.
 */
export const useTopTabs = (userId: string | null | undefined, limit = 5): string[] => {
  const [entries, setEntries] = useState<TabUsageEntry[]>(() =>
    Object.values(readMap(userId))
  );

  useEffect(() => {
    setEntries(Object.values(readMap(userId)));
    const onChange = () => setEntries(Object.values(readMap(userId)));
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [userId]);

  return entries
    .slice()
    .sort((a, b) => b.count - a.count || b.lastVisited - a.lastVisited)
    .slice(0, limit)
    .map((e) => e.id);
};

export const clearTabUsage = (userId: string | null | undefined) => {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
};

/* ------------------------------------------------------------------ *
 * Custom (pinned) shortcuts — user-chosen tabs that replace the
 * automatic most-visited list when set.
 * ------------------------------------------------------------------ */

const PINNED_PREFIX = 'admin-tab-pinned:';

const pinnedKey = (userId: string | null | undefined) =>
  `${PINNED_PREFIX}${userId || 'anon'}`;

export const readPinnedTabs = (userId: string | null | undefined): string[] => {
  try {
    const raw = localStorage.getItem(pinnedKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

export const writePinnedTabs = (userId: string | null | undefined, ids: string[]) => {
  try {
    if (ids.length === 0) localStorage.removeItem(pinnedKey(userId));
    else localStorage.setItem(pinnedKey(userId), JSON.stringify(ids));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
  // Persist to the account so pins survive browser/device changes.
  if (userId) {
    void supabase.rpc('save_pinned_shortcuts', { ids }).then(({ error }) => {
      if (error) console.warn('Failed to save pinned shortcuts:', error.message);
    });
  }
};

/** Live list of the user's pinned shortcut tab ids (empty = use automatic). */
export const usePinnedTabs = (userId: string | null | undefined): string[] => {
  const [ids, setIds] = useState<string[]>(() => readPinnedTabs(userId));

  useEffect(() => {
    setIds(readPinnedTabs(userId));
    const onChange = () => setIds(readPinnedTabs(userId));
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [userId]);

  // Sync with the account-stored pins: server wins when it has pins;
  // otherwise push any local pins up so existing users keep theirs.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void supabase.rpc('get_pinned_shortcuts').then(({ data, error }) => {
      if (cancelled || error || !Array.isArray(data)) return;
      const serverIds = (data as unknown[]).filter((id): id is string => typeof id === 'string');
      const localIds = readPinnedTabs(userId);
      if (serverIds.length > 0) {
        if (JSON.stringify(serverIds) !== JSON.stringify(localIds)) {
          try {
            localStorage.setItem(pinnedKey(userId), JSON.stringify(serverIds));
          } catch {
            /* ignore */
          }
          window.dispatchEvent(new Event(EVENT));
        }
      } else if (localIds.length > 0) {
        void supabase.rpc('save_pinned_shortcuts', { ids: localIds });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return ids;
};

