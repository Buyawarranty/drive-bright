import { supabase } from '@/integrations/supabase/client';

const keys = new Set(['view', 'status', 'period', 'from', 'to', 'assignment', 'sort', 'source', 'age', 'plan', 'payment', 'search_omitted']);
export function safeDepartureFilters(input: Record<string, unknown>): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (keys.has(key) && (typeof value === 'boolean' || (typeof value === 'string' && /^[a-zA-Z0-9_.: -]{0,60}$/.test(value)))) result[key] = value;
  }
  return result;
}
export function departureTime(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return 'Not recorded';
  return `${new Date(value).toLocaleString('en-GB', { timeZone: 'Europe/London' })} UK · ${new Date(value).toISOString()} UTC`;
}
/** Browser observations are context only, never an authority for ownership or identity. */
export function recordDepartureView(tab: string, filters: Record<string, unknown> = {}) {
  if (!/^[a-z0-9-]{1,60}$/.test(tab)) return;
  void supabase.functions.invoke('staff-crm-view', { body: { tab, filters: safeDepartureFilters(filters) } })
    .then(({ error }) => { if (error) console.warn('Last CRM view was not recorded'); })
    .catch(() => console.warn('Last CRM view was not recorded'));
}