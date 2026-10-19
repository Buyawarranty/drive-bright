export const REPORTING_ROLES = ['admin', 'super_admin', 'sales_manager', 'accounts', 'accounts_manager', 'accounts_payroll'];
export const canUseReporting = (role: string | null) => REPORTING_ROLES.includes(role ?? '');
export const moneyRound = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function invoiceAmounts(sales: number, percentage: number, vatPercentage = 0) {
  if (![sales, percentage, vatPercentage].every(Number.isFinite) || sales < 0 || percentage < 0 || percentage > 100 || vatPercentage < 0 || vatPercentage > 100) throw new Error('Invalid invoice amounts');
  const commission = moneyRound(sales * percentage / 100);
  const vat = moneyRound(commission * vatPercentage / 100);
  return { commission, vat, total: moneyRound(commission + vat) };
}
export type Schedule = { frequency: string; weekday: number; monthday: number; send_hour: number };
export function londonParts(date: Date) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const get = (key: string) => Number(p.find(x => x.type === key)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}
export function nextReportingSend(schedule: Schedule, after: Date): string {
  // Whole London hours; skipping non-existent spring clock-change hours is deliberate.
  const candidate = new Date(Math.floor(after.getTime() / 3600000) * 3600000 + 3600000);
  for (let i = 0; i < 24 * 63; i++, candidate.setTime(candidate.getTime() + 3600000)) {
    const p = londonParts(candidate);
    const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
    if (p.hour === schedule.send_hour && (schedule.frequency === 'daily' || (schedule.frequency === 'weekly' && weekday === schedule.weekday) || (schedule.frequency === 'monthly' && p.day === schedule.monthday))) return candidate.toISOString();
  }
  throw new Error('Invalid report schedule');
}
export function scheduledReportingPeriod(schedule: Schedule, due: Date) {
  const p = londonParts(due);
  const end = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const start = new Date(end);
  if (schedule.frequency === 'monthly') {
    end.setUTCDate(1);
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - 1);
  } else start.setUTCDate(start.getUTCDate() - (schedule.frequency === 'weekly' ? 7 : 1));
  end.setUTCDate(end.getUTCDate() - 1);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}
export function reportingEligible(sale: { status?: string | null; is_deleted?: boolean | null; final_amount?: number | string | null; payment_status?: string | null }) {
  return !sale.is_deleted && !['cancelled', 'refunded', 'test purchase'].includes((sale.status ?? '').toLowerCase()) && !['pending', 'unpaid', 'failed', 'cancelled', 'refunded'].includes((sale.payment_status ?? '').toLowerCase()) && Number(sale.final_amount) > 0;
}
export function fillReportingTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] ?? match);
}