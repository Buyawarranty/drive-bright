import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ShieldCheck, Clock, Check, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CLAIM_REASONS } from '@/hooks/useCommissionClaims';

interface Claim {
  id: string;
  claim_reason: string;
  claim_notes: string | null;
  evidence_type: string | null;
  deal_value: number | null;
  status: string;
  created_at: string;
  rejection_reason: string | null;
}

interface CommissionClaimsSectionProps {
  currentMonth: Date;
}

export function CommissionClaimsSection({ currentMonth }: CommissionClaimsSectionProps) {
  const { session } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString();
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const fetchClaims = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      // Get admin_user_id for this user
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!adminUser) { setClaims([]); return; }

      const { data, error } = await supabase
        .from('commission_claims')
        .select('*')
        .eq('agent_id', adminUser.id)
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClaims((data || []) as Claim[]);
    } catch (err) {
      console.error('Error fetching commission claims:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, monthStart, monthEnd]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const getReasonLabel = (value: string) =>
    CLAIM_REASONS.find(r => r.value === value)?.label || value;

  const statusConfig: Record<string, { icon: React.ElementType; label: string; className: string }> = {
    pending: { icon: Clock, label: 'Pending Review', className: 'bg-amber-100 text-amber-700' },
    approved: { icon: Check, label: 'Approved', className: 'bg-green-100 text-green-700' },
    rejected: { icon: XCircle, label: 'Rejected', className: 'bg-red-100 text-red-700' },
  };

  if (loading) return null;
  if (claims.length === 0) return null;

  const pending = claims.filter(c => c.status === 'pending').length;
  const approved = claims.filter(c => c.status === 'approved').length;
  const rejected = claims.filter(c => c.status === 'rejected').length;

  return (
    <div className="bg-white rounded-xl shadow-sm border">
      <div className="p-5 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <ShieldCheck className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Your Commission Claims</h3>
            <p className="text-sm text-gray-500">
              {pending > 0 && <span className="text-amber-600 font-medium">{pending} pending</span>}
              {approved > 0 && <span className="text-green-600 font-medium">{pending > 0 ? ' · ' : ''}{approved} approved</span>}
              {rejected > 0 && <span className="text-red-600 font-medium">{(pending > 0 || approved > 0) ? ' · ' : ''}{rejected} rejected</span>}
            </p>
          </div>
        </div>
      </div>

      <div className="max-h-[300px] overflow-y-auto divide-y">
        {claims.map(claim => {
          const config = statusConfig[claim.status] || statusConfig.pending;
          const Icon = config.icon;

          return (
            <div key={claim.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900">{getReasonLabel(claim.claim_reason)}</span>
                    {claim.deal_value != null && claim.deal_value > 0 && (
                      <span className="text-xs font-medium text-gray-500">£{claim.deal_value.toLocaleString()}</span>
                    )}
                  </div>
                  {claim.claim_notes && (
                    <p className="text-xs text-gray-500 truncate max-w-[220px]">{claim.claim_notes}</p>
                  )}
                  {claim.status === 'rejected' && claim.rejection_reason && (
                    <p className="text-xs text-red-600">Reason: {claim.rejection_reason}</p>
                  )}
                  <p className="text-[10px] text-gray-400">{format(new Date(claim.created_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                <Badge className={`${config.className} hover:${config.className} text-[10px] gap-1 flex-shrink-0`}>
                  <Icon className="h-2.5 w-2.5" />
                  {config.label}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
