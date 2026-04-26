import React from 'react';
import { useClaims } from '@/hooks/useClaims';
import type { Claim } from '@/types/claim';
import { UrgencyBanner } from './UrgencyBanner';
import { ClaimsTable } from './ClaimsTable';

interface KpiCardProps {
  label: string;
  value: string | number;
  accent: string; // tailwind bg-* for top bar
  valueClass?: string; // tailwind text-* for the number
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, accent, valueClass = 'text-foreground' }) => (
  <div className="relative bg-card border border-border rounded-lg overflow-hidden shadow-sm">
    <div className={`h-[3px] w-full ${accent}`} />
    <div className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-2 text-3xl font-bold leading-none ${valueClass}`}>
        {value}
      </div>
    </div>
  </div>
);

interface KpiStripProps {
  claims: Claim[];
}

export const KpiStrip: React.FC<KpiStripProps> = ({ claims }) => {
  const totalOpen = claims.filter(c => c.status !== 'closed').length;
  const overdue = claims.filter(c => c.status === 'overdue').length;
  const needEvidence = claims.filter(c => c.status === 'evidence').length;
  const inReview = claims.filter(c => c.status === 'review').length;
  const highRisk = claims.filter(c => c.priority === 'critical').length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <KpiCard label="Total Open" value={totalOpen} accent="bg-slate-500" />
      <KpiCard label="Overdue" value={overdue} accent="bg-red-500" valueClass="text-red-600" />
      <KpiCard label="Need Evidence" value={needEvidence} accent="bg-amber-500" valueClass="text-amber-600" />
      <KpiCard label="In Review" value={inReview} accent="bg-blue-500" valueClass="text-blue-600" />
      <KpiCard label="High Risk" value={highRisk} accent="bg-amber-500" valueClass="text-amber-600" />
      <KpiCard label="Avg Resolution" value="11 days" accent="bg-gray-400" valueClass="text-gray-600" />
    </div>
  );
};

const ClaimsManagerDashboard: React.FC = () => {
  const { claims, count } = useClaims();
  return (
    <div className="p-6 space-y-4">
      <UrgencyBanner claims={claims} />
      <KpiStrip claims={claims} />
      <ClaimsTable claims={claims} />
      <p>Claims loaded: {count}</p>
    </div>
  );
};

export default ClaimsManagerDashboard;
