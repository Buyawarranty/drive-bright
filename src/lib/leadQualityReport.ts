export type QualityRow = { source: string; total: number; statuses: Record<string, number>; activities: Record<string, number> };
export type QualityReport = { as_of: string; rows: QualityRow[] };
export const LEAD_STATUSES = [
  ['new', 'Not spoken to'], ['contacted', 'Spoken to'], ['callback_booked', 'Callback booked'],
  ['urgent_callback', 'Urgent callback'], ['follow_up', 'Follow-up'], ['quote_sent', 'Quoted'],
  ['negotiating', 'Negotiating'], ['converted', 'Won'], ['no_answer', 'No answer'],
  ['left_voicemail', 'Left voicemail'], ['wrong_number', 'Wrong number'], ['lost', 'Lost'],
  ['fake_lead', 'Fake'], ['bought_elsewhere', 'Bought elsewhere'], ['vehicle_sold', 'Vehicle sold'],
  ['do_not_contact', 'Do not contact'], ['not_interested', 'Not interested'], ['not_eligible', 'Not eligible'],
  ['dormant', 'Dormant'], ['unsubscribed', 'Unsubscribed'], ['archived', 'Archived'],
  ['upsell', 'Upsell'], ['upgraded', 'Upgraded'],
] as const;
export const LEAD_ACTIVITIES = [['callbacks', 'Callback requests'], ['awaiting', 'Awaiting assignment'], ['paid', 'Paid'], ['hot', 'Hot'], ['repeat', 'Back in this period'], ['reminders', 'Active reminders']] as const;
export const QUALITY_SOURCES = [['google', 'Google'], ['facebook', 'Facebook / Meta'], ['organic', 'Organic'], ['other', 'Other (phone etc.)']] as const;
export function qualityCategories(rows: QualityRow[]) {
  const known = new Set<string>(LEAD_STATUSES.map(([key]) => key));
  const extra = [...new Set(rows.flatMap(row => Object.keys(row.statuses)))].filter(key => !known.has(key)).sort();
  return [...LEAD_STATUSES, ...extra.map(key => [key, key.replaceAll('_', ' ')] as const)];
}
export function qualityCount(rows: QualityRow[], key: string, activity = false) {
  return rows.reduce((sum, row) => sum + Number((activity ? row.activities : row.statuses)[key] ?? 0), 0);
}
export function qualityTotal(rows: QualityRow[]) { return rows.reduce((sum, row) => sum + row.total, 0); }