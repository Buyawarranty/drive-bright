export function getStoredPolicyCoverMonths(startDate?: string | null, endDate?: string | null): number | null {
  if (!startDate || !endDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const startUtc = {
    year: start.getUTCFullYear(),
    month: start.getUTCMonth(),
    day: start.getUTCDate(),
  };
  const endUtc = {
    year: end.getUTCFullYear(),
    month: end.getUTCMonth(),
    day: end.getUTCDate(),
  };

  const wholeMonths =
    (endUtc.year - startUtc.year) * 12 +
    (endUtc.month - startUtc.month) +
    (endUtc.day < startUtc.day ? -1 : 0);

  return Math.max(0, wholeMonths);
}

export function formatStoredPolicyCoverDuration(startDate?: string | null, endDate?: string | null): string {
  const months = getStoredPolicyCoverMonths(startDate, endDate);
  if (months === null) return 'N/A';

  return `${months} Month${months === 1 ? '' : 's'}`;
}