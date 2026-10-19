/** Only the current London calendar month's saved goal is plotted. */
export function monthlyChartTarget(monthKey: string, target: number, now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit',
  }).formatToParts(now);
  const currentMonth = `${parts.find(part => part.type === 'year')?.value}-${parts.find(part => part.type === 'month')?.value}`;
  return monthKey === currentMonth ? Math.max(0, target) : 0;
}