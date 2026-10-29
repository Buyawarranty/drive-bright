import type { OrrPracticeSettings } from './settings';

const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Day and hour in UK time, so clock changes between GMT and BST are handled. */
export const ukDayHour = (at: number) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(at));
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Sun';
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
  return { day: DAY_INDEX[weekday] ?? 0, hour };
};

export const inUkWindow = (settings: OrrPracticeSettings, at: number) => {
  const { day, hour } = ukDayHour(at);
  return settings.contactWindows.some(w => w.day === day && hour >= w.startHour && hour < w.endHour);
};

