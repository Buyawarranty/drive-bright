import type { Claim } from '@/types/claim';
import { deriveStage, STAGE_META } from './statusMap';

export interface SlaInfo {
  hoursRemaining: number; // negative = overdue
  label: string;          // "Due today", "Overdue 2d", "3d left"
  tone: 'overdue' | 'due' | 'soon' | 'ok';
}

export function computeSla(c: Claim): SlaInfo {
  const stage = deriveStage(c);
  const budget = STAGE_META[stage].slaHours;
  const elapsed = (c.ageInDays ?? 0) * 24;
  const remaining = budget - elapsed;

  if (remaining < 0) {
    const overdueDays = Math.ceil(Math.abs(remaining) / 24);
    return { hoursRemaining: remaining, tone: 'overdue', label: `Overdue ${overdueDays}d` };
  }
  if (remaining <= 8) return { hoursRemaining: remaining, tone: 'due', label: 'Due today' };
  if (remaining <= 24) return { hoursRemaining: remaining, tone: 'soon', label: 'Due tomorrow' };
  const daysLeft = Math.ceil(remaining / 24);
  return { hoursRemaining: remaining, tone: 'ok', label: `${daysLeft}d left` };
}

export const slaToneCls: Record<SlaInfo['tone'], string> = {
  overdue: 'bg-red-100 text-red-700 border-red-200',
  due: 'bg-amber-100 text-amber-800 border-amber-200',
  soon: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  ok: 'bg-gray-100 text-gray-600 border-gray-200',
};
