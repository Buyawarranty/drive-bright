import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsManagement } from '@/hooks/useIsManagement';
import { playReminderChime } from '@/lib/reminderAlerts';


export interface DiscountAuthRequest {
  id: string;
  requested_by_user_id: string;
  requested_by_name: string | null;
  registration_plate: string | null;
  mileage: string | null;
  vehicle_description: string | null;
  customer_name: string | null;
  base_price: number | null;
  requested_price: number | null;
  discount_pct: number | null;
  payment_type: string | null;
  reason: string;
  status: string;
  /** 'discount' (lower price) or 'claim_limit_5000' (permission to sell £5,000 cover) */
  request_type?: string | null;
  decided_by_name: string | null;
  decision_note: string | null;
  decided_at: string | null;
  seen_by_requester: boolean;
  created_at: string;
}

const MANAGEMENT = new Set(['admin', 'super_admin', 'sales_manager']);

/**
 * Discount-over-40% authorisation requests.
 *
 * Agents raise a request from the Quotes & Orders discount panel (reg + mileage
 * are pulled from step 2, agent adds a reason). Management get a top banner with
 * a beep and approve/decline. The requesting agent then gets a green
 * "go ahead" banner on approval.
 */
export const useDiscountAuthRequests = (userRole?: string | null) => {
  const { user } = useAuth();
  const { isManagement: serverIsManagement } = useIsManagement();
  const isManagement = serverIsManagement || (!!userRole && MANAGEMENT.has(userRole));

  const [requests, setRequests] = useState<DiscountAuthRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const knownPendingIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);
  const knownDecisionIds = useRef<Set<string>>(new Set());

  const fetchRequests = useCallback(async () => {
    if (!user?.id) return;
    let query = supabase
      .from('discount_auth_requests')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    if (!isManagement) query = query.eq('requested_by_user_id', user.id);

    const { data } = await query;
    const rows = (data || []) as unknown as DiscountAuthRequest[];

    // Beep for management when a brand new pending request lands, and for the
    // agent when one of their requests gets a decision.
    if (!firstLoad.current) {
      if (isManagement) {
        const isNew = rows.some((r) => r.status === 'pending' && !knownPendingIds.current.has(r.id));
        if (isNew) playReminderChime();
      } else {
        const decided = rows.some(
          (r) => r.status !== 'pending' && !r.seen_by_requester && !knownDecisionIds.current.has(r.id),
        );
        if (decided) playReminderChime();
      }
    }
    knownPendingIds.current = new Set(rows.filter((r) => r.status === 'pending').map((r) => r.id));
    knownDecisionIds.current = new Set(rows.filter((r) => r.status !== 'pending').map((r) => r.id));
    firstLoad.current = false;

    setRequests(rows);
    setLoading(false);
  }, [user?.id, isManagement]);

  useEffect(() => {
    if (!user?.id) return;
    fetchRequests();
    const channel = supabase
      .channel('discount-auth-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discount_auth_requests' }, () => {
        fetchRequests();
      })
      .subscribe();
    const interval = setInterval(fetchRequests, 30000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user?.id, fetchRequests]);

  const decide = useCallback(
    async (id: string, status: 'approved' | 'declined', note?: string, deciderName?: string) => {
      const { error } = await supabase
        .from('discount_auth_requests')
        .update({
          status,
          decision_note: note || null,
          decided_by_user_id: user?.id || null,
          decided_by_name: deciderName || user?.email || 'Management',
          decided_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
      await fetchRequests();
    },
    [user?.id, user?.email, fetchRequests],
  );

  const markSeen = useCallback(
    async (id: string) => {
      await supabase.from('discount_auth_requests').update({ seen_by_requester: true }).eq('id', id);
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, seen_by_requester: true } : r)));
    },
    [],
  );

  const pending = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests]);
  const myDecided = useMemo(
    () => requests.filter((r) => r.status !== 'pending' && !r.seen_by_requester && r.requested_by_user_id === user?.id),
    [requests, user?.id],
  );
  // Only price-discount approvals lift the discount ceiling. Claim-limit
  // approvals must never be mistaken for a price authorisation.
  const myApproved = useMemo(
    () =>
      requests.find(
        (r) =>
          r.status === 'approved' &&
          r.requested_by_user_id === user?.id &&
          (r.request_type || 'discount') === 'discount',
      ),
    [requests, user?.id],
  );

  /** Approved £5,000 claim-limit permissions raised by the current agent (last 24h). */
  const myApprovedClaimLimit5k = useMemo(
    () =>
      requests.filter(
        (r) =>
          r.status === 'approved' &&
          r.requested_by_user_id === user?.id &&
          r.request_type === 'claim_limit_5000',
      ),
    [requests, user?.id],
  );

  return {
    requests,
    pending,
    myDecided,
    myApproved,
    myApprovedClaimLimit5k,
    loading,
    isManagement,
    decide,
    markSeen,
    refetch: fetchRequests,
  };
};
