import { supabase } from '@/integrations/supabase/client';

export type LeadAccessAction = 'lead_open' | 'phone_copy';
/** Server trigger owns identity/time; RLS rechecks current lead access. */
export async function recordLeadAccess(leadId: string | null | undefined, action: LeadAccessAction, source: string) {
  if (!leadId || !/^[0-9a-f-]{36}$/i.test(leadId)) return;
  try {
    const { data: actor, error } = await supabase.rpc('current_admin_user_id');
    if (error || !actor) throw new Error('Staff identity unavailable');
    const result = await supabase.from('lead_access_events').insert({ lead_id: leadId, actor_id: actor, action, source });
    if (result.error) throw result.error;
  } catch {
    console.warn('Lead access history could not be saved');
  }
}