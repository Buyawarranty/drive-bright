const LEAD_FEED_TIME_ZONE = 'Europe/London';

interface LeadFeedDateRange {
  from?: Date;
  to?: Date;
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

const getSelectionParts = (date: Date) => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
  day: date.getDate(),
});

export const getTodayLeadFeedSelectionDate = (baseDate = new Date()) => {
  const { year, month, day } = parseTimeZoneParts(baseDate);
  return new Date(year, month - 1, day);
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

export const getLeadFeedRangeBoundaries = (range: LeadFeedDateRange) => ({
  from: range.from ? getLeadFeedDayRange(range.from).from : undefined,
  to: range.to ? getLeadFeedDayRange(range.to).to : undefined,
});

export const isDateInLeadFeedRange = (date: Date, range: LeadFeedDateRange) => {
  const { from, to } = getLeadFeedRangeBoundaries(range);

  if (from && date < from) return false;
  if (to && date > to) return false;

  return true;
};

const isSameSelectionDay = (left?: Date, right?: Date) => {
  if (!left || !right) return false;

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
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
