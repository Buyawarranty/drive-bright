import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Award } from 'lucide-react';
import { useLeadCommissionClaim } from '@/hooks/useLeadCommissionClaims';
import { cn } from '@/lib/utils';

interface CommissionClaimedBadgeProps {
  customerId: string;
}

/**
 * Lightweight badge that shows commission claim status on a customer row.
 * Renders nothing if no claim exists.
 */
export const CommissionClaimedBadge: React.FC<CommissionClaimedBadgeProps> = ({ customerId }) => {
  const { claim } = useLeadCommissionClaim(customerId);

  if (!claim) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] gap-0.5 w-fit",
        claim.status === 'approved' && "bg-green-50 text-green-700 border-green-300",
        claim.status === 'pending' && "bg-amber-50 text-amber-700 border-amber-300",
        claim.status === 'rejected' && "bg-red-50 text-red-700 border-red-300",
      )}
    >
      <Award className="h-2.5 w-2.5" />
      {claim.status === 'pending' ? 'Claimed' : claim.status === 'approved' ? 'Claim Approved' : 'Claim Rejected'}
      {claim.agent_name && <span className="ml-0.5">— {claim.agent_name}</span>}
    </Badge>
  );
};
