import { useEffect, useState } from 'react';

/**
 * Remembers a sandbox panel's variable settings on this machine, so reopening
 * the Price updates tab shows exactly the figures that were left set.
 * These are DRAFT figures only — customers and agents are unaffected until the
 * model is pushed live.
 */
export function useStickyCfg<T extends Record<string, any>>(
  key: string,
  defaults: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const storageKey = `pricing_panel_cfg_${key}`;

  const [cfg, setCfg] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? { ...defaults, ...parsed } : defaults;
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cfg));
    } catch {
      /* private browsing — settings simply will not persist */
    }
  }, [storageKey, cfg]);

  return [cfg, setCfg];
}
