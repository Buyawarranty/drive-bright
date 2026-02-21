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
 * Check if an active, paid warranty already exists for the same reg plate AND email.
 * This prevents sales agents from accidentally confirming a duplicate payment
 * when the customer has already paid via website (Stripe/Bumper).
 * 
 * Rules:
 * - Same reg plate + same email = blocked (duplicate)
 * - Same email + different reg plate = allowed (second car)
 * - Different email + same reg plate = allowed (different owner)
 */
export async function checkDuplicateWarranty(
  registrationPlate: string,
  email: string
): Promise<DuplicateWarrantyResult> {
  if (!registrationPlate || !email) {
    return { isDuplicate: false };
  }

  const normalizedReg = registrationPlate.toUpperCase().replace(/\s/g, '');
  const normalizedEmail = email.toLowerCase().trim();

  // Check for active, non-deleted customers with matching reg AND email
  const { data: existing } = await supabase
    .from('customers')
    .select('id, name, email, registration_plate, warranty_reference_number, warranty_number, plan_type, status, signup_date, final_amount, purchase_source')
    .ilike('email', normalizedEmail)
    .or('is_deleted.is.null,is_deleted.eq.false')
    .in('status', ['Active', 'Pending'])
    .not('payment_verified', 'is', null);

  if (!existing || existing.length === 0) {
    return { isDuplicate: false };
  }

  // Check if any of the existing records match the same reg plate
  const matchingRecord = existing.find(record => {
    const existingReg = (record.registration_plate || '').toUpperCase().replace(/\s/g, '');
    return existingReg === normalizedReg;
  });

  if (matchingRecord) {
    return {
      isDuplicate: true,
      existingRecord: matchingRecord,
    };
  }

  return { isDuplicate: false };
}
