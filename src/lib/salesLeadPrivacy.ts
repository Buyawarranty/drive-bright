export const isOwnLeadImportRole = (role: string | null | undefined) =>
  role === 'sales' || role === 'sales_lead';

export const canSelectQuoteLead = (
  role: string | null | undefined,
  viewerId: string | null | undefined,
  lead: { id: string; assigned_to?: string | null },
) => {
  if (!role) return false;
  if (!isOwnLeadImportRole(role)) return true;
  return !!viewerId && lead.assigned_to === viewerId && !lead.id.includes(':');
};

export const showPersonalAttendanceBar = (
  role: string | null | undefined,
  enabled?: boolean | null,
) => !!role && (!isOwnLeadImportRole(role) || enabled === true);