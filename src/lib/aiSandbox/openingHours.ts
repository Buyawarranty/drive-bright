// Warranty specialist opening hours — Monday to Saturday, 9am to 6pm UK time.
// Mirrors the same rule used by the ai-sandbox-chat edge function.

export const openingHoursLabel = 'Mon–Sat, 9am–6pm';
export const salesPhoneHoursLabel = 'Mon–Fri, 9am–6pm · Sat, 12pm–4pm';

const OPEN_DAYS = [1, 2, 3, 4, 5, 6];
const START_HOUR = 9;
const END_HOUR = 18;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function londonNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  return { dayIndex, hour, minute };
}

/** The sales phone line: weekdays 9am–6pm, Saturday 12pm–4pm, UK time. */
export function isSalesPhoneOpenNow(now = new Date()): boolean {
  const { dayIndex, hour, minute } = londonNow(now);
  const minutes = hour * 60 + minute;
  if (dayIndex >= 1 && dayIndex <= 5) return minutes >= 9 * 60 && minutes < 18 * 60;
  if (dayIndex === 6) return minutes >= 12 * 60 && minutes < 16 * 60;
  return false;
}

export function isTeamOpenNow(now = new Date()): boolean {
  const { dayIndex, hour } = londonNow(now);
  return OPEN_DAYS.includes(dayIndex) && hour >= START_HOUR && hour < END_HOUR;
}

export function nextOpeningLabel(now = new Date()): string {
  const { dayIndex, hour } = londonNow(now);
  if (OPEN_DAYS.includes(dayIndex) && hour < START_HOUR) return 'today at 9am';

  let day = dayIndex;
  let hops = 0;
  do {
    day = (day + 1) % 7;
    hops += 1;
  } while (!OPEN_DAYS.includes(day) && hops < 8);

  return hops === 1 ? 'tomorrow at 9am' : `${DAY_NAMES[day]} at 9am`;
}
