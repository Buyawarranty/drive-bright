import { supabase } from '@/integrations/supabase/client';

/**
 * A sale belongs to exactly ONE person, and that person must be a sales agent.
 *
 * Priority: manager override (sale_credit_admin_user_id) → payment_confirmed_by
 * → quote_sent_by → assigned_to. Back-office staff (accounts@, support@, info@,
 * admins) often confirm an external payment on an agent's behalf — they must
 * never take the sale, so any non-sales id in the chain is skipped and credit
 * falls through to the sales agent who actually worked the deal.
 */
export const SALES_CREDIT_ROLES = ['sales', 'sales_lead'] as const;

export interface SaleCreditFields {
  sale_credit_admin_user_id?: string | null;
  payment_confirmed_by?: string | null;
  quote_sent_by?: string | null;
  assigned_to?: string | null;
}

/**
 * Every admin user who can hold sales credit, including archived/inactive
 * agents so historical sales stay credited to whoever made them.
 */
export const fetchSalesCreditAgentIds = async (): Promise<Set<string>> => {
  const { data } = await supabase
    .from('admin_users')
    .select('id, role')
    .in('role', ['sales', 'sales_lead']);
  return new Set((data || []).map((u: any) => u.id as string));
};

export const buildSaleCreditResolver = (salesAgentIds: Set<string>) => {
  return (customer: SaleCreditFields | null | undefined): string | null => {
    if (!customer) return null;
    // A manager's override wins — but ONLY if it points at a real sales agent.
    // A sale can never sit with accounts@/support@/info@ or any back-office login.
    const chain = [
      customer.sale_credit_admin_user_id,
      customer.payment_confirmed_by,
      customer.quote_sent_by,
      customer.assigned_to,
    ];
    for (const id of chain) {
      if (id && salesAgentIds.has(id)) return id;
    }
    return null;
  };
};

