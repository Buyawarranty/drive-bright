import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/utils/supabaseBatchFetch';
import { collectedAnniversaryRevenue } from './bawPayLater';

/** Paid anniversaries retain the sale owner, never the accounts collector. */
export async function fetchPayLaterAnniversaries(start: Date, end: Date) {
  const { data, error } = await fetchAllRows(() => supabase
    .from('baw_paylater_schedules')
    .select('customer_id, year_number, amount, paid_amount, paid_at, status, customers!inner(id, assigned_to, payment_confirmed_by, quote_sent_by, sale_credit_admin_user_id, status, is_deleted)')
    .eq('status', 'paid').gt('year_number', 1)
    .eq('customers.is_deleted', false).ilike('customers.status', 'active')
    .gte('paid_at', start.toISOString()).lte('paid_at', end.toISOString())
    .order('paid_at').order('id'));
  if (error) throw error;
  return (data || []).map(row => ({ ...row, revenue: collectedAnniversaryRevenue(row) }));
}
