/**
 * Open Round Robin practice — lead reference and lead-type badges.
 *
 * A lead's reference is the vehicle registration that arrives with it, so a
 * shared lead can be discussed while its customer details stay hidden until
 * claimed. Practice leads are synthetic, so they are given made-up plates in the
 * normal UK format. Pure module: no Supabase, no network.
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

/** UK plate letters — the DVLA alphabet excludes I and Q. */
const PLATE_LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ';

let plateCounter = 0;

/** Next synthetic registration plate for a practice lead, e.g. "BW24 AAB". */
export const nextPracticeReg = (): string => {
  plateCounter += 1;
  const at = (n: number) => PLATE_LETTERS[n % PLATE_LETTERS.length];
  const suffix =
    at(Math.floor(plateCounter / (PLATE_LETTERS.length * PLATE_LETTERS.length))) +
    at(Math.floor(plateCounter / PLATE_LETTERS.length)) +
    at(plateCounter);
  return `BW24 ${suffix}`;
};

/** The lead reference is the registration plate that comes with the lead. */
export const leadRefFor = (vehicleReg?: string | null): string => (vehicleReg ?? '').trim().toUpperCase();

