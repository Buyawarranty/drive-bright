import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';

export interface LeadOwnerInfo {
  ownerName: string | null;
  ownerId: string | null;
  /** Id of the most recent matching lead — used for handover requests. */
  leadId: string | null;
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
  const [leadId, setLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailKey = (email || '').trim().toLowerCase();
  const phoneKey = tail9(phone);

  useEffect(() => {
    const hasEmail = emailKey.includes('@');
    const hasPhone = phoneKey.length === 9;
    if (!hasEmail && !hasPhone) {
      setAssignedTo(null);
      setLeadFound(false);
      setLeadId(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const run = async () => {
      try {
        // PERF: the old `.or(email.ilike…,phone.ilike.%…)` could not use any
        // index (a leading-wildcard ilike scans every lead — ~1s per lookup and
        // one of the heaviest reads in the database). This RPC hits the
        // lower(btrim(email)) and RIGHT(normalize_uk_phone(phone),9) indexes.
        const { data } = await supabase.rpc('find_lead_owner_by_contact', {
          _email: hasEmail ? emailKey : null,
          _phone9: hasPhone ? phoneKey : null,
        });


        if (cancelled) return;
        const rows = (data as any[]) || [];
        setLeadFound(rows.length > 0);
        setAssignedTo(rows.find((r) => r.assigned_to)?.assigned_to ?? null);
        setLeadId(rows[0]?.id ?? null);
      } catch {
        if (!cancelled) {
          setAssignedTo(null);
          setLeadFound(false);
          setLeadId(null);
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

  return { ownerName, ownerId: assignedTo, leadId, leadFound, loading };
};
