import { supabase } from '@/integrations/supabase/client';

export interface DuplicateWarrantyResult {
  isDuplicate: boolean;
  existingRecord?: {
    id: string;
    name: string;
    email: string;
    registration_plate: string;
    warranty_reference_number: string | null;
    warranty_number: string | null;
    plan_type: string;
    status: string;
    signup_date: string;
    final_amount: number | null;
    purchase_source: string | null;
  };
}

/**
 * Check if an active, paid warranty already exists for the same registration plate.
 *
 * Rules:
 * - Same reg plate + currently-active/pending warranty = blocked (vehicle already covered)
 * - Same reg plate + only cancelled/refunded/expired warranties = allowed (free to repurchase)
 * - Same email reused on a different reg plate = always allowed (multi-vehicle households)
 *
 * Email is intentionally NOT part of the duplicate check — one email may legitimately
 * insure multiple vehicles, but a single vehicle should never have two live policies.
 */
export const TEST_BYPASS_EMAILS = new Set<string>([
  '1fairdeal@gmail.com',
  'kqureshi414@gmail.com',
  'prajwalchauhan2001@gmail.com',
]);

export async function checkDuplicateWarranty(
  registrationPlate: string,
  _email?: string
): Promise<DuplicateWarrantyResult> {
  if (!registrationPlate) {
    return { isDuplicate: false };
  }

  // Testing whitelist — allow these emails to repurchase without duplicate block.
  if (_email && TEST_BYPASS_EMAILS.has(_email.trim().toLowerCase())) {
    return { isDuplicate: false };
  }



  const normalizedReg = registrationPlate.toUpperCase().replace(/\s/g, '');

  // Fetch any non-deleted, paid customer rows that match the reg plate and are
  // currently in an Active or Pending state. Cancelled / refunded / expired
  // customers must NOT block a repurchase.
  const { data: existing } = await supabase
    .from('customers')
    .select('id, name, email, registration_plate, warranty_reference_number, warranty_number, plan_type, status, signup_date, final_amount, purchase_source')
    .or('is_deleted.is.null,is_deleted.eq.false')
    .in('status', ['Active', 'Pending'])
    .not('payment_verified', 'is', null);

  if (!existing || existing.length === 0) {
    return { isDuplicate: false };
  }

  const candidates = existing.filter(record => {
    const existingReg = (record.registration_plate || '').toUpperCase().replace(/\s/g, '');
    return existingReg === normalizedReg;
  });

  if (candidates.length === 0) {
    return { isDuplicate: false };
  }

  // Verify each candidate has a currently-active policy. If their latest
  // policy is cancelled/refunded/expired, allow the repurchase.
  for (const candidate of candidates) {
    const { data: policies } = await supabase
      .from('customer_policies')
      .select('status, policy_end_date')
      .eq('customer_id', candidate.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const latest = policies?.[0];
    const latestStatus = (latest?.status || '').toLowerCase();
    const isTerminated = ['cancelled', 'canceled', 'refunded', 'expired', 'void'].includes(latestStatus);

    // Also treat policies whose end date has passed as expired
    const endDate = latest?.policy_end_date ? new Date(latest.policy_end_date) : null;
    const isPastEndDate = endDate ? endDate.getTime() < Date.now() : false;

    if (latest && !isTerminated && !isPastEndDate) {
      return { isDuplicate: true, existingRecord: candidate };
    }
  }

  return { isDuplicate: false };
}
