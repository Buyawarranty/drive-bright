import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Award, Check, X, Clock } from 'lucide-react';
import { CommissionClaim, CLAIM_REASONS, useCommissionClaims } from '@/hooks/useCommissionClaims';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface CommissionClaimReviewPanelProps {
  customerId: string;
  isAdmin: boolean;
  reviewerAdminId?: string;
  agentNames?: Record<string, string>;
}

export const CommissionClaimReviewPanel: React.FC<CommissionClaimReviewPanelProps> = ({
  customerId,
  isAdmin,
  reviewerAdminId,
  agentNames = {},
}) => {
  const [claims, setClaims] = useState<CommissionClaim[]>([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const { fetchClaimsForCustomer, reviewClaim, loading } = useCommissionClaims();

  useEffect(() => {
    fetchClaimsForCustomer(customerId).then(setClaims);
  }, [customerId, fetchClaimsForCustomer]);

  if (claims.length === 0) return null;

  const handleApprove = async (claimId: string) => {
    if (!reviewerAdminId) return;
    const success = await reviewClaim(claimId, reviewerAdminId, 'approved');
    if (success) {
      setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status: 'approved' as const, reviewed_at: new Date().toISOString() } : c));
    }
  };

  const handleReject = async (claimId: string) => {
    if (!reviewerAdminId || !rejectionReason.trim()) return;
    const success = await reviewClaim(claimId, reviewerAdminId, 'rejected', rejectionReason.trim());
    if (success) {
      setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status: 'rejected' as const, rejection_reason: rejectionReason.trim(), reviewed_at: new Date().toISOString() } : c));
      setRejectingId(null);
      setRejectionReason('');
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><Check className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><X className="h-3 w-3 mr-1" />Rejected</Badge>;
      default: return null;
    }
  };

  const getReasonLabel = (value: string) => CLAIM_REASONS.find(r => r.value === value)?.label || value;

  return (
    <div className="border-t pt-3 mt-3">
      <div className="flex items-center gap-2 mb-2">
        <Award className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-semibold">Commission Claims</span>
      </div>
      <div className="space-y-3">
        {claims.map(claim => (
          <div key={claim.id} className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">{agentNames[claim.agent_id] || 'Agent'}</span>
                {statusBadge(claim.status)}
              </div>
              <span className="text-xs text-muted-foreground">{format(new Date(claim.created_at), 'dd MMM yyyy HH:mm')}</span>
            </div>
            <div className="text-xs"><strong>Reason:</strong> {getReasonLabel(claim.claim_reason)}</div>
            {claim.claim_notes && <div className="text-xs"><strong>Notes:</strong> {claim.claim_notes}</div>}
            {claim.evidence_type && <div className="text-xs"><strong>Evidence:</strong> {claim.evidence_type.replace('_', ' ')}</div>}
            {claim.deal_value > 0 && <div className="text-xs"><strong>Deal value:</strong> £{claim.deal_value.toLocaleString()}</div>}
            {claim.rejection_reason && <div className="text-xs text-red-600"><strong>Rejection reason:</strong> {claim.rejection_reason}</div>}

            {isAdmin && claim.status === 'pending' && (
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50" onClick={() => handleApprove(claim.id)} disabled={loading}>
                  <Check className="h-3 w-3 mr-1" />Approve
                </Button>
                {rejectingId === claim.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Reason for rejection..."
                      rows={1}
                      className="text-xs h-7 min-h-[28px]"
                    />
                    <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleReject(claim.id)} disabled={loading || !rejectionReason.trim()}>
                      Confirm
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setRejectingId(null); setRejectionReason(''); }}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 text-xs text-red-700 border-red-300 hover:bg-red-50" onClick={() => setRejectingId(claim.id)} disabled={loading}>
                    <X className="h-3 w-3 mr-1" />Reject
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
