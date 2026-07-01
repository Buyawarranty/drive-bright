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
    <div className="bg-slate-100 text-slate-900 border border-slate-300 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center gap-4 shadow-sm">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="shrink-0 mt-0.5">
          <Flame className="h-6 w-6 text-orange-500" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="text-base font-semibold leading-tight text-slate-900">
            Action required: {overdueCount} claims are overdue — {criticalCount} are high-risk
          </div>
          <div className="text-sm text-slate-700 mt-1">
            Average resolution time is {avgLabel}. {evidenceCount} claims waiting on customer evidence.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end shrink-0">
        <button
          type="button"
          className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white text-slate-900 border border-slate-400 hover:bg-slate-50 transition-colors"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-orange-500 mr-1.5 align-middle" />
          {overdueCount} Overdue
        </button>
        <button
          type="button"
          className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white text-slate-900 border border-slate-400 hover:bg-slate-50 transition-colors"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-orange-400 mr-1.5 align-middle" />
          {evidenceCount} Need Evidence
        </button>
        <button
          type="button"
          className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white text-slate-900 border border-slate-400 hover:bg-slate-50 transition-colors"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-blue-600 mr-1.5 align-middle" />
          {inReviewCount} In Review
        </button>
      </div>
    </div>
  );
};
