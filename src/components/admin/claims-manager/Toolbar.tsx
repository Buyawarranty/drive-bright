import React from 'react';
import { Search, X } from 'lucide-react';
import type { Claim } from '@/types/claim';

export interface ClaimsFilters {
  search: string;
  status: 'all' | Claim['status'];
  priority: 'all' | Claim['priority'];
  assignee: 'all' | 'Sarah' | 'James' | 'Priya' | 'unassigned';
}

export const DEFAULT_FILTERS: ClaimsFilters = {
  search: '',
  status: 'all',
  priority: 'all',
  assignee: 'all',
};

interface ToolbarProps {
  filters: ClaimsFilters;
  onChange: (next: ClaimsFilters) => void;
}

const selectCls =
  'h-9 px-2 rounded-md border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export const Toolbar: React.FC<ToolbarProps> = ({ filters, onChange }) => {
  const set = <K extends keyof ClaimsFilters>(key: K, value: ClaimsFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const hasActive =
    filters.search !== '' ||
    filters.status !== 'all' ||
    filters.priority !== 'all' ||
    filters.assignee !== 'all';

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
    if (q) {
      const hay = `${c.customerName} ${c.email} ${c.reg}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
