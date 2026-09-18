import { supabase } from '@/integrations/supabase/client';

export interface CachedWatiTemplate {
  name: string;
  language: string;
  status: string;
  body: string;
}

const CACHE_KEY = 'wati-template-list-v1';
const CACHE_TTL_MS = 10 * 60 * 1000;

let memoryCache: CachedWatiTemplate[] | null = null;
let pendingRequest: Promise<CachedWatiTemplate[]> | null = null;

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

  pendingRequest = (async () => {
    const { data, error } = await supabase.functions.invoke('wati-templates', { body: {} });
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
    return templates;
  })().finally(() => {
    pendingRequest = null;
  });

  return pendingRequest;
};

export const warmWatiTemplateCache = () => {
  void getCachedWatiTemplates().catch(() => undefined);
};