/** Presentation/export safeguards; table RLS remains the data access boundary. */
export function canUseStaffExport(role: string | null | undefined): boolean {
  return ['admin', 'super_admin', 'sales_manager', 'performance_manager', 'accounts', 'accounts_manager', 'lead_gen', 'sales_lead'].includes(role || '');
}

export function canUseFullStaffExport(role: string | null | undefined): boolean {
  return canUseStaffExport(role) && role !== 'sales_lead';
}

/** Two-month rolling window, clamped for month ends and normalized to UTC. */
export function staffExportCutoff(now = new Date()): Date {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  const lastDay = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), Math.min(now.getUTCDate(), lastDay)));
}

export function staffExportRows<T>(rows: T[], role: string | null | undefined, getDate: (row: T) => string | null | undefined, now = new Date()): T[] {
  if (!canUseStaffExport(role)) return [];
  if (role !== 'sales_lead') return rows;
  const cutoff = staffExportCutoff(now).getTime();
  return rows.filter(row => {
    const date = getDate(row);
    if (!date) return false;
    const timestamp = Date.parse(date);
    return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= now.getTime();
  });
}