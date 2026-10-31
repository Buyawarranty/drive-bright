/**
 * Open Round Robin practice — lead reference numbers and lead-type badges.
 *
 * Lead refs (BW-89421, BW-89422, …) are synthetic labels for practice leads
 * only, so a shared lead can be discussed while its customer details stay
 * hidden until claimed. Pure module: no Supabase, no network.
 */

export type OrrLeadType = 'overnight' | 'live' | 'callback';

const CALLBACK_STATUSES = new Set(['callback_booked', 'urgent_callback']);

/**
 * Badge for a lead: Callback if a callback is booked/urgent, Overnight if the
 * enquiry arrived outside staffed hours (before 9am or from 6pm), else Live.
 */
export const leadTypeOf = (createdAt: number, displayStatus: string): OrrLeadType => {
  if (CALLBACK_STATUSES.has(displayStatus)) return 'callback';
  const hour = new Date(createdAt).getHours();
  return hour < 9 || hour >= 18 ? 'overnight' : 'live';
};

export const LEAD_TYPE_LABELS: Record<OrrLeadType, string> = {
  overnight: 'Overnight',
  live: 'Live',
  callback: 'Callback',
};

let leadRefCounter = 89420;

/** Next synthetic lead reference, e.g. "BW-89421". Practice leads only. */
export const nextLeadRef = (): string => `BW-${(leadRefCounter += 1)}`;

/** Stable ref for a lead that predates refs (derived from its id). */
export const leadRefFor = (id: string, existing?: string | null): string => {
  if (existing) return existing;
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 90000;
  return `BW-${10000 + hash}`;
};
