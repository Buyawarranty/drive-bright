/**
 * Open Round Robin — uncontacted lead release schedule (practice only).
 *
 * Rule agreed by management on 31 October 2026, replacing the hourly,
 * two-hourly and twice-daily chase schedules:
 *  - fixed release times each day in Europe/London time (default 09:00,
 *    12:00, 14:30, 17:00) for a set number of contact days (default 8);
 *  - at most releaseTimes × releaseDays scheduled release opportunities;
 *  - a release is an allocation opportunity, never permission to call —
 *    customer-level call safeguards are checked separately;
 *  - chasing stops at once on genuine two-way contact, conversion,
 *    an explicit refusal or any other suppression.
 */

export const RELEASE_TIME_ZONE = 'Europe/London';
export const DEFAULT_RELEASE_TIMES = ['09:00', '12:00', '14:30', '17:00'];
export const DEFAULT_RELEASE_DAYS = 8;

export interface ReleaseScheduleConfig {
  /** "HH:MM" in UK time. */
  releaseTimes: string[];
  releaseDays: number;
}

export const DEFAULT_RELEASE_SCHEDULE: ReleaseScheduleConfig = {
  releaseTimes: DEFAULT_RELEASE_TIMES,
  releaseDays: DEFAULT_RELEASE_DAYS,
};

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

const parseTime = (t: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
};

/** Valid, de-duplicated release times in day order. */
export const sanitiseReleaseTimes = (times: string[]): string[] => {
  const mins = Array.from(new Set(times.map(parseTime).filter((v): v is number => v !== null))).sort((a, b) => a - b);
  return mins.map(v => `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`);
};

export const sanitiseReleaseSchedule = (cfg: Partial<ReleaseScheduleConfig>): ReleaseScheduleConfig => {
  const times = sanitiseReleaseTimes(cfg.releaseTimes ?? DEFAULT_RELEASE_TIMES);
  const days = Math.round(Number(cfg.releaseDays ?? DEFAULT_RELEASE_DAYS));
  return {
    releaseTimes: times.length ? times : DEFAULT_RELEASE_TIMES,
    releaseDays: Number.isFinite(days) ? Math.min(30, Math.max(1, days)) : DEFAULT_RELEASE_DAYS,
  };
};

export const maxReleases = (cfg: ReleaseScheduleConfig) => {
  const c = sanitiseReleaseSchedule(cfg);
  return c.releaseTimes.length * c.releaseDays;
};

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: RELEASE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const londonParts = (at: number) => {
  const p = Object.fromEntries(fmt.formatToParts(new Date(at)).map(x => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
};

/** UK calendar date key, e.g. "2026-10-31". */
export const londonDateKey = (at: number) => {
  const { y, mo, d } = londonParts(at);
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

/** The instant a UK wall-clock time occurs on the given UK date. */
const londonInstant = (y: number, mo: number, d: number, minutes: number) => {
  const guess = Date.UTC(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60);
  const p = londonParts(guess);
  const shown = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
  return guess - (shown - guess);
};

/** Whole UK calendar days from `from` to `to` (same day = 0). */
export const londonDaysBetween = (from: number, to: number) => {
  const a = londonParts(from);
  const b = londonParts(to);
  return Math.round((Date.UTC(b.y, b.mo - 1, b.d) - Date.UTC(a.y, a.mo - 1, a.d)) / DAY);
};

/** First scheduled release strictly after `after`. */
export const nextReleaseAt = (after: number, cfg: ReleaseScheduleConfig): number => {
  const { releaseTimes } = sanitiseReleaseSchedule(cfg);
  const mins = releaseTimes.map(t => parseTime(t) as number);
  for (let offset = 0; offset < 3; offset += 1) {
    const { y, mo, d } = londonParts(after + offset * DAY);
    for (const m of mins) {
      const at = londonInstant(y, mo, d, m);
      if (at > after) return at;
    }
  }
  return after + DAY;
};

export interface ChaseState {
  /** When the chase began (first release, or lead arrival). */
  chaseStartedAt: number;
  /** Scheduled releases already used. */
  releasesUsed: number;
  /** Genuine two-way conversation has happened. */
  contacted: boolean;
  converted: boolean;
  /** Refusal, do-not-call, unsubscribe or any other suppression. */
  suppressed: boolean;
}

export type NextRelease =
  | { done: false; at: number; releaseNumber: number; contactDay: number }
  | { done: true; reason: 'contacted' | 'converted' | 'suppressed' | 'limit_reached' | 'days_finished' };

/** Where the lead goes next after an unsuccessful attempt or lapsed release. */
export const planNextRelease = (state: ChaseState, now: number, cfg: ReleaseScheduleConfig): NextRelease => {
  const c = sanitiseReleaseSchedule(cfg);
  if (state.converted) return { done: true, reason: 'converted' };
  if (state.contacted) return { done: true, reason: 'contacted' };
  if (state.suppressed) return { done: true, reason: 'suppressed' };
  if (state.releasesUsed >= maxReleases(c)) return { done: true, reason: 'limit_reached' };
  const at = nextReleaseAt(now, c);
  const contactDay = londonDaysBetween(state.chaseStartedAt, at) + 1;
  if (contactDay > c.releaseDays) return { done: true, reason: 'days_finished' };
  return { done: false, at, releaseNumber: state.releasesUsed + 1, contactDay };
};

/** Outcomes that count as a genuine two-way conversation. Unanswered, voicemail, busy and failed dials never do. */
export const CONTACT_OUTCOMES = new Set(['contacted', 'quote_sent', 'negotiating', 'callback_booked', 'follow_up', 'upsell']);
/** Outcomes that must stop chasing even with no conversation. */
export const SUPPRESSION_OUTCOMES = new Set([
  'not_interested', 'do_not_contact', 'unsubscribed', 'wrong_number', 'fake_lead', 'not_eligible', 'bought_elsewhere', 'vehicle_sold', 'lost',
]);

export interface ReleaseGuardInput {
  contacted: boolean;
  converted: boolean;
  suppressed: boolean;
  eligibleForAllocation: boolean;
  legallyCallable: boolean;
}

/** Checked before every release; a failed check holds the release. */
export const releaseGuard = (lead: ReleaseGuardInput): { ok: true } | { ok: false; reason: string } => {
  if (lead.contacted) return { ok: false, reason: 'Customer already contacted' };
  if (lead.converted) return { ok: false, reason: 'Lead already converted' };
  if (lead.suppressed) return { ok: false, reason: 'Contact suppressed' };
  if (!lead.eligibleForAllocation) return { ok: false, reason: 'Not eligible for allocation' };
  if (!lead.legallyCallable) return { ok: false, reason: 'Not legally callable' };
  return { ok: true };
};

/** Only staff a manager has not blocked from Open Round Robin take part. */
export const allowedOrrStaff = <T extends { id: string }>(staff: T[], blockedIds: string[]) => {
  const blocked = new Set(blockedIds);
  return staff.filter(s => !blocked.has(s.id));
};

export const describeReleaseTimes = (cfg: ReleaseScheduleConfig) => {
  const c = sanitiseReleaseSchedule(cfg);
  return c.releaseTimes
    .map(t => {
      const [h, m] = t.split(':').map(Number);
      const hh = h % 12 === 0 ? 12 : h % 12;
      return `${hh}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
    })
    .join(', ');
};
