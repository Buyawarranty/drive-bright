/** Presentation/export safeguards; table RLS remains the data access boundary. */
export function canUseStaffExport(role: string | null | undefined, explicitlyGranted = false): boolean {
  if (!role || role === 'customer') return false;
  return role === 'admin' || role === 'super_admin' || explicitlyGranted === true;
}

export function canUseFullStaffExport(role: string | null | undefined, explicitlyGranted = false): boolean {
  return canUseStaffExport(role, explicitlyGranted);
}

/** Two-month rolling window, clamped for month ends and normalized to UTC. */
export function staffExportCutoff(now = new Date()): Date {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  const lastDay = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), Math.min(now.getUTCDate(), lastDay)));
}

export function staffExportRows<T>(rows: T[], role: string | null | undefined, getDate: (row: T) => string | null | undefined, now = new Date(), explicitlyGranted = false): T[] {
  return canUseStaffExport(role, explicitlyGranted) ? rows : [];
}