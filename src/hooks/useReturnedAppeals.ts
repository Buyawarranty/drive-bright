import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Appeals that have come BACK from the customer.
 * A returned appeal = a customer response (claim_update_responses) on a claim
 * that has an open appeal (claim_appeals with no closed_at).
 */
export interface ReturnedAppeal {
  id: string;
  appealId: string | null;
  claimId: string;
  createdAt: string;
  isRead: boolean;
  notes: string | null;
  statusUpdate: string | null;
  respondentName: string | null;
  respondentEmail: string | null;
  fileUrl: string | null;
  fileName: string | null;
  invoiceAmount: number | null;
  registration: string | null;
  customerName: string | null;
  claimReason: string | null;
  appealReason: string | null;
  appealFee: number | null;
  independentReviewer: string | null;
  appealSentAt: string | null;
}

export const useReturnedAppeals = () => {
  const [appeals, setAppeals] = useState<ReturnedAppeal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAppeals = useCallback(async () => {
    try {
      const { data: openAppeals } = await supabase
        .from('claim_appeals')
        .select('id, claim_id, reason, appeal_fee, independent_reviewer, sent_at, closed_at, created_at')
        .is('closed_at', null)
        .order('created_at', { ascending: false });

      const appealByClaim = new Map<string, any>();
      (openAppeals || []).forEach((a: any) => {
        if (!appealByClaim.has(a.claim_id)) appealByClaim.set(a.claim_id, a);
      });

      const claimIds = Array.from(appealByClaim.keys());
      if (claimIds.length === 0) {
        setAppeals([]);
        return;
      }

      const { data: responses } = await supabase
        .from('claim_update_responses')
        .select('*, claim_update_requests(vehicle_registration, customer_name, claim_reason)')
        .in('claim_id', claimIds)
        .order('created_at', { ascending: false });

      const rows: ReturnedAppeal[] = (responses || []).map((r: any) => {
        const a = appealByClaim.get(r.claim_id) || {};
        return {
          id: r.id,
          appealId: a.id ?? null,
          claimId: r.claim_id,
          createdAt: r.created_at,
          isRead: !!r.is_read,
          notes: r.notes ?? null,
          statusUpdate: r.status_update ?? null,
          respondentName: r.respondent_name ?? null,
          respondentEmail: r.respondent_email ?? null,
          fileUrl: r.file_url ?? null,
          fileName: r.file_name ?? null,
          invoiceAmount: r.invoice_amount ?? null,
          registration: r.claim_update_requests?.vehicle_registration ?? null,
          customerName: r.claim_update_requests?.customer_name ?? r.respondent_name ?? null,
          claimReason: r.claim_update_requests?.claim_reason ?? null,
          appealReason: a.reason ?? null,
          appealFee: a.appeal_fee ?? null,
          independentReviewer: a.independent_reviewer ?? null,
          appealSentAt: a.sent_at ?? null,
        };
      });

      setAppeals(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppeals();
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchAppeals();
    }, 45000);
    return () => clearInterval(interval);
  }, [fetchAppeals]);

  useEffect(() => {
    const channel = supabase
      .channel('returned-appeals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claim_update_responses' }, () => fetchAppeals())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAppeals]);

  const markAsRead = useCallback(async (id: string) => {
    await supabase.from('claim_update_responses').update({ is_read: true }).eq('id', id);
    setAppeals(prev => prev.map(a => (a.id === id ? { ...a, isRead: true } : a)));
  }, []);

  const closeAppeal = useCallback(async (appealId: string) => {
    if (!appealId) return;
    await supabase
      .from('claim_appeals')
      .update({ closed_at: new Date().toISOString(), status: 'closed' })
      .eq('id', appealId);
    setAppeals(prev => prev.filter(a => a.appealId !== appealId));
  }, []);

  return {
    appeals,
    unread: appeals.filter(a => !a.isRead),
    unreadCount: appeals.filter(a => !a.isRead).length,
    totalCount: appeals.length,
    loading,
    refetch: fetchAppeals,
    markAsRead,
    closeAppeal,
  };
};
