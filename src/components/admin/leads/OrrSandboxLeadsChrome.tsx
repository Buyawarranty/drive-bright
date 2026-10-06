import React from 'react';
import { Search, X, ArrowUpDown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LeadStatus } from '@/hooks/useLeads';

/** A lead row as the chrome bar needs it — display fields only. */
export interface SandboxChromeLead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  vehicleReg: string | null;
  displayStatus: LeadStatus;
  createdAt: number;
}

export type SandboxStatusChip = 'all' | 'live' | LeadStatus;

interface Props {
  leads: SandboxChromeLead[];
  liveHeldCount: number;
  agents: { id: string; name: string }[];
  teamLabel: string;
  isManagerView: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  statusChip: SandboxStatusChip;
  onStatusChipChange: (chip: SandboxStatusChip) => void;
  agentFilter: string;
  onAgentFilterChange: (agentId: string) => void;
  sort: 'newest' | 'oldest';
  onSortChange: (sort: 'newest' | 'oldest') => void;
  onClearFilters: () => void;
  agentName?: string;
}

const STATUS_CHIPS: { id: SandboxStatusChip; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'follow_up', label: 'Follow up' },
  { id: 'quote_sent', label: 'Quote sent' },
  { id: 'negotiating', label: 'Negotiating' },
  { id: 'no_answer', label: 'No answer' },
];

/**
 * The New Leads page furniture (search, status chips, agent filter, sort)
 * shared by the Open Round Robin practice lab and live pool view, so
 * practice matches production.
 */
export const OrrSandboxLeadsChrome: React.FC<Props> = ({
  leads,
  liveHeldCount,
  agents,
  teamLabel,
  isManagerView,
  search,
  onSearchChange,
  statusChip,
  onStatusChipChange,
  agentFilter,
  onAgentFilterChange,
  sort,
  onSortChange,
  onClearFilters,
  agentName,
}) => {
  const hasFilters =
    search.trim() !== '' || statusChip !== 'all' || sort !== 'newest' || (isManagerView && agentFilter !== 'all');

  const countFor = (chip: SandboxStatusChip) => {
    if (chip === 'all') return leads.length;
    if (chip === 'live') return liveHeldCount;
    return leads.filter((lead) => lead.displayStatus === chip).length;
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-3 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name, email, phone or reg…"
            className="w-full rounded-lg border border-border bg-background pl-9 pr-8 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Agent filter (manager view only) */}
        {isManagerView && (
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            <select
              value={agentFilter}
              onChange={(e) => onAgentFilterChange(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">Whole team</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Sort */}
        <button
          type="button"
          onClick={() => onSortChange(sort === 'newest' ? 'oldest' : 'newest')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sort === 'newest' ? 'Newest first' : 'Oldest first'}
        </button>
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_CHIPS.map((chip) => {
          const count = countFor(chip.id);
          if (chip.id !== 'all' && chip.id !== 'live' && count === 0) return null;
          const active = statusChip === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onStatusChipChange(chip.id)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted',
              )}
            >
              {chip.label}
              <span className={cn('text-[10px]', active ? 'text-primary-foreground/80' : 'text-muted-foreground/70')}>
                {count}
              </span>
            </button>
          );
        })}

        {hasFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3 w-3" />
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {teamLabel}
          {agentName ? ` · ${agentName}` : ''} · {leads.length} lead{leads.length === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
};

export default OrrSandboxLeadsChrome;
