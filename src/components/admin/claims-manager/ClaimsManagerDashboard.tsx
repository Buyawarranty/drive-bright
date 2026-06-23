import React, { useMemo, useState, useEffect } from 'react';
import type { Claim as ClaimType, Claim } from '@/types/claim';
import { useClaims } from '@/hooks/useClaims';
import { Header } from './Header';
import { Toolbar, applyFilters, DEFAULT_FILTERS, type ClaimsFilters } from './Toolbar';
import { UrgencyBanner } from './UrgencyBanner';
import { ClaimsTable } from './ClaimsTable';
import { ClaimDetailPanel } from './ClaimDetailPanel';
import { QueuesPanel } from './workbench/QueuesPanel';
import { ClaimsWorkbenchList } from './workbench/ClaimsWorkbenchList';
import { ClaimDrawer } from './workbench/ClaimDrawer';
import { BulkActionBar } from './workbench/BulkActionBar';
import { QUEUES, type QueueKey } from './workbench/queues';
import { LayoutGrid, Table as TableIcon, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

// Re-exported KpiStrip kept for consumers that still embed it elsewhere.
interface KpiCardProps { label: string; value: string | number; accent: string; valueClass?: string }
const KpiCard: React.FC<KpiCardProps> = ({ label, value, accent, valueClass = 'text-foreground' }) => (
  <div className="relative bg-card border border-border rounded-lg overflow-hidden shadow-sm">
    <div className={`h-[3px] w-full ${accent}`} />
    <div className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-2 text-3xl font-bold leading-none ${valueClass}`}>{value}</div>
    </div>
  </div>
);
export const KpiStrip: React.FC<{ claims: ClaimType[]; avgResolutionDays?: number }> = ({ claims, avgResolutionDays }) => {
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



type ViewMode = 'workbench' | 'classic';
const VIEW_KEY = 'claims_view_mode';
const QUEUE_KEY = 'claims_active_queue';

const ClaimsManagerDashboard: React.FC = () => {
  const { claims, refetch } = useClaims();
  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem(VIEW_KEY) as ViewMode) || 'workbench');
  const [activeQueue, setActiveQueue] = useState<QueueKey>(() => {
    const url = new URL(window.location.href);
    const q = url.searchParams.get('queue') as QueueKey | null;
    return q || (localStorage.getItem(QUEUE_KEY) as QueueKey) || 'all';
  });
  const [selected, setSelected] = useState<Claim | null>(null);
  const [search, setSearch] = useState('');
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);

  // Classic-view state (kept for parity toggle)
  const [filters, setFilters] = useState<ClaimsFilters>(DEFAULT_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem(QUEUE_KEY, activeQueue);
    const url = new URL(window.location.href);
    if (activeQueue === 'all') url.searchParams.delete('queue');
    else url.searchParams.set('queue', activeQueue);
    window.history.replaceState({}, '', url.toString());
  }, [activeQueue]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      const { data: row } = await supabase.from('admin_users').select('first_name,last_name,email').eq('user_id', uid).maybeSingle();
      if (row) {
        const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.email || null;
        setCurrentUserName(name);
      }
    })();
  }, []);

  const queueDef = useMemo(() => QUEUES.find((q) => q.key === activeQueue) ?? QUEUES[0], [activeQueue]);

  const workbenchClaims = useMemo(() => {
    const ctx = { currentUserName };
    let list = claims.filter((c) => queueDef.match(c, ctx));
    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (c) =>
          c.customerName.toLowerCase().includes(term) ||
          c.reg.toLowerCase().includes(term) ||
          c.email.toLowerCase().includes(term) ||
          c.issue.toLowerCase().includes(term) ||
          c.id.toLowerCase().includes(term),
      );
    }
    return list;
  }, [claims, queueDef, search, currentUserName]);

  // Keep selection in sync with refreshed data
  useEffect(() => {
    if (!selected) return;
    const fresh = claims.find((c) => c.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
  }, [claims, selected]);

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
      if (checked) workbenchClaims.forEach((c) => next.add(c.id));
      else workbenchClaims.forEach((c) => next.delete(c.id));
      return next;
    });

  return (
    <div>
      <Header />
      <div className="p-4 lg:p-6 space-y-4">
        <UrgencyBanner claims={claims} />

        {/* Toolbar: search + view toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, reg, email, claim ref…"
              className="w-full h-9 pl-8 pr-3 rounded-md border border-border bg-card text-sm"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <LayoutGrid className="h-3.5 w-3.5 text-primary" />
              {view === 'workbench' ? 'Workbench' : 'Classic table'}
            </span>
            <button
              type="button"
              onClick={() => setView(view === 'workbench' ? 'classic' : 'workbench')}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              {view === 'workbench' ? 'Switch to classic table' : 'Switch to workbench'}
            </button>
          </div>
        </div>

        {view === 'workbench' ? (
          <div className="flex flex-col lg:flex-row gap-4 items-start">
            <QueuesPanel
              claims={claims}
              activeQueue={activeQueue}
              onSelectQueue={setActiveQueue}
              ctx={{ currentUserName }}
            />
            <div className="flex-1 min-w-0 w-full flex flex-col gap-2">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-base font-semibold text-foreground">{queueDef.label}</h2>
                <span className="text-xs text-muted-foreground">
                  {workbenchClaims.length} claim{workbenchClaims.length === 1 ? '' : 's'}
                </span>
              </div>
              <BulkActionBar
                selectedIds={selectedIds}
                onClear={() => setSelectedIds(new Set())}
                onDone={refetch}
              />
              <ClaimsWorkbenchList
                claims={workbenchClaims}
                selectedId={selected?.id}
                onSelect={setSelected}
                selectedIds={selectedIds}
                onToggleOne={toggleOne}
                onToggleAll={toggleAll}
                onUpdated={refetch}
              />
            </div>
            <ClaimDrawer claim={selected} onClose={() => setSelected(null)} onUpdated={refetch} />
          </div>
        ) : (
          <>
            <Toolbar filters={filters} onChange={setFilters} claims={claims} />
            <ClaimsTable
              claims={applyFilters(claims, filters)}
              onRowClick={setSelected}
              selectedId={selected?.id ?? null}
              selectedIds={selectedIds}
              onToggleOne={toggleOne}
              onToggleAll={toggleAll}
              onUpdated={refetch}
            />
            {selected && <ClaimDetailPanel claim={selected} onClose={() => setSelected(null)} onUpdated={refetch} />}
          </>
        )}
      </div>
    </div>
  );
};

export default ClaimsManagerDashboard;
