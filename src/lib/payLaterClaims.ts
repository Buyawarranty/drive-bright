export const PAYLATER_CLAIM_ROLES = ['super_admin', 'admin', 'accounts', 'accounts_manager', 'accounts_payroll'] as const;

export function canViewPayLaterClaims(role?: string | null): boolean {
  return PAYLATER_CLAIM_ROLES.some(allowed => allowed === role?.trim().toLowerCase());
}

export function hasPayLaterClaim(customerId: string, ids: ReadonlySet<string>, role?: string | null): boolean {
  return canViewPayLaterClaims(role) && ids.has(customerId);
}