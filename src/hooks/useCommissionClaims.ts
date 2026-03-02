import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CommissionClaim {
  id: string;
  customer_id: string;
  lead_id: string | null;
  agent_id: string;
  claim_reason: string;
  claim_notes: string | null;
  evidence_type: string | null;
  deal_value: number;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export const CLAIM_REASONS = [
  { value: 'phone_call', label: 'Closed via phone call' },
  { value: 'email_follow_up', label: 'Email follow-up led to purchase' },
  { value: 'quote_sent', label: 'Sent quote, customer bought online' },
  { value: 'whatsapp', label: 'WhatsApp conversation led to sale' },
  { value: 'in_person', label: 'In-person / video call' },
  { value: 'other', label: 'Other (explain in notes)' },
];

export const EVIDENCE_TYPES = [
  { value: 'call_log', label: 'Call log / recording' },
  { value: 'email_thread', label: 'Email thread' },
  { value: 'quote_reference', label: 'Quote sent reference' },
  { value: 'chat_screenshot', label: 'Chat / WhatsApp screenshot' },
  { value: 'other', label: 'Other evidence' },
];

export function useCommissionClaims() {
  const [loading, setLoading] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);

  // Resolve the current user's admin_users.id on mount
  useEffect(() => {
    const resolve = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setCurrentAdminId(data.id);
    };
    resolve();
  }, []);

  const submitClaim = useCallback(async (data: {
    customer_id: string;
    lead_id?: string;
    agent_id: string;
    claim_reason: string;
    claim_notes: string;
    evidence_type?: string;
    deal_value?: number;
  }) => {
    setLoading(true);
    try {
      // Always use the authenticated user's admin ID to satisfy RLS
      const agentId = currentAdminId || data.agent_id;

      const { error } = await supabase
        .from('commission_claims')
        .insert({
          customer_id: data.customer_id,
          lead_id: data.lead_id || null,
          agent_id: agentId,
          claim_reason: data.claim_reason,
          claim_notes: data.claim_notes,
          evidence_type: data.evidence_type || null,
          deal_value: data.deal_value || 0,
        });

      if (error) throw error;
      toast.success('Commission claim submitted for admin review');
      return true;
    } catch (err: any) {
      toast.error('Failed to submit claim: ' + err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [currentAdminId]);

  const reviewClaim = useCallback(async (
    claimId: string,
    reviewerAdminId: string,
    decision: 'approved' | 'rejected',
    rejectionReason?: string
  ) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('commission_claims')
        .update({
          status: decision,
          reviewed_by: reviewerAdminId,
          reviewed_at: new Date().toISOString(),
          rejection_reason: decision === 'rejected' ? rejectionReason : null,
        })
        .eq('id', claimId);

      if (error) throw error;
      toast.success(`Claim ${decision}`);
      return true;
    } catch (err: any) {
      toast.error('Failed to review claim: ' + err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClaimsForCustomer = useCallback(async (customerId: string) => {
    const { data, error } = await supabase
      .from('commission_claims')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching claims:', error);
      return [];
    }
    return (data || []) as CommissionClaim[];
  }, []);

  const fetchAllPendingClaims = useCallback(async () => {
    const { data, error } = await supabase
      .from('commission_claims')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending claims:', error);
      return [];
    }
    return (data || []) as CommissionClaim[];
  }, []);

  return { submitClaim, reviewClaim, fetchClaimsForCustomer, fetchAllPendingClaims, loading };
}
