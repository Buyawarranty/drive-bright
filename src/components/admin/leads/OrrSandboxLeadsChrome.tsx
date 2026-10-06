import React, { useMemo } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Coffee,
  RefreshCw,
  Search,
  Shield,
  Star,
  Target,
  Users,
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LeadFreezeRulesCard } from './LeadFreezeRulesCard';
import { cn } from '@/lib/utils';
import type { LeadStatus } from '@/hooks/useLeads';

/**
 * Practice copy of the New Leads page chrome (stuck-on-checkout strip, MY PROGRESS
 * cards, Lead Freeze rules and the leads toolbar with search, status chips and
 * filters) so the Open Round Robin sandbox looks and behaves like the live page.
 *
 * Everything here reads the practice leads only — no Supabase calls, no writes.
 */

export interface SandboxChromeLead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  vehicleReg: string;
  displayStatus: LeadStatus;
  createdAt: number;
}

export type SandboxStatusChip =
  | 'all'
  | 'live'
  | LeadStatus;

interface ChipDef {
  key: SandboxStatusChip;
  label: string;
  emoji?: string;
  icon?: React.ReactNode;
  dark?: boolean;
}

/** Same chip order and wording as the live New Leads page. */
const CHIP_ROWS: ChipDef[][] = [
  [
    { key: 'all', label: 'Total Leads', dark: true },
    { key: 'live', label: 'Live Leads', emoji: '🟢' },
    { key: 'urgent_callback', label: 'Urgent', emoji: '🔔' },
    { key: 'new', label: 'Not spoken to', emoji: '😐' },
    { key: 'no_answer', label: 'No answer', emoji: '🚫' },
    { key: 'left_voicemail', label: 'Left voicemail', emoji: '📼' },
    { key: 'wrong_number', label: 'Wrong number', emoji: '❌' },
    { key: 'callback_booked', label: 'Callback booked', emoji: '📅' },
    { key: 'contacted', label: 'Spoken to', emoji: '💬' },
  ],
  [
    { key: 'follow_up', label: 'Follow-up', emoji: '↩️' },
    { key: 'quote_sent', label: 'Quoted', emoji: '📄' },
    { key: 'converted', label: 'Won', emoji: '✅' },
    { key: 'negotiating', label: 'Hot', emoji: '🔥' },
    { key: 'bought_elsewhere', label: 'Bought elsewhere', emoji: '🛒' },
    { key: 'vehicle_sold', label: 'Vehicle sold', emoji: '🚗' },
    { key: 'do_not_contact', label: 'Do not contact', emoji: '⛔' },
    { key: 'lost', label: 'Lost', emoji: '💀' },
    { key: 'fake_lead', label: 'Fake / 404', emoji: '🚷' },
  ],
];

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
  onAgentFilterChange: (value: string) => void;
  sort: 'newest' | 'oldest';
  onSortChange: (value: 'newest' | 'oldest') => void;
  onClearFilters: () => void;
  agentName?: string;
}

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
  const counts = useMemo(() => {
    const map: Record<string, number> = { all: leads.length, live: liveHeldCount };
    for (const lead of leads) {
      map[lead.displayStatus] = (map[lead.displayStatus] ?? 0) + 1;
    }
    return map;
  }, [leads, liveHeldCount]);

  const practiceSales = useMemo(
    () => leads.filter((lead) => lead.displayStatus === 'converted').length,
    [leads],
  );

  return (
    <div className="space-y-4">
      {/* Practice copy of the live "stuck on checkout" strip */}
      <section className="rounded-xl border border-red-200 bg-red-50/60 p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold text-red-800">Customers stuck on checkout</h4>
              <ul className="mt-1 text-xs text-red-700/90 list-disc pl-4 space-y-0.5">
                <li>On the live page this shows real website visitors from the last hour.</li>
                <li>Practice mode never lists a real customer, so it stays empty.</li>
                <li>Any agent can call the person at the top.</li>
              </ul>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700">
              0 live
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700">
              <RefreshCw className="h-3 w-3" /> Refresh
            </span>
          </div>
        </div>
        <p className="mt-3 text-sm text-red-700">No customers stuck on checkout in practice mode.</p>
      </section>

      {/* Practice copy of MY PROGRESS */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground">MY PROGRESS</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            Practice figures only
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 divide-y xl:divide-y-0 xl:divide-x divide-border rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <ProgressCard
            icon={<Target className="h-4 w-4 text-orange-600" />}
            wrap="bg-orange-100"
            label="MY TARGET · PRACTICE"
            value={`£${(practiceSales * 684).toLocaleString()}`}
            sub="of £35,000 — practice only"
          />
          <ProgressCard
            icon={<CalendarDays className="h-4 w-4 text-blue-600" />}
            wrap="bg-blue-100"
            label="MY ATTENDANCE · THIS WEEK"
            value="On shift"
            sub="Nothing is marked in practice"
          />
          <ProgressCard
            icon={<Coffee className="h-4 w-4 text-sky-600" />}
            wrap="bg-sky-100"
            label="MY BREAK"
            value="On duty"
            sub="No breaks logged in practice"
          />
          <ProgressCard
            icon={<Shield className="h-4 w-4 text-purple-600" />}
            wrap="bg-purple-100"
            label="MY LEAD ACCESS"
            value="Receiving leads"
            sub="No freeze while practising"
            valueClass="text-emerald-700"
          />
          <ProgressCard
            icon={<Star className="h-4 w-4 text-emerald-600" />}
            wrap="bg-emerald-100"
            label="MY REVIEWS · THIS WEEK"
            value="0 positive"
            sub="Reviews never count in practice"
          />
        </div>
      </section>

      <LeadFreezeRulesCard />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search practice leads — name, email, phone, vehicle reg..."
          className="pl-9 h-11"
        />
      </div>

      {/* Status chips */}
      <div className="space-y-2">
        {CHIP_ROWS.map((row, rowIndex) => (
          <div key={rowIndex} className="flex flex-wrap gap-2">
            {row.map((chip) => {
              const active = statusChip === chip.key;
              const count = counts[chip.key] ?? 0;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => onStatusChipChange(chip.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                    active
                      ? 'border-foreground bg-foreground text-background'
                      : chip.dark
                        ? 'border-foreground/80 bg-foreground/90 text-background hover:bg-foreground'
                        : 'border-border bg-card text-foreground hover:bg-muted',
                  )}
                >
                  {chip.emoji && <span aria-hidden>{chip.emoji}</span>}
                  <span>{chip.label}</span>
                  <span className={cn('rounded px-1', active ? 'bg-background/20' : 'text-muted-foreground')}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> Agent
        </div>
        {isManagerView ? (
          <Select value={agentFilter} onValueChange={onAgentFilterChange}>
            <SelectTrigger className="h-9 w-[180px] text-xs">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground">
            {agentName ?? 'You'}
          </span>
        )}

        <Select value={sort} onValueChange={(value) => onSortChange(value as 'newest' | 'oldest')}>
          <SelectTrigger className="h-9 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </SelectContent>
        </Select>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> {teamLabel}
          <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-600/80">your team</span>
        </span>

        <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
          <Bell className="h-3 w-3" /> Practice date: today
        </span>

        <button
          type="button"
          onClick={onClearFilters}
          className="ml-auto rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          Clear filters
        </button>
      </div>
    </div>
  );
};

const ProgressCard: React.FC<{
  icon: React.ReactNode;
  wrap: string;
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}> = ({ icon, wrap, label, value, sub, valueClass }) => (
  <div className="p-4 flex items-start gap-3">
    <div className={cn('h-8 w-8 rounded-full flex items-center justify-center shrink-0', wrap)}>{icon}</div>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-semibold text-foreground', valueClass)}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  </div>
);

export default OrrSandboxLeadsChrome;
