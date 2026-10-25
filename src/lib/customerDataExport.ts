import { supabase } from '@/integrations/supabase/client';
import { withTimeout } from '@/lib/withTimeout';
import { toast } from 'sonner';

/** Re-check the current server grant for every download; never trust local tab permissions. */
export async function requireCustomerDataExport(): Promise<boolean> {
  try {
    const { data, error } = await withTimeout(supabase.rpc('can_export_customer_data'), 8000, 'Export permission');
    if (!error && data === true) return true;
  } catch { /* permission failures fail closed */ }
  toast.error('Export files access is required. Ask an admin or super admin.');
  return false;
}