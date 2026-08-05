import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';

export interface LeadOwnerInfo {
  ownerName: string | null;
  leadFound: boolean;
  loading: boolean;
}

const tail9 = (p?: string | null) => (p || '').replace(/\D/g, '').slice(-9);

/**
 * Resolves "whose lead is this?" from an email address or phone number.
 * Used in Quotes & Orders so an agent always knows who owns the lead —
 * whether it was imported from the lead search or typed in manually.
 */
export const useLeadOwner = (email?: string | null, phone?: string | null): LeadOwnerInfo => {
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const adminMap = useAllAdminUsersMap(assignedTo);
  const [leadFound, setLeadFound] = useState(false);
  const [loading, setLoading] = useState(false);

  const emailKey = (email || '').trim().toLowerCase();
  const phoneKey = tail9(phone);

  useEffect(() => {
    const hasEmail = emailKey.includes('@');
    const hasPhone = phoneKey.length === 9;
    if (!hasEmail && !hasPhone) {
      setAssignedTo(null);
      setLeadFound(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const run = async () => {
      try {
        const clauses: string[] = [];
        if (hasEmail) clauses.push(`email.ilike.${emailKey}`);
        if (hasPhone) clauses.push(`phone.ilike.%${phoneKey}`);

        const { data } = await supabase
          .from('sales_leads')
          .select('id, assigned_to, created_at')
          .or(clauses.join(','))
          .order('created_at', { ascending: false })
          .limit(10);

        if (cancelled) return;
        const rows = (data as any[]) || [];
        setLeadFound(rows.length > 0);
        setAssignedTo(rows.find((r) => r.assigned_to)?.assigned_to ?? null);
      } catch {
        if (!cancelled) {
          setAssignedTo(null);
          setLeadFound(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const t = setTimeout(run, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [emailKey, phoneKey]);

  const user = assignedTo ? adminMap.get(assignedTo) : undefined;
  const ownerName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email
    : null;

  return { ownerName, leadFound, loading };
};
