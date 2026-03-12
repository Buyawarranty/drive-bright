import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LeadCommissionClaim {
  id: string;
  agent_id: string;
  agent_name: string;
  status: string;
  claim_reason: string;
  deal_value: number;
  created_at: string;
}

/**
 * Fetches commission claims for a specific lead/customer.
 * Returns the most recent claim and the agent name.
 */
export function useLeadCommissionClaim(customerId: string | undefined) {
  const [claim, setClaim] = useState<LeadCommissionClaim | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchClaim = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('commission_claims')
        .select('id, agent_id, status, claim_reason, deal_value, created_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        setClaim(null);
        return;
      }

      // Fetch agent name
      const { data: agent } = await supabase
        .from('admin_users')
        .select('first_name, last_name, email')
        .eq('id', data.agent_id)
        .maybeSingle();

      const agentName = agent
        ? `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || agent.email.split('@')[0]
        : 'Unknown';

      setClaim({
        ...data,
        agent_name: agentName,
        deal_value: data.deal_value || 0,
      });
    } catch {
      setClaim(null);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchClaim();
  }, [fetchClaim]);

  return { claim, loading, refetch: fetchClaim };
}
