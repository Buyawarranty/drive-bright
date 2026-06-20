import { useCallback, useEffect, useState } from 'react';

/**
 * Cross-component team filter (Red/Blue/Green).
 * Persists to localStorage and broadcasts changes via a custom event so
 * the sidebar switcher and lead tabs stay in sync without prop drilling.
 */
const STORAGE_KEY = 'admin.teamFilter';
const EVENT = 'admin-team-filter-change';

const read = (): string | null => {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v && v !== 'null' ? v : null;
};

export function useGlobalTeamFilter(): [string | null, (id: string | null) => void] {
  const [teamId, setTeamId] = useState<string | null>(read);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string | null>).detail;
      setTeamId(detail ?? null);
    };
    const storage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setTeamId(e.newValue && e.newValue !== 'null' ? e.newValue : null);
    };
    window.addEventListener(EVENT, handler as EventListener);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener(EVENT, handler as EventListener);
      window.removeEventListener('storage', storage);
    };
  }, []);

  const update = useCallback((id: string | null) => {
    if (typeof window === 'undefined') return;
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
  }, []);

  return [teamId, update];
}
