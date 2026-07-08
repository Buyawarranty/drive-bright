import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Claim as ClaimType, Claim } from '@/types/claim';
import { useClaims } from '@/hooks/useClaims';
import { Header } from './Header';
import { UrgencyBanner } from './UrgencyBanner';
import { ClaimsWorkbenchList } from './workbench/ClaimsWorkbenchList';
import { ClaimDrawer } from './workbench/ClaimDrawer';
import { BulkActionBar } from './workbench/BulkActionBar';
import { ClaimReminderBanner } from './ClaimReminderBanner';
import { deriveStage, STAGE_META, stageOrder, type WorkflowStage } from './workbench/statusMap';
import { SIMPLE_STATUSES, deriveSimpleStatus, type SimpleStatus } from './workbench/ClaimsWorkbenchList';
import { Search, X } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedDateFilter, periodToRange, type PeriodKey } from '@/components/admin/UnifiedDateFilter';
import type { DateRange } from 'react-day-picker';

interface KpiCardProps { label: string; value: string | number; accent: string }
const KpiCard: React.FC<KpiCardProps> = ({ label, value, accent }) => (
  <div className="relative bg-card border border-border rounded-lg overflow-hidden shadow-sm">
    <div className={`h-[3px] w-full ${accent}`} />
    <div className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">{label}</div>
      <div className="mt-2 text-3xl font-bold leading-none text-slate-900">{value}</div>
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
      <KpiCard label="Overdue" value={overdue} accent="bg-orange-500" />
      <KpiCard label="Need Evidence" value={needEvidence} accent="bg-orange-400" />
      <KpiCard label="In Review" value={inReview} accent="bg-blue-600" />
      <KpiCard label="High Risk" value={highRisk} accent="bg-orange-600" />
      <KpiCard label="Avg Resolution" value={avgLabel} accent="bg-slate-400" />
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
  const navigate = useNavigate();
  const openClaim = useCallback((c: Claim) => {
    navigate(`/admin/claims/${c.id}`);
  }, [navigate]);
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
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [statusFilter, setStatusFilter] = useState<SimpleStatus | 'all'>('all');

  // Compute per-customer claim ordinals across ALL claims (any status),
  // matched by normalized email OR phone. Oldest claim = #1.
  const ordinalById = useMemo(() => {
    const norm = (v?: string | null) => (v || '').trim().toLowerCase();
    const normPhone = (v?: string | null) => (v || '').replace(/\D+/g, '').replace(/^0+/, '');

    // Union-find over emails and phones so records sharing either identifier
    // collapse into the same customer bucket.
    const parent = new Map<string, string>();
    const find = (k: string): string => {
      const p = parent.get(k);
      if (!p || p === k) { parent.set(k, k); return k; }
      const r = find(p); parent.set(k, r); return r;
    };
    const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };

    for (const c of allClaims) {
      const eKey = norm(c.email) ? `e:${norm(c.email)}` : null;
      const pKey = normPhone(c.phone) ? `p:${normPhone(c.phone)}` : null;
      if (eKey) find(eKey);
      if (pKey) find(pKey);
      if (eKey && pKey) union(eKey, pKey);
    }

    // Bucket claims by root key
    const buckets = new Map<string, ClaimType[]>();
    const claimKey = new Map<string, string>();
    for (const c of allClaims) {
      const eKey = norm(c.email) ? `e:${norm(c.email)}` : null;
      const pKey = normPhone(c.phone) ? `p:${normPhone(c.phone)}` : null;
      const anchor = eKey || pKey;
      if (!anchor) continue;
      const root = find(anchor);
      claimKey.set(c.id, root);
      if (!buckets.has(root)) buckets.set(root, []);
      buckets.get(root)!.push(c);
    }

    const out = new Map<string, { index: number; total: number; matchedBy: 'email' | 'phone' | 'both' | null }>();
    for (const [, list] of buckets) {
      // Oldest first → ordinal 1 is the earliest claim
      const sorted = [...list].sort((a, b) => (b.ageInDays ?? 0) - (a.ageInDays ?? 0) === 0 ? 0 : (b.ageInDays ?? 0) - (a.ageInDays ?? 0));
      // higher ageInDays = older, so oldest first
      sorted.sort((a, b) => (b.ageInDays ?? 0) - (a.ageInDays ?? 0));
      const total = sorted.length;
      sorted.forEach((c, i) => {
        // determine how THIS claim matches others in its bucket
        const others = sorted.filter((o) => o.id !== c.id);
        const shareEmail = others.some((o) => norm(o.email) && norm(o.email) === norm(c.email));
        const sharePhone = others.some((o) => normPhone(o.phone) && normPhone(o.phone) === normPhone(c.phone));
        let matchedBy: 'email' | 'phone' | 'both' | null = null;
        if (shareEmail && sharePhone) matchedBy = 'both';
        else if (shareEmail) matchedBy = 'email';
        else if (sharePhone) matchedBy = 'phone';
        out.set(c.id, { index: i + 1, total, matchedBy });
      });
    }
    return out;
  }, [allClaims]);

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
    const url = new URL(window.location.href);
    url.searchParams.delete('queue');
    if (section === 'active') url.searchParams.delete('section');
    else url.searchParams.set('section', section);
    window.history.replaceState({}, '', url.toString());
  }, [section]);

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
    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter((c) => deriveSimpleStatus(c) === statusFilter);
    }
    // Enrich with per-customer ordinal (matched by email OR phone)
    list = list.map((c) => {
      const o = ordinalById.get(c.id);
      if (!o || o.total < 2) return c;
      return { ...c, customerClaimIndex: o.index, customerClaimTotal: o.total, customerClaimMatchedBy: o.matchedBy };
    });
    // Sort by recency
    list.sort((a, b) => {
      const av = a.ageInDays ?? 0;
      const bv = b.ageInDays ?? 0;
      return sortOrder === 'newest' ? av - bv : bv - av;
    });
    return list;
  }, [claims, search, datePeriod, customRange, ordinalById, sortOrder, statusFilter]);

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

  // Available statuses within the current section, with counts (respects search/date/section)
  const statusCounts = useMemo(() => {
    const base = workbenchClaims; // already filtered by section/search/date, then re-included by status; recompute pre-status:
    // Recompute pre-status list to keep counts stable regardless of current statusFilter
    let list = [...claims];
    const activeRange = datePeriod === 'custom' ? customRange : periodToRange(datePeriod);
    if (activeRange?.from) {
      const fromMs = new Date(activeRange.from.getFullYear(), activeRange.from.getMonth(), activeRange.from.getDate()).getTime();
      const toEnd = activeRange.to ?? activeRange.from;
      const toMs = new Date(toEnd.getFullYear(), toEnd.getMonth(), toEnd.getDate(), 23, 59, 59, 999).getTime();
      list = list.filter((c) => { const t = new Date(c.date).getTime(); return !Number.isNaN(t) && t >= fromMs && t <= toMs; });
    }
    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter((c) =>
        c.customerName.toLowerCase().includes(term) || c.reg.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) || c.issue.toLowerCase().includes(term) || c.id.toLowerCase().includes(term));
    }
    const counts = new Map<SimpleStatus, number>();
    for (const c of list) {
      const s = deriveSimpleStatus(c);
      counts.set(s, (counts.get(s) || 0) + 1);
    }
    return { counts, total: list.length };
  }, [claims, search, datePeriod, customRange]);

  return (
    <div className="space-y-4">
      <ClaimReminderBanner onOpenClaim={(id) => {
        const c = allClaims.find((x) => x.id === id);
        if (c) setSelected(c);
      }} />
      {showUrgencyBanner && <UrgencyBanner claims={claims} />}

      {/* Section tabs: Active / Closed / Appeals + quick date shortcuts */}
      <div className="flex items-center gap-1 border-b border-border flex-wrap">
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
              onClick={() => { setSection(s); setSelected(null); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${isActive ? 'border-orange-500 text-orange-600' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {label}
              <span className="ml-1.5 text-xs text-muted-foreground">({count})</span>
            </button>
          );
        })}

        {/* Quick date shortcuts — mirror the ones removed from the date filter */}
        <div className="ml-4 flex items-center gap-3 pb-1">
          {([
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'this_month', label: 'This month' },
            { key: 'last_month', label: 'Last month' },
            { key: '30days', label: 'Show last 30 days' },
          ] as const).map((q) => {
            const isActive = datePeriod === q.key;
            return (
              <button
                key={q.key}
                type="button"
                onClick={() => { setDatePeriod(q.key); setCustomRange(undefined); }}
                className={`text-sm hover:underline whitespace-nowrap ${isActive ? 'text-orange-600 font-semibold' : 'text-primary'}`}
              >
                {q.label}
              </button>
            );
          })}
        </div>
      </div>


      {/* Unified filter bar: search + date + sort + clear */}
      <div className="rounded-lg border border-border bg-card px-3 py-2 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-yellow-600" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, reg, email, claim ref…"
            className="w-full h-9 pl-8 pr-3 rounded-md border border-yellow-200 bg-yellow-50 text-sm placeholder:text-yellow-700/50 focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:border-yellow-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</span>
          <UnifiedDateFilter
            scope="claim_opened"
            period={datePeriod}
            customRange={customRange}
            availableScopes={['claim_opened']}
            hideQuickLinks
            onChange={(next) => {
              setDatePeriod(next.period);
              setCustomRange(next.customRange);
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SimpleStatus | 'all')}
            className="h-9 px-2 rounded-md border border-border bg-card text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
          >
            <option value="all">All statuses ({statusCounts.total})</option>
            {SIMPLE_STATUSES
              .filter((s) => (statusCounts.counts.get(s.value) || 0) > 0)
              .map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label} ({statusCounts.counts.get(s.value) || 0})
                </option>
              ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sort</span>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            {(['newest', 'oldest'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setSortOrder(v)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                  sortOrder === v ? 'bg-orange-500 text-white' : 'bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                {v === 'newest' ? 'Newest first' : 'Oldest first'}
              </button>
            ))}
          </div>
        </div>

        {(search || datePeriod !== 'all' || customRange || sortOrder !== 'newest' || statusFilter !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setDatePeriod('all');
              setCustomRange(undefined);
              setSortOrder('newest');
              setStatusFilter('all');
            }}
            className="ml-auto inline-flex items-center gap-1 px-2.5 h-9 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            title="Clear all filters"
          >
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
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
          onSelect={openClaim}
          selectedIds={selectedIds}
          onToggleOne={toggleOne}
          onToggleAll={toggleAll}
          onUpdated={refetch}
        />
        <Sheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
          <SheetContent
            side="right"
            className="p-0 w-full sm:max-w-[560px] lg:max-w-[640px] xl:max-w-[720px] overflow-hidden flex flex-col bg-background"
          >
            {selected && (
              <ClaimDrawer
                claim={selected}
                onClose={() => setSelected(null)}
                onUpdated={refetch}
                fullPage
              />
            )}
          </SheetContent>
        </Sheet>
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
