export type CrmAuditZone = 'UTC' | 'Europe/London';

export function formatCrmAuditTime(iso: string | null | undefined, zone: CrmAuditZone = 'UTC'): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso));
}