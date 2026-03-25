import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LeadAccessRequest {
  id: string;
  lead_id: string;
  requested_by: string;
  approved_by: string | null;
  status: 'pending' | 'approved' | 'denied';
  reason: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export const useLeadAccessRequests = (leadIds: string[], currentAdminUserId: string | null) => {
  const queryClient = useQueryClient();

  // Fetch access requests for current user's leads
  const { data: accessRequests = [] } = useQuery({
    queryKey: ['lead-access-requests', currentAdminUserId],
    queryFn: async () => {
      if (!currentAdminUserId) return [];
      const { data, error } = await supabase
        .from('lead_access_requests')
        .select('*')
        .eq('requested_by', currentAdminUserId);
      if (error) throw error;
      return (data || []) as LeadAccessRequest[];
    },
    enabled: !!currentAdminUserId,
  });

  // Check if current user has approved access for a specific lead
  const hasApprovedAccess = (leadId: string): boolean => {
    return accessRequests.some(
      r => r.lead_id === leadId && r.status === 'approved'
    );
  };

  // Check if request is pending
  const hasPendingRequest = (leadId: string): boolean => {
    return accessRequests.some(
      r => r.lead_id === leadId && r.status === 'pending'
    );
  };

  // Request access to a paid lead
  const requestAccess = useMutation({
    mutationFn: async ({ leadId, reason }: { leadId: string; reason: string }) => {
      if (!currentAdminUserId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('lead_access_requests')
        .upsert({
          lead_id: leadId,
          requested_by: currentAdminUserId,
          reason,
          status: 'pending',
        }, { onConflict: 'lead_id,requested_by' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Access request sent to admin for approval');
      queryClient.invalidateQueries({ queryKey: ['lead-access-requests'] });
    },
    onError: () => {
      toast.error('Failed to send access request');
    },
  });

  return { accessRequests, hasApprovedAccess, hasPendingRequest, requestAccess };
};

// Hook for admins to manage all pending requests
export const usePendingAccessRequests = () => {
  const queryClient = useQueryClient();

  const { data: pendingRequests = [], isLoading } = useQuery({
    queryKey: ['lead-access-requests-pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_access_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as LeadAccessRequest[];
    },
    refetchInterval: 30000,
  });

  const reviewRequest = useMutation({
    mutationFn: async ({ requestId, status, approvedBy }: { requestId: string; status: 'approved' | 'denied'; approvedBy: string }) => {
      const { error } = await supabase
        .from('lead_access_requests')
        .update({
          status,
          approved_by: approvedBy,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(`Access request ${vars.status}`);
      queryClient.invalidateQueries({ queryKey: ['lead-access-requests'] });
    },
    onError: () => {
      toast.error('Failed to update request');
    },
  });

  return { pendingRequests, isLoading, reviewRequest };
};
