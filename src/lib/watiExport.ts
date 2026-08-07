/**
 * WATI (WhatsApp) contact export helpers.
 *
 * WATI's bulk contact importer expects:
 *  - "WhatsApp Number" in full international format, digits only (no +, no spaces)
 *  - "Name" (display name shown in the WATI inbox)
 *  - Optional custom attributes as extra columns
 *
 * Rows without a valid mobile number are dropped — WATI rejects the whole file
 * if a number can't be resolved to a WhatsApp account.
 */

/** Normalise a UK-centric phone number to digits-only international format (e.g. 447700900123). */
export function toWatiNumber(raw?: string | null): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/[^\d]/g, '');
  if (!digits) return null;

  // 00 44 ... → 44 ...
  if (digits.startsWith('00')) digits = digits.slice(2);
  // 0 7700 900123 → 44 7700 900123
  if (digits.startsWith('0')) digits = `44${digits.slice(1)}`;
  // 7700900123 → 447700900123
  else if (digits.length === 10 && digits.startsWith('7')) digits = `44${digits}`;

  // Already international (44…, or any other country code)
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

export interface WatiLeadLike {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  lead_source?: string | null;
  vehicle_reg?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year?: string | number | null;
  plan_interest?: string | null;
  quote_amount?: number | string | null;
  created_at?: string | null;
  assigned_user?: { email?: string | null } | null;
}

export interface WatiRow {
  'WhatsApp Number': string;
  Name: string;
  'First Name': string;
  'Last Name': string;
  Email: string;
  'Vehicle Reg': string;
  Vehicle: string;
  'Plan Interest': string;
  'Quote Amount': string;
  'Lead Status': string;
  'Lead Source': string;
  'Assigned Agent': string;
  'Enquiry Date': string;
}

/** Build WATI-ready rows, de-duplicated by WhatsApp number. */
export function buildWatiRows(leads: WatiLeadLike[], options: { includeSource?: boolean } = {}): WatiRow[] {
  const seen = new Set<string>();
  const rows: WatiRow[] = [];

  for (const lead of leads) {
    const number = toWatiNumber(lead.phone);
    if (!number || seen.has(number)) continue;
    seen.add(number);

    const first = (lead.first_name || '').trim();
    const last = (lead.last_name || '').trim();
    const name = [first, last].filter(Boolean).join(' ') || 'Customer';

    rows.push({
      'WhatsApp Number': number,
      Name: name,
      'First Name': first || name,
      'Last Name': last,
      Email: lead.email || '',
      'Vehicle Reg': (lead.vehicle_reg || '').toUpperCase(),
      Vehicle: [lead.vehicle_make, lead.vehicle_model, lead.vehicle_year].filter(Boolean).join(' '),
      'Plan Interest': lead.plan_interest || '',
      'Quote Amount': lead.quote_amount != null && lead.quote_amount !== '' ? String(lead.quote_amount) : '',
      'Lead Status': lead.status || '',
      'Lead Source': options.includeSource === false ? '' : lead.lead_source || '',
      'Assigned Agent': lead.assigned_user?.email || '',
      'Enquiry Date': lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-GB') : '',
    });
  }

  return rows;
}
