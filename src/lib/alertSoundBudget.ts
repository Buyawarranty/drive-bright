/**
 * Global alert-sound budget.
 *
 * Staff asked for pop-up alerts to be effectively silent: they get ONE short
 * two-tone beep at the very start of a session (two tones = "two beeps"), and
 * after that every pop-up sound is permanently muted for the rest of that
 * browser session — nothing turns it back on.
 *
 * Every sound entry point calls consumeAlertSound() first; once the budget is
 * spent it returns false forever and the caller plays nothing.
 */

const KEY = 'alerts.sound_plays_used';
const MAX_PLAYS = 1; // one two-tone beep

let used = -1;

const read = (): number => {
  if (used >= 0) return used;
  try {
    const raw = sessionStorage.getItem(KEY);
    const n = raw ? Number(raw) : 0;
    used = Number.isFinite(n) ? n : 0;
  } catch {
    used = 0;
  }
  return used;
};

const write = (n: number) => {
  used = n;
  try {
    sessionStorage.setItem(KEY, String(n));
  } catch {
    /* ignore */
  }
};

/** True only while the session still has its opening beep left AND it is UK work hours. */
export const alertSoundsAvailable = (): boolean => read() < MAX_PLAYS && isUkWorkHours();

/**
 * Reserve a play. Returns false once the session's beeps are used up, and
 * always returns false outside UK work hours (Mon–Sat, 9am–6pm) — the budget
 * is not spent then, the sound simply never plays.
 */
export const consumeAlertSound = (): boolean => {
  if (!isUkWorkHours()) return false;
  const n = read();
  if (n >= MAX_PLAYS) return false;
  write(n + 1);
  return true;
};
