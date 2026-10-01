const LEAD_FEED_TIME_ZONE = 'Europe/London';

interface LeadFeedDateRange {
  from?: Date;
  to?: Date;
  /** When true, from/to are treated as exact timestamps (not normalised to full-day boundaries). */
  exact?: boolean;
}

interface TimeZoneParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const timeZoneDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LEAD_FEED_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  hourCycle: 'h23',
});

const parseTimeZoneParts = (date: Date): TimeZoneParts => {
  const parts = timeZoneDateTimeFormatter.formatToParts(date);
  const getValue = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value || 0);

  // Some environments return hour=24 for midnight with certain hourCycle settings.
  // Normalise to 0-23 range to prevent offset calculation errors.
  const rawHour = getValue('hour');

  return {
    year: getValue('year'),
    month: getValue('month'),
    day: getValue('day'),
    hour: rawHour === 24 ? 0 : rawHour,
    minute: getValue('minute'),
    second: getValue('second'),
  };
};

const getTimeZoneOffsetMs = (date: Date) => {
  const parts = parseTimeZoneParts(date);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
  return asUtc - date.getTime();
};

const londonLocalDateTimeToUtc = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
) => {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  const offsetMs = getTimeZoneOffsetMs(utcGuess);
  return new Date(utcGuess.getTime() - offsetMs);
};

// Calendar-day reads for the leads feed MUST use Europe/London (the same
// formatter as parseTimeZoneParts above) — never the viewer's browser timezone.
// Browser-local getters made "Today" roll over to the next London day early for
// staff whose device is ahead of the UK, silently hiding every lead created
// that day.
const getSelectionParts = (date: Date) => {
  const parts = parseTimeZoneParts(date);
  return { year: parts.year, month: parts.month, day: parts.day };
};

export const getTodayLeadFeedSelectionDate = (baseDate = new Date()) => {
  const { year, month, day } = parseTimeZoneParts(baseDate);
  // Represent the selection as London midnight expressed in UTC so every
  // London-aware read of this date round-trips exactly, whatever timezone the
  // viewer's device is set to.
  return londonLocalDateTimeToUtc(year, month, day, 0, 0, 0, 0);
};

export const shiftLeadFeedSelectionDate = (date: Date, days: number) => {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
};

export const getLeadFeedDayRange = (date: Date) => {
  const { year, month, day } = getSelectionParts(date);

  return {
    from: londonLocalDateTimeToUtc(year, month, day, 0, 0, 0, 0),
    to: londonLocalDateTimeToUtc(year, month, day, 23, 59, 59, 999),
  };
};

export const getLeadFeedRangeBoundaries = (range: LeadFeedDateRange) => {
  if (range.exact) {
    return { from: range.from, to: range.to };
  }

  let from = range.from ? getLeadFeedDayRange(range.from).from : undefined;
  const to = range.to ? getLeadFeedDayRange(range.to).to : undefined;

  // Trading-day boundary: leads that land after 6pm are worked the next morning,
  // so the "Today" feed starts at 18:00 the previous evening. Without this,
  // Saturday-evening / overnight leads silently vanish at midnight even though
  // they are the first thing the team picks up.
  if (from && range.from && isSameSelectionDay(range.from, getTodayLeadFeedSelectionDate())) {
    const { year, month, day } = getSelectionParts(shiftLeadFeedSelectionDate(range.from, -1));
    from = londonLocalDateTimeToUtc(year, month, day, 18, 0, 0, 0);
  }

  return { from, to };
};

/**
 * "Since 6pm yesterday" — from 18:00 London-local yesterday up to right now.
 * Used by managers to sweep the overnight-plus-early-morning intake before shift start.
 */
export const getSince6pmYesterdayRange = (baseDate = new Date()): LeadFeedDateRange => {
  const { year, month, day } = parseTimeZoneParts(baseDate);
  // "Yesterday" = the London calendar day before today's London date.
  const yesterdayUtcMidnight = new Date(Date.UTC(year, month - 1, day));
  yesterdayUtcMidnight.setUTCDate(yesterdayUtcMidnight.getUTCDate() - 1);
  const y = yesterdayUtcMidnight.getUTCFullYear();
  const m = yesterdayUtcMidnight.getUTCMonth() + 1;
  const d = yesterdayUtcMidnight.getUTCDate();
  const from = londonLocalDateTimeToUtc(y, m, d, 18, 0, 0, 0);
  return { from, to: baseDate, exact: true };
};

export const isDateInLeadFeedRange = (date: Date, range: LeadFeedDateRange) => {
  const { from, to } = getLeadFeedRangeBoundaries(range);

  if (from && date < from) return false;
  if (to && date > to) return false;

  return true;
};

// Compare calendar days in Europe/London, not the viewer's local timezone —
// this drives the "Today" trading-day boundary (18:00 the evening before) and
// the Today/Yesterday range checks.
const isSameSelectionDay = (left?: Date, right?: Date) => {
  if (!left || !right) return false;

  const leftParts = parseTimeZoneParts(left);
  const rightParts = parseTimeZoneParts(right);

  return (
    leftParts.year === rightParts.year &&
    leftParts.month === rightParts.month &&
    leftParts.day === rightParts.day
  );
};

export const isTodayLeadFeedRange = (range?: LeadFeedDateRange) => {
  if (!range?.from || !range?.to) return false;

  const today = getTodayLeadFeedSelectionDate();
  return isSameSelectionDay(range.from, today) && isSameSelectionDay(range.to, today);
};

export const isYesterdayLeadFeedRange = (range?: LeadFeedDateRange) => {
  if (!range?.from || !range?.to) return false;

  const yesterday = shiftLeadFeedSelectionDate(getTodayLeadFeedSelectionDate(), -1);
  return isSameSelectionDay(range.from, yesterday) && isSameSelectionDay(range.to, yesterday);
};

const ukDisplayFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LEAD_FEED_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Always render lead timestamps in UK time, whatever timezone the viewer's
 * device is set to. Otherwise an agent abroad sees a 9pm Saturday lead as
 * "Jul 26, 02:00" and thinks overnight leads arrived that never did.
 */
export const formatLeadDateUK = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = ukDisplayFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value || '';
  return `${get('month')} ${get('day')}, ${get('year')} ${get('hour')}:${get('minute')}`;
};
