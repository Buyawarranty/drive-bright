import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIsManagement } from '@/hooks/useIsManagement';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { setVisibleInterval } from '@/lib/visibilityInterval';

const MANAGEMENT = new Set(['admin', 'super_admin', 'sales_manager']);

export interface LeadReassignRequest {
  id: string;
  lead_id: string;
  lead_label: string | null;
  lead_reg: string | null;
  current_owner_id: string | null;
  requested_by: string;
  requested_to: string;
  reason: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  manager_note: string | null;
  created_at: string;
}

export interface AgentOption {
  id: string;
  name: string;
  role: string;
}

/**
 * Lead handover requests.
 *
 * An agent working a lead that really belongs to a colleague (or one they need
 * to hand over) asks for it to be moved. Nothing changes on the lead until a
 * manager authorises it from Lead allocation — approving is what actually
 * reassigns the lead, so round-robin fairness, caps and sale credit stay honest.
 */
export const useLeadReassignRequests = (userRole?: string | null) => {
  const currentAdminId = useCurrentAdminId();
  const { isManagement: serverIsManagement } = useIsManagement();
  const isManagement = serverIsManagement || (!!userRole && MANAGEMENT.has(userRole));

  const [requests, setRequests] = useState<LeadReassignRequest[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: reqs }, { data: admins }] = await Promise.all([
      supabase
        .from('lead_reassign_requests')
        .select('*')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role, is_active')
        .eq('is_active', true),
    ]);

    setRequests((reqs || []) as LeadReassignRequest[]);
    setAgents(
      (admins || [])
        .filter((a: any) => a.role === 'sales' || a.role === 'sales_lead')
        .map((a: any) => ({
          id: a.id,
          name: `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email || 'Unknown',
          role: a.role,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    return setVisibleInterval(load, 45000);
  }, [load]);

  const pending = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests]);

  const myRequests = useMemo(
    () => requests.filter((r) => currentAdminId && r.requested_by === currentAdminId),
    [requests, currentAdminId],
  );

  const hasPendingForLead = useCallback(
    (leadId: string | null) =>
      !!leadId && myRequests.some((r) => r.lead_id === leadId && r.status === 'pending'),
    [myRequests],
  );

  /** Agent raises the request — the lead is NOT touched here. */
  const requestHandover = useCallback(
    async (input: {
      leadId: string;
      requestedTo: string;
      reason: string;
      leadLabel?: string | null;
      leadReg?: string | null;
      currentOwnerId?: string | null;
    }) => {
      if (!currentAdminId) throw new Error('Could not identify your staff account');
      const { error } = await supabase.from('lead_reassign_requests').insert({
        lead_id: input.leadId,
        requested_by: currentAdminId,
        requested_to: input.requestedTo,
        reason: input.reason,
        lead_label: input.leadLabel || null,
        lead_reg: input.leadReg || null,
        current_owner_id: input.currentOwnerId || null,
        status: 'pending',
      });
      if (error) throw error;
      await load();
    },
    [currentAdminId, load],
  );

  /** Manager decision. Approving is what moves the lead. */
  const decide = useCallback(
    async (request: LeadReassignRequest, status: 'approved' | 'declined', note?: string) => {
      if (status === 'approved') {
        const { error: leadError } = await supabase
          .from('sales_leads')
          .update({ assigned_to: request.requested_to })
          .eq('id', request.lead_id);
        if (leadError) throw leadError;
      }

      const { error } = await supabase
        .from('lead_reassign_requests')
        .update({
          status,
          reviewed_by: currentAdminId,
          reviewed_at: new Date().toISOString(),
          manager_note: note?.trim() || null,
        })
        .eq('id', request.id);
      if (error) throw error;
      await load();
    },
    [currentAdminId, load],
  );

  const agentName = useCallback(
    (id: string | null) => (id ? agents.find((a) => a.id === id)?.name || 'Unknown' : '—'),
    [agents],
  );

  return {
    requests,
    pending,
    myRequests,
    agents,
    agentName,
    loading,
    isManagement,
    currentAdminId,
    hasPendingForLead,
    requestHandover,
    decide,
    reload: load,
  };
};
