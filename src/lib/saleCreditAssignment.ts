import { supabase } from '@/integrations/supabase/client';

/**
 * A confirmed sale ALWAYS belongs to a sales agent.
 *
 * Back-office logins (accounts@, support@, info@, admins, managers) regularly
 * confirm an external payment on an agent's behalf. They must never take the
 * sale: the agent who converted it keeps it. The only sale with no agent is a
 * direct website sale, which needs no confirmation at all.
 */
export const SALES_CREDIT_ROLES = ['sales', 'sales_lead'] as const;

export type SalesCreditRole = (typeof SALES_CREDIT_ROLES)[number];

export const isSalesCreditRole = (role?: string | null): boolean =>
  !!role && (SALES_CREDIT_ROLES as readonly string[]).includes(role);

export interface SalesAgentOption {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

const displayName = (u: { first_name?: string | null; last_name?: string | null; email?: string | null }) =>
  [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || 'Agent';

/** Active sales agents who can be credited with a sale. */
export const fetchSalesAgentOptions = async (): Promise<SalesAgentOption[]> => {
  const { data } = await supabase
    .from('admin_users')
    .select('id, first_name, last_name, email, role, is_active')
    .in('role', SALES_CREDIT_ROLES as unknown as string[])
    .eq('is_active', true)
    .order('first_name');
  return (data || []).map((u: any) => ({
    id: u.id as string,
    name: displayName(u),
    email: u.email ?? null,
    role: u.role as string,
  }));
};

/** Which of these admin_users ids are sales agents (any status, so history keeps its owner). */
export const fetchSalesRoleIds = async (ids: (string | null | undefined)[]): Promise<Set<string>> => {
  const clean = Array.from(new Set(ids.filter((id): id is string => !!id)));
  if (clean.length === 0) return new Set();
  const { data } = await supabase
    .from('admin_users')
    .select('id, role')
    .in('id', clean);
  return new Set((data || []).filter((u: any) => isSalesCreditRole(u.role)).map((u: any) => u.id as string));
};

/**
 * Pick the sales agent a confirmed sale should be recorded against.
 * Candidates are tried in order and the first genuine sales agent wins;
 * anyone else in the chain (accounts/support/info/manager) is skipped.
 */
export const resolveSaleCreditAgentId = async (
  candidates: (string | null | undefined)[],
): Promise<string | null> => {
  const salesIds = await fetchSalesRoleIds(candidates);
  for (const id of candidates) {
    if (id && salesIds.has(id)) return id;
  }
  return null;
};
