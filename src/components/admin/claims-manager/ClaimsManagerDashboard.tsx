import React, { useMemo, useState, useEffect } from 'react';
import type { Claim as ClaimType, Claim } from '@/types/claim';
import { useClaims } from '@/hooks/useClaims';
import { Header } from './Header';
import { UrgencyBanner } from './UrgencyBanner';
import { ClaimsWorkbenchList } from './workbench/ClaimsWorkbenchList';
import { ClaimDrawer } from './workbench/ClaimDrawer';
import { BulkActionBar } from './workbench/BulkActionBar';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedDateFilter, periodToRange, type PeriodKey } from '@/components/admin/UnifiedDateFilter';
import type { DateRange } from 'react-day-picker';

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

const QUEUE_KEY = 'claims_active_queue';

interface ClaimsWorkbenchProps {
  /** Show the urgency banner above the workbench. Default true. */
  showUrgencyBanner?: boolean;
}

/**
 * Reusable Claims Workbench: queues sidebar + claims list + drawer.
 * Embed this anywhere — both the standalone /admin/claims dashboard and the
 * AdminDashboard Claims tab render the same workbench.
 */
export const ClaimsWorkbench: React.FC<ClaimsWorkbenchProps> = ({ showUrgencyBanner = true }) => {
  const { claims: allClaims, refetch } = useClaims();
  const [section, setSection] = useState<'active' | 'closed' | 'appeals'>(() => {
    const url = new URL(window.location.href);
    const s = url.searchParams.get('section');
    if (s === 'closed' || s === 'appeals') return s;
    return 'active';
  });
  const [selected, setSelected] = useState<Claim | null>(null);
  const [search, setSearch] = useState('');
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [datePeriod, setDatePeriod] = useState<PeriodKey>('all');
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);

  // Scope claims to current section before everything else.
  const claims = useMemo(() => {
    if (section === 'closed') {
      return allClaims.filter((c) => {
        const st = (c.rawStatus || '').toLowerCase();
        return c.status === 'closed' || ['closed', 'paid', 'resolved', 'rejected', 'declined', 'cancelled'].includes(st);
      });
    }
    if (section === 'appeals') {
      return allClaims.filter((c) => {
        const st = (c.rawStatus || '').toLowerCase();
        return c.status === 'appealed' || st === 'appealed' || st === 'appeal';
      });
    }
    // active: everything not closed/declined/cancelled/appealed
    return allClaims.filter((c) => {
      const st = (c.rawStatus || '').toLowerCase();
      if (c.status === 'closed' || c.status === 'appealed') return false;
      return !['closed', 'paid', 'resolved', 'rejected', 'declined', 'cancelled', 'appealed', 'appeal'].includes(st);
    });
  }, [allClaims, section]);

  useEffect(() => {
    localStorage.setItem(QUEUE_KEY, activeQueue);
    const url = new URL(window.location.href);
    if (activeQueue === 'all') url.searchParams.delete('queue');
    else url.searchParams.set('queue', activeQueue);
    if (section === 'active') url.searchParams.delete('section');
    else url.searchParams.set('section', section);
    window.history.replaceState({}, '', url.toString());
  }, [activeQueue, section]);

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

  const workbenchClaims = useMemo(() => {
    let list = [...claims];

    // Date filter — by claim opened date (parsed from formatted display date)
    const activeRange = datePeriod === 'custom' ? customRange : periodToRange(datePeriod);
    if (activeRange?.from) {
      const fromMs = new Date(activeRange.from.getFullYear(), activeRange.from.getMonth(), activeRange.from.getDate()).getTime();
      const toEnd = activeRange.to ?? activeRange.from;
      const toMs = new Date(toEnd.getFullYear(), toEnd.getMonth(), toEnd.getDate(), 23, 59, 59, 999).getTime();
      list = list.filter((c) => {
        const t = new Date(c.date).getTime();
        return !Number.isNaN(t) && t >= fromMs && t <= toMs;
      });
    }

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
  }, [claims, search, datePeriod, customRange]);

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
    <div className="space-y-4">
      {showUrgencyBanner && <UrgencyBanner claims={claims} />}

      {/* Section tabs: Active / Closed / Appeals */}
      <div className="flex gap-1 border-b border-border">
        {(['active', 'closed', 'appeals'] as const).map((s) => {
          const count = s === 'active'
            ? allClaims.filter((c) => {
                const st = (c.rawStatus || '').toLowerCase();
                if (c.status === 'closed' || c.status === 'appealed') return false;
                return !['closed','paid','resolved','rejected','declined','cancelled','appealed','appeal'].includes(st);
              }).length
            : s === 'closed'
            ? allClaims.filter((c) => {
                const st = (c.rawStatus || '').toLowerCase();
                return c.status === 'closed' || ['closed','paid','resolved','rejected','declined','cancelled'].includes(st);
              }).length
            : allClaims.filter((c) => {
                const st = (c.rawStatus || '').toLowerCase();
                return c.status === 'appealed' || st === 'appealed' || st === 'appeal';
              }).length;
          const label = s === 'active' ? 'Active' : s === 'closed' ? 'Closed' : 'Appeals';
          const isActive = section === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => { setSection(s); setActiveQueue('all'); setSelected(null); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${isActive ? 'border-orange-500 text-orange-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {label}
              <span className="ml-1.5 text-xs text-muted-foreground">({count})</span>
            </button>
          );
        })}
      </div>


      {/* Date filter bar — matches New Leads style */}
      <div className="rounded-lg border border-border bg-card px-3 py-2 flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</span>
        <UnifiedDateFilter
          scope="claim_opened"
          period={datePeriod}
          customRange={customRange}
          availableScopes={['claim_opened']}
          onChange={(next) => {
            setDatePeriod(next.period);
            setCustomRange(next.customRange);
          }}
        />
      </div>

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
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-base font-semibold text-foreground">
            {section === 'active' ? 'Active claims' : section === 'closed' ? 'Closed claims' : 'Appeals'}
          </h2>
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
        <ClaimDrawer claim={selected} onClose={() => setSelected(null)} onUpdated={refetch} />
      </div>
    </div>
  );
};

const ClaimsManagerDashboard: React.FC = () => (
  <div>
    <Header />
    <div className="p-4 lg:p-6">
      <ClaimsWorkbench />
    </div>
  </div>
);

export default ClaimsManagerDashboard;
