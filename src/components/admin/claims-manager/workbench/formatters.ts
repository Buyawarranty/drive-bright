export function formatDaysOnRisk(days: number | null | undefined): string {
  if (days == null || days < 0) return '—';
  if (days === 0) return '0 days';

  const months = Math.floor(days / 30);
  const remainingDays = days % 30;

  if (months === 0) {
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  if (remainingDays === 0) {
    return `${months}m`;
  }

  return `${months}m ${remainingDays} day${remainingDays === 1 ? '' : 's'}`;
}
