export function isSalesSourceBlocked(role: string | null | undefined): boolean {
  return ['sales', 'sales_lead', 'sales_manager'].includes(role ?? '');
}

export function hasDefaultLeadSourceAccess(role: string | null | undefined, email?: string | null): boolean {
  if (!role || isSalesSourceBlocked(role)) return false;
  return role === 'admin' || role === 'super_admin' || /^(ads|seo)@/i.test(email ?? '');
}

/** Protected server grant plus a fail-closed sales-role display guard. */
export function canDisplayLeadSource(granted: boolean, role: string | null | undefined): boolean {
  return Boolean(role) && !isSalesSourceBlocked(role) && granted === true;
}