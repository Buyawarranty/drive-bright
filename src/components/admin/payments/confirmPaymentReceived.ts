import { supabase } from '@/integrations/supabase/client';

/**
 * Shared "payment received" step: verifies the payment on the customer record,
 * makes the sale Active (so it counts on the agent's scoreboard and in customer
 * management), activates the latest policy (customer login dashboard) and logs a note.
 * signup_date is left untouched so the sale stays credited to the day it was made.
 */
export async function confirmCustomerPaymentReceived(
  customerId: string,
  opts: { source?: string | null; ref?: string | null; note?: string | null; adminId?: string | null } = {},
) {
  const now = new Date().toISOString();
  const { data: cust } = await supabase.from('customers').select('status').eq('id', customerId).maybeSingle();
  const wasPending = /pending/i.test(String((cust as any)?.status || ''));

  const update: Record<string, any> = {
    payment_verification_status: 'verified',
    payment_verified: true,
    payment_verified_at: now,
    payment_verified_by: opts.adminId ?? null,
    payment_verification_source: opts.source ?? null,
    payment_verification_ref: opts.ref ?? null,
    payment_verification_note: opts.note ?? null,
  };
  if (wasPending || !cust || !(cust as any).status) update.status = 'Active';

  const { error } = await supabase.from('customers').update(update as any).eq('id', customerId);
  if (error) throw error;

  const { data: policy } = await supabase
    .from('customer_policies')
    .select('id, status')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (policy?.id) {
    const ps = String((policy as any).status || '').toLowerCase();
    await supabase
      .from('customer_policies')
      .update({
        payment_verified: true,
        ...(ps.includes('pending') || !ps ? { status: 'active' } : {}),
        updated_at: now,
      } as any)
      .eq('id', policy.id);
  }

  await supabase.from('admin_notes').insert({
    customer_id: customerId,
    note: `✅ Payment confirmed received${opts.source ? ` via ${opts.source}` : ''}${opts.ref ? ` (${opts.ref})` : ''}${opts.note ? `\n${opts.note}` : ''}`,
    created_by: opts.adminId ?? null,
  } as any);
}

export async function markCustomerCancelled(customerId: string, reason: string, adminId?: string | null) {
  const { error } = await supabase
    .from('customers')
    .update({ status: 'Cancelled', payment_verification_note: reason } as any)
    .eq('id', customerId);
  if (error) throw error;
  await supabase.from('admin_notes').insert({
    customer_id: customerId,
    note: `🚫 Customer cancelled — payment not collected.\nReason: ${reason}`,
    created_by: adminId ?? null,
  } as any);
}
