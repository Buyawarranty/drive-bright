import { supabase } from '@/integrations/supabase/client';

export interface CachedWatiTemplate {
  name: string;
  language: string;
  status: string;
  body: string;
}

const CACHE_KEY = 'wati-template-list-v1';
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;
/**
 * The WhatsApp button sits on every lead row, and it warms this cache on
 * hover/focus. If the function call is failing (WATI not configured,
 * unreachable, etc.) a mouse simply moving down a 40+ row leads table used
 * to fire a brand new request per row, hammering the edge function and
 * piling up sockets on the tab. One failure now buys a quiet period before
 * the next hover is allowed to retry.
 */
const FAILURE_COOLDOWN_MS = 20_000;

let memoryCache: CachedWatiTemplate[] | null = null;
let pendingRequest: Promise<CachedWatiTemplate[]> | null = null;
let lastError: Error | null = null;
let lastFailureAt = 0;

const readSessionCache = (): CachedWatiTemplate[] | null => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; templates?: CachedWatiTemplate[] };
    if (!parsed.savedAt || Date.now() - parsed.savedAt > CACHE_TTL_MS || !Array.isArray(parsed.templates)) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.templates;
  } catch {
    return null;
  }
};

const saveSessionCache = (templates: CachedWatiTemplate[]) => {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), templates }));
  } catch {
    // The in-memory cache still removes repeated requests when storage is unavailable.
  }
};

export const getCachedWatiTemplates = async (): Promise<CachedWatiTemplate[]> => {
  if (memoryCache?.length) return memoryCache;

  const stored = readSessionCache();
  if (stored?.length) {
    memoryCache = stored;
    return stored;
  }

  if (pendingRequest) return pendingRequest;

  if (lastError && Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS) {
    throw lastError;
  }

  pendingRequest = (async () => {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('WhatsApp templates timed out')), REQUEST_TIMEOUT_MS);
    });

    const { data, error } = await Promise.race([
      supabase.functions.invoke('wati-templates', { body: {} }),
      timeout,
    ]);
    if (error || !data?.ok || !Array.isArray(data.templates) || data.templates.length === 0) {
      throw new Error('WhatsApp templates could not be loaded');
    }

    const all = data.templates as CachedWatiTemplate[];
    const approved = all.filter((template) =>
      template.status === 'APPROVED' || template.status === 'UNKNOWN'
    );
    const templates = approved.length ? approved : all;
    memoryCache = templates;
    saveSessionCache(templates);
    lastError = null;
    return templates;
  })()
    .catch((err) => {
      lastError = err instanceof Error ? err : new Error(String(err));
      lastFailureAt = Date.now();
      throw lastError;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
};

export const warmWatiTemplateCache = () => {
  void getCachedWatiTemplates().catch(() => undefined);
};