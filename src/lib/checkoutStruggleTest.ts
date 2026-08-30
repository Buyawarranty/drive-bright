/**
 * Shared test/sandbox detection for checkout struggle alerts.
 * Keeps the red banner and the Live Leads panel in perfect agreement so staff
 * never see internal test traffic as a "live customer stuck on checkout".
 */
export interface StruggleLike {
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  vehicle_reg?: string | null;
}

// Plates only ever used in demos, docs and placeholders.
const TEST_REGS = new Set(['AB12CDE', 'B11CSD', 'TEST123']);

const JUNK_EMAIL = /(^|@)(1|test|na|blank)\.|mailinator\.com|@1\.com|@test\.com|@example\.com|@fake\.com|yopmail|guerrillamail|dispostable|trashmail/i;

export const isTestStruggle = (r: StruggleLike): boolean => {
  const name = (r.customer_name || '').toLowerCase().trim();
  const email = (r.customer_email || '').toLowerCase().trim();
  const rawPhone = (r.customer_phone || '').trim();
  const digits = rawPhone.replace(/\D/g, '');
  const reg = (r.vehicle_reg || '').replace(/\s/g, '').toUpperCase();

  if (reg && TEST_REGS.has(reg)) return true;
  if (/\btest\b|^test|dummy|sandbox|demo|asdf|qwerty/.test(name)) return true;
  if (email.endsWith('@buyawarranty.co.uk')) return true;
  if (email && JUNK_EMAIL.test(email)) return true;

  if (digits) {
    // Not a UK number → we never call it, so it is test data.
    const isUK = digits.startsWith('44') || digits.startsWith('0');
    if (!isUK || rawPhone.startsWith('+1')) return true;
    // Repeated-digit dummies: 0790000000, 07111111111, +44 7000 000000 …
    const tail = digits.replace(/^44/, '').replace(/^0/, '');
    if (/^(\d)\1+$/.test(tail.slice(1))) return true;
    if (digits.length < 10) return true;
  }

  return false;
};
