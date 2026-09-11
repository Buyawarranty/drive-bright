// Shared UK work-hours gate for ALL staff alert sounds.
// No beep of any kind may play outside Monday–Saturday, 9am–6pm UK time
// (Europe/London, so BST in summer and GMT in winter are both handled).

const OPEN_DAYS = [1, 2, 3, 4, 5, 6]; // Mon–Sat
const START_HOUR = 9;
const END_HOUR = 18;

export function isUkWorkHours(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  return OPEN_DAYS.includes(dayIndex) && hour >= START_HOUR && hour < END_HOUR;
}
