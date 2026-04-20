/**
 * Formats a per-day price from pence into a human-readable string.
 * - Values >= 100p are shown in pounds (e.g. 189p -> "£1.89")
 * - Values <  100p stay in pence (e.g. 60p -> "60p")
 */
export const formatDailyFromPence = (pence: number): string => {
  if (!pence || pence <= 0) return '0p';
  if (pence >= 100) {
    return `£${(pence / 100).toFixed(2)}`;
  }
  return `${pence}p`;
};

/**
 * Returns "/day over term" suffix label.
 */
export const DAILY_SUFFIX = '/day over term';
