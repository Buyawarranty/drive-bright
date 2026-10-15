import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/** Declines or deletes applicants; each one gets the polite rejection email first. */
export async function rejectApplicants(ids: string[], action: 'reject' | 'delete') {
  const { data, error } = await supabase.functions.invoke('career-reject-applicants', {
    body: { ids, action },
  });
  if (error || data?.error) {
    toast.error(typeof data?.error === 'string' ? data.error : error?.message || 'Could not complete');
    return false;
  }
  const verb = action === 'delete' ? 'deleted' : 'declined';
  toast.success(`${data.done} applicant${data.done === 1 ? '' : 's'} ${verb} · ${data.emailed} rejection email${data.emailed === 1 ? '' : 's'} sent`);
  if (data.failed?.length) toast.error(`Not completed (email failed): ${data.failed.join(', ')}`);
  return true;
}
