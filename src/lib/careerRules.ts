export const DEFAULT_CAREER_REJECTION_DAYS = 5;

export function validCareerDelay(days: number): boolean {
  return Number.isInteger(days) && days >= 1 && days <= 90;
}

export function canDelayApplication(row: { status: string; rejection_sent_at: string | null }): boolean {
  return (row.status === 'new' || row.status === 'on_hold') && !row.rejection_sent_at;
}