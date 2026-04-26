import React from 'react';
import { Flame } from 'lucide-react';
import type { Claim } from '@/types/claim';

interface UrgencyBannerProps {
  claims: Claim[];
  avgResolutionDays?: number;
}

export const UrgencyBanner: React.FC<UrgencyBannerProps> = ({ claims, avgResolutionDays }) => {
  const overdueCount = claims.filter(c => c.status === 'overdue').length;
  const criticalCount = claims.filter(c => c.priority === 'critical').length;
  const evidenceCount = claims.filter(c => c.status === 'evidence').length;
  const inReviewCount = claims.filter(c => c.status === 'review').length;
  const avgLabel = avgResolutionDays && avgResolutionDays > 0 ? `${avgResolutionDays} days` : '—';

  return (
    <div className="bg-slate-900 text-white rounded-lg p-5 flex flex-col lg:flex-row lg:items-center gap-4 shadow-md">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="shrink-0 mt-0.5">
          <Flame className="h-6 w-6 text-orange-400" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="text-base font-semibold leading-tight">
            Action required: {overdueCount} claims are overdue — {criticalCount} are high-risk
          </div>
          <div className="text-sm text-slate-300 mt-1">
            Average resolution time is {avgLabel}. {evidenceCount} claims waiting on customer evidence.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end shrink-0">
        <button
          type="button"
          className="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-200 border border-red-400/40 hover:bg-red-500/30 transition-colors"
        >
          {overdueCount} Overdue
        </button>
        <button
          type="button"
          className="px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-200 border border-amber-400/40 hover:bg-amber-500/30 transition-colors"
        >
          {evidenceCount} Need Evidence
        </button>
        <button
          type="button"
          className="px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/40 hover:bg-blue-500/30 transition-colors"
        >
          {inReviewCount} In Review
        </button>
      </div>
    </div>
  );
};
