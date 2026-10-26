import { supabase } from '@/integrations/supabase/client';
import { withTimeout } from '@/lib/withTimeout';
import { toast } from 'sonner';

async function checkRpc(fn: 'can_export_customer_data' | 'can_export_new_leads' | 'can_export_customers'): Promise<boolean> {
  try {
    const { data, error } = await withTimeout(supabase.rpc(fn), 8000, 'Export permission');
    return !error && data === true;
  } catch {
    return false; // permission failures fail closed
  }
}

/** Re-check the current server grant for every download; never trust local tab permissions. */
export async function requireCustomerDataExport(): Promise<boolean> {
  if (await checkRpc('can_export_customer_data')) return true;
  toast.error('Export files access is required. Ask an admin or super admin.');
  return false;
}

/** New Leads / Recontact Leads exports need the dedicated new-leads export grant. */
export async function requireNewLeadsExport(): Promise<boolean> {
  if (await checkRpc('can_export_new_leads')) return true;
  toast.error('New leads export access is required. Ask an admin or super admin.');
  return false;
}

/** Customer Management exports need the dedicated customer export grant. */
export async function requireCustomersExport(): Promise<boolean> {
  if (await checkRpc('can_export_customers')) return true;
  toast.error('Customer management export access is required. Ask an admin or super admin.');
  return false;
}
