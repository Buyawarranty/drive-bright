// Shared guard: never send "complete your purchase" marketing to someone who
// has already bought. Used by abandoned-cart chasers and staff bulk reminders.

const norm = (v?: string | null) => (v || '').trim().toLowerCase();
const plateVariants = (reg?: string | null): string[] => {
  const raw = (reg || '').trim().toUpperCase();
  if (!raw) return [];
  const bare = raw.replace(/\s+/g, '');
  const spaced = bare.length > 3 ? `${bare.slice(0, bare.length - 3)} ${bare.slice(-3)}` : bare;
  return Array.from(new Set([raw, bare, spaced]));
};

/**
 * Returns the set of already-purchased emails (lowercased) out of the given list.
 * A purchase = a customer record or a policy record exists for that email.
 */
export async function getPurchasedEmails(
  supabase: any,
  emails: string[],
): Promise<Set<string>> {
  const list = Array.from(new Set(emails.map(norm).filter(Boolean)));
  const purchased = new Set<string>();
  if (list.length === 0) return purchased;

  // Chunk to keep the IN() lists sane
  const chunkSize = 200;
  for (let i = 0; i < list.length; i += chunkSize) {
    const chunk = list.slice(i, i + chunkSize);

    const [{ data: custRows }, { data: policyRows }] = await Promise.all([
      supabase.from('customers').select('email').in('email', chunk),
      supabase.from('customer_policies').select('email').in('email', chunk),
    ]);

    (custRows || []).forEach((r: any) => purchased.add(norm(r.email)));
    (policyRows || []).forEach((r: any) => purchased.add(norm(r.email)));
  }

  // Also catch case/whitespace variants that were stored differently
  if (purchased.size < list.length) {
    for (let i = 0; i < list.length; i += chunkSize) {
      const chunk = list.slice(i, i + chunkSize).filter(e => !purchased.has(e));
      if (chunk.length === 0) continue;
      const ors = chunk.map(e => `email.ilike.${e}`).join(',');
      const [{ data: c2 }, { data: p2 }] = await Promise.all([
        supabase.from('customers').select('email').or(ors),
        supabase.from('customer_policies').select('email').or(ors),
      ]);
      (c2 || []).forEach((r: any) => purchased.add(norm(r.email)));
      (p2 || []).forEach((r: any) => purchased.add(norm(r.email)));
    }
  }

  return purchased;
}

/**
 * Single-recipient check. Matches on email, and on registration plate when
 * supplied (same person, different address).
 */
export async function hasPurchased(
  supabase: any,
  email?: string | null,
  vehicleReg?: string | null,
): Promise<boolean> {
  const e = norm(email);
  if (e) {
    const found = await getPurchasedEmails(supabase, [e]);
    if (found.has(e)) return true;
  }

  const plates = plateVariants(vehicleReg);
  if (plates.length > 0) {
    const { data } = await supabase
      .from('customers')
      .select('id')
      .in('registration_plate', plates)
      .limit(1);
    if (data && data.length > 0) return true;
  }

  return false;
}
