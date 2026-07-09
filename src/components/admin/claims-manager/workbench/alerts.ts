import type { Claim } from '@/types/claim';
import { formatDaysOnRisk } from './formatters';

export interface ClaimAlert {

  key: string;
  label: string;
  tone: 'danger' | 'warning' | 'info';
}

export function computeAlerts(c: Claim): ClaimAlert[] {
  const alerts: ClaimAlert[] = [];

  if (c.hasCancellation) {
    alerts.push({ key: 'policy_cancelled', label: 'Policy cancelled or refunded', tone: 'danger' });
  }

  if (c.purchaseMileage != null && c.claimMileage != null && c.claimMileage < c.purchaseMileage) {
    alerts.push({
      key: 'mileage_discrepancy',
      label: `Mileage discrepancy: claim ${c.claimMileage.toLocaleString()} < purchase ${c.purchaseMileage.toLocaleString()}`,
      tone: 'warning',
    });
  }

  if (c.daysOnRisk != null && c.daysOnRisk <= 14) {
    alerts.push({
      key: 'within_waiting_period',
      label: `Warranty started ${formatDaysOnRisk(c.daysOnRisk)} ago — within waiting period`,
      tone: 'warning',
    });
  } else if (c.daysOnRisk != null && c.daysOnRisk <= 30) {
    alerts.push({
      key: 'new_warranty',
      label: `Warranty started ${formatDaysOnRisk(c.daysOnRisk)} ago`,
      tone: 'info',
    });
  }


  if (!c.reg || c.reg === '—') {
    alerts.push({ key: 'no_vehicle', label: 'No vehicle registration on claim', tone: 'warning' });
  }

  if ((c.previousClaims ?? 0) >= 2) {
    alerts.push({
      key: 'repeat_claim',
      label: `${c.previousClaims} previous claim(s) for this vehicle`,
      tone: 'info',
    });
  }

  if (c.amount >= 1500) {
    alerts.push({ key: 'high_value', label: `High value: £${c.amount.toLocaleString()}`, tone: 'warning' });
  }

  return alerts;
}

export const alertToneCls: Record<ClaimAlert['tone'], string> = {
  danger: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
};
