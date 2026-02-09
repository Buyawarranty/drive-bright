import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Clock, FileQuestion, PoundSterling, Shield, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TriageFilter = 
  | 'all' 
  | 'overdue' 
  | 'high_risk' 
  | 'evidence_missing' 
  | 'high_cost' 
  | 'awaiting_estimate';

interface TriageBlock {
  id: TriageFilter;
  label: string;
  icon: React.ReactNode;
  count: number;
  color: string;
  dotColor: string;
}

interface ClaimData {
  id: string;
  status: string;
  priority?: string;
  payment_amount?: number;
  created_at: string;
  file_url?: string;
  claim_reason?: string;
}

interface ClaimsTriageBlocksProps {
  claims: ClaimData[];
  activeFilter: TriageFilter;
  onFilterChange: (filter: TriageFilter) => void;
  avgResolutionDays: number;
}

const isOverdue = (claim: ClaimData) => {
  const days = Math.floor((Date.now() - new Date(claim.created_at).getTime()) / (1000 * 60 * 60 * 24));
  return days > 7 && !['paid', 'resolved', 'rejected'].includes(claim.status);
};

const isHighRisk = (claim: ClaimData) => {
  return claim.priority === 'urgent' || claim.priority === 'high';
};

const isEvidenceMissing = (claim: ClaimData) => {
  return claim.status === 'awaiting_info' || (!claim.file_url && !['paid', 'resolved', 'rejected'].includes(claim.status));
};

const isHighCost = (claim: ClaimData) => {
  return (claim.payment_amount || 0) > 1000;
};

const isAwaitingEstimate = (claim: ClaimData) => {
  return claim.status === 'new' || claim.status === 'in_progress';
};

export const getTriageFilterFn = (filter: TriageFilter) => {
  switch (filter) {
    case 'overdue': return isOverdue;
    case 'high_risk': return isHighRisk;
    case 'evidence_missing': return isEvidenceMissing;
    case 'high_cost': return isHighCost;
    case 'awaiting_estimate': return isAwaitingEstimate;
    default: return () => true;
  }
};

export const ClaimsTriageBlocks: React.FC<ClaimsTriageBlocksProps> = ({
  claims,
  activeFilter,
  onFilterChange,
  avgResolutionDays,
}) => {
  const openClaims = claims.filter(c => !['paid', 'resolved', 'rejected'].includes(c.status));

  const blocks: TriageBlock[] = [
    {
      id: 'all',
      label: 'Total Open Claims',
      icon: <Shield className="h-5 w-5" />,
      count: openClaims.length,
      color: 'border-blue-200 hover:border-blue-400',
      dotColor: 'bg-blue-500',
    },
    {
      id: 'overdue',
      label: 'Overdue Claims',
      icon: <Clock className="h-5 w-5" />,
      count: claims.filter(isOverdue).length,
      color: 'border-red-200 hover:border-red-400',
      dotColor: 'bg-red-500',
    },
    {
      id: 'high_risk',
      label: 'High-Risk Claims',
      icon: <AlertTriangle className="h-5 w-5" />,
      count: claims.filter(isHighRisk).length,
      color: 'border-orange-200 hover:border-orange-400',
      dotColor: 'bg-orange-500',
    },
    {
      id: 'evidence_missing',
      label: 'Evidence Needed',
      icon: <FileQuestion className="h-5 w-5" />,
      count: claims.filter(isEvidenceMissing).length,
      color: 'border-amber-200 hover:border-amber-400',
      dotColor: 'bg-amber-500',
    },
    {
      id: 'awaiting_estimate',
      label: 'Awaiting Review',
      icon: <PoundSterling className="h-5 w-5" />,
      count: claims.filter(isAwaitingEstimate).length,
      color: 'border-green-200 hover:border-green-400',
      dotColor: 'bg-green-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {blocks.map((block) => (
        <Card
          key={block.id}
          className={cn(
            'cursor-pointer transition-all border-2',
            block.color,
            activeFilter === block.id && 'ring-2 ring-offset-1 ring-primary shadow-md'
          )}
          onClick={() => onFilterChange(activeFilter === block.id && block.id !== 'all' ? 'all' : block.id)}
        >
          <CardContent className="p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className={cn('h-2.5 w-2.5 rounded-full', block.dotColor)} />
              <span className="text-xs font-medium text-muted-foreground truncate">{block.label}</span>
            </div>
            <div className="text-3xl font-bold tracking-tight">{block.count}</div>
          </CardContent>
        </Card>
      ))}
      {/* Avg Resolution Time */}
      <Card className="border-2 border-slate-200">
        <CardContent className="p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Avg Resolution</span>
          </div>
          <div className="text-3xl font-bold tracking-tight">
            {avgResolutionDays}<span className="text-base font-normal text-muted-foreground ml-1">days</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
