import React, { useMemo, useState } from 'react';
import { useClaims } from '@/hooks/useClaims';
import type { Claim } from '@/types/claim';
import { UrgencyBanner } from './UrgencyBanner';
import { ClaimsTable } from './ClaimsTable';
import { ClaimDetailPanel } from './ClaimDetailPanel';
import { Toolbar, applyFilters, DEFAULT_FILTERS, type ClaimsFilters } from './Toolbar';
import { BulkActionsBar } from './BulkActionsBar';
import { Header } from './Header';
import { DateNavigator, getRange, type DateRangeValue } from './DateNavigator';

interface KpiCardProps {
  label: string;
  value: string | number;
  accent: string;
  valueClass?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, accent, valueClass = 'text-foreground' }) => (
  <div className="relative bg-card border border-border rounded-lg overflow-hidden shadow-sm">
    <div className={`h-[3px] w-full ${accent}`} />
    <div className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-2 text-3xl font-bold leading-none ${valueClass}`}>{value}</div>
    </div>
  </div>
);

interface KpiStripProps {
  claims: Claim[];
  avgResolutionDays?: number;
}

export const KpiStrip: React.FC<KpiStripProps> = ({ claims, avgResolutionDays }) => {
  const totalOpen = claims.filter((c) => c.status !== 'closed').length;
  const overdue = claims.filter((c) => c.status === 'overdue').length;
  const needEvidence = claims.filter((c) => c.status === 'evidence').length;
  const inReview = claims.filter((c) => c.status === 'review').length;
  const highRisk = claims.filter((c) => c.priority === 'critical').length;
  const avgLabel = avgResolutionDays && avgResolutionDays > 0 ? `${avgResolutionDays}d` : '—';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <KpiCard label="Total Open" value={totalOpen} accent="bg-slate-500" />
      <KpiCard label="Overdue" value={overdue} accent="bg-red-500" valueClass="text-red-600" />
      <KpiCard label="Need Evidence" value={needEvidence} accent="bg-amber-500" valueClass="text-amber-600" />
      <KpiCard label="In Review" value={inReview} accent="bg-blue-500" valueClass="text-blue-600" />
      <KpiCard label="High Risk" value={highRisk} accent="bg-amber-500" valueClass="text-amber-600" />
      <KpiCard label="Avg Resolution" value={avgLabel} accent="bg-gray-400" valueClass="text-gray-600" />
    </div>
  );
};

const ClaimsManagerDashboard: React.FC = () => {
  const { claims } = useClaims();
  const [filters, setFilters] = useState<ClaimsFilters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<Claim | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const filtered = useMemo(() => applyFilters(claims, filters), [claims, filters]);

  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = (checked: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) filtered.forEach((c) => next.add(c.id));
      else filtered.forEach((c) => next.delete(c.id));
      return next;
    });

  return (
    <div>
      <Header />
      <div className="p-6 space-y-4">
        <UrgencyBanner claims={claims} />
        <KpiStrip claims={claims} />
        <Toolbar filters={filters} onChange={setFilters} claims={claims} />
        <div className="px-1 text-sm text-muted-foreground">
          51 total · <span className="font-semibold text-foreground">{filtered.length}</span> shown
        </div>
        {selectedIds.size > 0 && (
          <BulkActionsBar count={selectedIds.size} onClear={() => setSelectedIds(new Set())} />
        )}
        <ClaimsTable
          claims={filtered}
          onRowClick={setSelected}
          selectedId={selected?.id ?? null}
          selectedIds={selectedIds}
          onToggleOne={toggleOne}
          onToggleAll={toggleAll}
        />
        {selected && <ClaimDetailPanel claim={selected} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
};

export default ClaimsManagerDashboard;
