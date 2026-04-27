import React from 'react';
import { Search, X } from 'lucide-react';
import type { Claim } from '@/types/claim';

export interface ClaimsFilters {
  search: string;
  status: 'all' | Claim['status'];
  priority: 'all' | Claim['priority'];
  assignee: 'all' | 'Sarah' | 'James' | 'Priya' | 'unassigned';
  month: string; // 'all' or 'YYYY-MM'
  amount: 'all' | '0' | '0-500' | '500-1500' | '1500+';
}

export const DEFAULT_FILTERS: ClaimsFilters = {
  search: '',
  status: 'all',
  priority: 'all',
  assignee: 'all',
  month: 'all',
  amount: 'all',
};

interface ToolbarProps {
  filters: ClaimsFilters;
  onChange: (next: ClaimsFilters) => void;
  claims?: Claim[];
}

const selectCls =
  'h-9 px-2 rounded-md border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

// Parse the formatted display date (e.g. "23 Apr 2026") back to YYYY-MM
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const claimYearMonth = (c: Claim): string | null => {
  const parts = (c.date || '').split(' ');
  if (parts.length < 3) return null;
  const mi = MONTHS.indexOf(parts[1]);
  const y = parseInt(parts[2], 10);
  if (mi < 0 || !Number.isFinite(y)) return null;
  return `${y}-${String(mi + 1).padStart(2, '0')}`;
};

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-');
  const mi = parseInt(m, 10) - 1;
  return `${MONTHS[mi]} ${y}`;
};

export const Toolbar: React.FC<ToolbarProps> = ({ filters, onChange, claims = [] }) => {
  const set = <K extends keyof ClaimsFilters>(key: K, value: ClaimsFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const monthOptions = React.useMemo(() => {
    const set = new Set<string>();
    claims.forEach((c) => {
      const ym = claimYearMonth(c);
      if (ym) set.add(ym);
    });
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1)); // newest first
  }, [claims]);

  const hasActive =
    filters.search !== '' ||
    filters.status !== 'all' ||
    filters.priority !== 'all' ||
    filters.assignee !== 'all' ||
    filters.month !== 'all' ||
    filters.amount !== 'all';

  return (
    <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap items-center gap-2 shadow-sm">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder="Search by name, email, or reg…"
          className="w-full h-9 pl-8 pr-2 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <select
        value={filters.status}
        onChange={(e) => set('status', e.target.value as ClaimsFilters['status'])}
        className={selectCls}
        aria-label="Filter by status"
      >
        <option value="all">All Statuses</option>
        <option value="overdue">Overdue</option>
        <option value="evidence">Evidence Needed</option>
        <option value="review">In Review</option>
        <option value="approved">Approved</option>
        <option value="open">Open</option>
        <option value="closed">Closed</option>
      </select>

      <select
        value={filters.priority}
        onChange={(e) => set('priority', e.target.value as ClaimsFilters['priority'])}
        className={selectCls}
        aria-label="Filter by priority"
      >
        <option value="all">All Priorities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="normal">Normal</option>
        <option value="low">Low</option>
      </select>

      <select
        value={filters.assignee}
        onChange={(e) => set('assignee', e.target.value as ClaimsFilters['assignee'])}
        className={selectCls}
        aria-label="Filter by assignee"
      >
        <option value="all">All Assignees</option>
        <option value="Sarah">Sarah</option>
        <option value="James">James</option>
        <option value="Priya">Priya</option>
        <option value="unassigned">Unassigned</option>
      </select>

      <select
        value={filters.month}
        onChange={(e) => set('month', e.target.value)}
        className={selectCls}
        aria-label="Filter by month"
      >
        <option value="all">All Months</option>
        {monthOptions.map((ym) => (
          <option key={ym} value={ym}>{monthLabel(ym)}</option>
        ))}
      </select>

      <select
        value={filters.amount}
        onChange={(e) => set('amount', e.target.value as ClaimsFilters['amount'])}
        className={selectCls}
        aria-label="Filter by claim amount"
      >
        <option value="all">All Amounts</option>
        <option value="0">£0 (no estimate)</option>
        <option value="0-500">£1 – £500</option>
        <option value="500-1500">£500 – £1,500</option>
        <option value="1500+">£1,500+</option>
      </select>

      <button
        type="button"
        onClick={() => onChange(DEFAULT_FILTERS)}
        disabled={!hasActive}
        className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-border bg-card text-sm text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <X className="h-3.5 w-3.5" />
        Clear Filters
      </button>
    </div>
  );
};

export function applyFilters(claims: Claim[], filters: ClaimsFilters): Claim[] {
  const q = filters.search.trim().toLowerCase();
  return claims.filter((c) => {
    if (filters.status !== 'all' && c.status !== filters.status) return false;
    if (filters.priority !== 'all' && c.priority !== filters.priority) return false;
    if (filters.assignee !== 'all') {
      if (filters.assignee === 'unassigned') {
        if (c.assignee !== 'unassigned') return false;
      } else if (!c.assignee.toLowerCase().includes(filters.assignee.toLowerCase())) {
        return false;
      }
    }
    if (filters.month !== 'all') {
      const ym = claimYearMonth(c);
      if (ym !== filters.month) return false;
    }
    if (filters.amount !== 'all') {
      const a = c.amount || 0;
      if (filters.amount === '0' && a !== 0) return false;
      if (filters.amount === '0-500' && !(a > 0 && a <= 500)) return false;
      if (filters.amount === '500-1500' && !(a > 500 && a <= 1500)) return false;
      if (filters.amount === '1500+' && !(a > 1500)) return false;
    }
    if (q) {
      const hay = `${c.customerName} ${c.email} ${c.reg}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
