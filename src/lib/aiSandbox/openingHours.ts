// Warranty specialist opening hours — Monday to Saturday, 9am to 5pm UK time.
// Mirrors the same rule used by the ai-sandbox-chat edge function.

export const openingHoursLabel = 'Mon–Sat, 9am–5pm';

const OPEN_DAYS = [1, 2, 3, 4, 5, 6];
const START_HOUR = 9;
const END_HOUR = 17;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function londonNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  return { dayIndex, hour };
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
