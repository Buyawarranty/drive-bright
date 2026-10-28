import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { useViewAs } from '@/contexts/ViewAsContext';
import { canSeeLeadPopup, canSeeVerifiedLeadNotification, isSalesPopupRole } from '@/lib/popupAccess';
import { fetchByIdsInBatches } from '@/utils/batchedIn';
import { setVisibleInterval } from '@/lib/visibilityInterval';
import { createPopupOwnershipRequests } from '@/lib/popupOwnershipRequests';

/** Current ownership, never an old recipient or historical seller. */
export function usePopupLeadOwnership(leadIds: string[]) {
  const { effectiveRole: role } = useViewAs();
  const viewerId = useCurrentAdminId();
  const key = [...new Set(leadIds)].sort().join(',');
  const ids = useMemo(() => key ? key.split(',') : [], [key]);
  const [verified, setVerified] = useState<{ key: string; viewerId: string; ids: Set<string> } | null>(null);
  useEffect(() => {
    if (!isSalesPopupRole(role) || !viewerId || !ids.length) return;
    let cancelled = false;
    const requests = createPopupOwnershipRequests();
    const load = async () => {
      const request = requests.begin();
      setVerified(null);
      try {
        const rows = await fetchByIdsInBatches<{ id: string; assigned_to: string | null }>(ids, batch =>
          supabase.from('sales_leads').select('id, assigned_to').in('id', batch).eq('assigned_to', viewerId),
          { label: 'pop-up lead ownership' });
        if (!cancelled && requests.isCurrent(request)) setVerified({ key, viewerId, ids: new Set(rows.filter(r => canSeeLeadPopup(role, viewerId, r.assigned_to)).map(r => r.id)) });
      } catch {
        if (!cancelled && requests.isCurrent(request)) setVerified(null);
      }
    };
    void load();
    const stop = setVisibleInterval(load, 30_000);
    const channel = supabase.channel(`popup-ownership-${viewerId}-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_leads' }, payload => {
        const row = payload.new as { id?: string };
        const old = payload.old as { id?: string };
        if (ids.includes(row.id || old.id || '')) {
          setVerified(null);
          void load();
        }
      }).subscribe(status => {
        requests.invalidate();
        setVerified(null);
        if (status === 'SUBSCRIBED') void load();
      });
    const wake = () => {
      if (!document.hidden) void load();
    };
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      cancelled = true;
      requests.invalidate();
      stop();
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
      void supabase.removeChannel(channel);
    };
  }, [role, viewerId, key, ids]);
  return (leadId?: string | null) => canSeeVerifiedLeadNotification(role, leadId,
    !!leadId && verified?.key === key && verified.viewerId === viewerId && verified.ids.has(leadId));
}