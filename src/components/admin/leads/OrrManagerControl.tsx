import React from 'react';
import { CalendarDays, Clock, Coffee, Eye, Layers, Play, User, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { LEAD_TYPE_LABELS, type OrrLeadType } from '@/lib/orrPractice/leadBadges';

/**
 * Manager view — full queue and control sections for the Open Round Robin
 * practice sandbox: stat cards, the slim queue table with Assign, the agent
 * capacity panel, the release schedule summary, practice performance and the
 * practice audit log. All data is made up; nothing here writes anywhere.
 */

/* ------------------------------------------------------------------ */
/* Stat cards                                                          */
/* ------------------------------------------------------------------ */

export interface OrrManagerStats {
  totalLeads: number;
  readyNow: number;
  overnightWaiting: number;
  nextReleaseLabel: string;
  availableAgents: number;
  totalAgents: number;
  activeLeads: number;
  maxPerAgent: number;
}

const StatCard: React.FC<{ icon: React.ReactNode; label: string; sub?: string; value: React.ReactNode }> = ({
  icon,
  label,
  sub,
  value,
}) => (
  <div className="rounded-xl border border-border bg-card shadow-sm p-3 min-w-[120px] flex-1">
    <div className="flex items-center gap-2 text-muted-foreground">
      {icon}
      <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
    </div>
    {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    <div className="text-2xl font-bold text-foreground mt-1 tabular-nums">{value}</div>
  </div>
);

export const OrrManagerStatCards: React.FC<{ stats: OrrManagerStats }> = ({ stats }) => (
  <div className="flex flex-wrap gap-2">
    <StatCard icon={<Layers className="h-4 w-4" />} label="Total Leads" value={stats.totalLeads} />
    <StatCard icon={<Play className="h-4 w-4 text-emerald-600" />} label="Ready Now" sub="(In Pool)" value={stats.readyNow} />
    <StatCard icon={<Clock className="h-4 w-4 text-amber-600" />} label="Overnight" sub="(Waiting)" value={stats.overnightWaiting} />
    <StatCard icon={<CalendarDays className="h-4 w-4" />} label="Next Release" value={stats.nextReleaseLabel} />
    <StatCard
      icon={<Users className="h-4 w-4" />}
      label="Available Agents"
      value={
        <>
          {stats.availableAgents} <span className="text-base text-muted-foreground">/ {stats.totalAgents}</span>
        </>
      }
    />
    <StatCard icon={<Zap className="h-4 w-4" />} label="Active Leads" sub="(Assigned)" value={stats.activeLeads} />
    <StatCard icon={<User className="h-4 w-4" />} label="Max per Agent" value={stats.maxPerAgent} />
  </div>
);

/* ------------------------------------------------------------------ */
/* Agent capacity panel                                                */
/* ------------------------------------------------------------------ */

export type CapacityState = 'available' | 'on_call' | 'on_break' | 'blocked' | 'held_no_sale';

export interface CapacityRow {
  id: string;
  name: string;
  usedSlots: number;
  maxSlots: number;
  state: CapacityState;
  /** Extra note, e.g. the no-sale ladder reason. */
  note?: string;
}

const STATE_LABELS: Record<CapacityState, string> = {
  available: 'Available',
  on_call: 'On Call',
  on_break: 'On Break',
  blocked: 'Blocked',
  held_no_sale: 'Held (no sale)',
};

export const OrrAgentCapacityPanel: React.FC<{
  rows: CapacityRow[];
  onToggleBreak?: (agentId: string) => void;
}> = ({ rows, onToggleBreak }) => (
  <div className="rounded-xl border border-border bg-card shadow-sm p-3">
    <h4 className="text-sm font-semibold text-foreground">Agent Capacity ({rows.length})</h4>
    <ul className="mt-2 space-y-1.5">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              'h-2 w-2 rounded-full shrink-0',
              row.state === 'available' && 'bg-emerald-500',
              row.state === 'on_call' && 'bg-sky-500',
              row.state === 'on_break' && 'bg-amber-500',
              (row.state === 'blocked' || row.state === 'held_no_sale') && 'bg-rose-500',
            )}
          />
          <span className="font-medium text-foreground truncate">{row.name}</span>
          <span className="ml-auto text-muted-foreground tabular-nums whitespace-nowrap">
            {row.state === 'available' || row.state === 'on_call'
              ? `${row.usedSlots} / ${row.maxSlots}`
              : STATE_LABELS[row.state]}
          </span>
          {onToggleBreak && (
            <button
              type="button"
              onClick={() => onToggleBreak(row.id)}
              title={row.state === 'on_break' ? 'End break' : 'Start break (practice)'}
              className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-md border transition-colors',
                row.state === 'on_break'
                  ? 'border-amber-300 bg-amber-100 text-amber-800'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              <Coffee className="h-3 w-3" />
            </button>
          )}
        </li>
      ))}
    </ul>
    {rows.some((r) => r.note) && (
      <ul className="mt-2 space-y-0.5 border-t border-border pt-2">
        {rows
          .filter((r) => r.note)
          .map((r) => (
            <li key={r.id} className="text-[10px] text-muted-foreground">
              {r.name}: {r.note}
            </li>
          ))}
      </ul>
    )}
  </div>
);

/* ------------------------------------------------------------------ */
/* Slim queue table                                                    */
/* ------------------------------------------------------------------ */

export type QueueStatus = 'ready' | 'claimed' | 'held_callback' | 'waiting';

export interface QueueRow {
  id: string;
  leadRef: string;
  leadType: OrrLeadType;
  sourceLabel: string;
  queueStatus: QueueStatus;
  callsToday: number;
  callsTotal: number;
  chaseDay: number;
  ageLabel: string;
  assignedAgentName: string | null;
  nextReleaseLabel: string;
  name?: string;
  phone?: string;
  email?: string;
  vehicleReg?: string;
  leadDateLabel?: string;
}

const QUEUE_STATUS_STYLES: Record<QueueStatus, string> = {
  ready: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  claimed: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
  held_callback: 'bg-orange-100 text-orange-800 border border-orange-200',
  waiting: 'bg-amber-100 text-amber-800 border border-amber-200',
};

const QUEUE_STATUS_LABELS: Record<QueueStatus, string> = {
  ready: 'Ready Now',
  claimed: 'Claimed',
  held_callback: 'Held (Callback)',
  waiting: 'Waiting',
};

const TYPE_STYLES: Record<OrrLeadType, string> = {
  overnight: 'bg-rose-100 text-rose-800 border border-rose-200',
  live: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  callback: 'bg-sky-100 text-sky-800 border border-sky-200',
};

export const OrrQueueTable: React.FC<{
  rows: QueueRow[];
  chaseDays: number;
  agents: { id: string; name: string }[];
  onAssign: (leadId: string, agentId: string) => void;
  onInspect?: (leadId: string) => void;
  /** Follows the account's lead-source entitlement; sales roles never see it. */
  showSource?: boolean;
}> = ({ rows, chaseDays, agents, onAssign, onInspect, showSource = true }) => (
  <div className="overflow-x-auto border border-border rounded-md bg-card">
    <table className="w-full text-sm">
      <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
        <tr>
          <th className="px-2 py-2 text-center w-11">#</th>
          <th className="px-2 py-2 text-left">Lead Ref</th>
          <th className="px-2 py-2 text-left">Lead Type</th>
          {showSource && <th className="px-2 py-2 text-left">Source</th>}
          <th className="px-2 py-2 text-left">Status</th>
          <th className="px-2 py-2 text-center">Calls (Today/Total)</th>
          <th className="px-2 py-2 text-left">Chase Day</th>
          <th className="px-2 py-2 text-left">Age</th>
          <th className="px-2 py-2 text-left">Assigned Agent</th>
          <th className="px-2 py-2 text-left">Next Release</th>
          <th className="px-2 py-2 text-left">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={showSource ? 11 : 10} className="px-4 py-8 text-center text-sm text-muted-foreground">
              The shared queue is empty — add a practice lead or run the 09:00 release.
            </td>
          </tr>
        ) : (
          rows.map((row, index) => (
            <tr key={row.id} className="border-t border-border">
              <td className="px-2 py-2 text-muted-foreground text-center">{index + 1}</td>
              <td className="px-2 py-2 font-semibold text-foreground whitespace-nowrap">{row.leadRef}</td>
              <td className="px-2 py-2">
                <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap', TYPE_STYLES[row.leadType])}>
                  {LEAD_TYPE_LABELS[row.leadType]}
                </span>
              </td>
              {showSource && <td className="px-2 py-2 text-xs text-muted-foreground whitespace-nowrap">{row.sourceLabel}</td>}
              <td className="px-2 py-2">
                <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap', QUEUE_STATUS_STYLES[row.queueStatus])}>
                  {QUEUE_STATUS_LABELS[row.queueStatus]}
                </span>
              </td>
              <td className="px-2 py-2 text-center tabular-nums text-xs">
                {row.callsToday} / {row.callsTotal}
              </td>
              <td className="px-2 py-2 text-xs whitespace-nowrap">
                Day {row.chaseDay} of {chaseDays}
              </td>
              <td className="px-2 py-2 text-xs whitespace-nowrap">{row.ageLabel}</td>
              <td className="px-2 py-2 text-xs whitespace-nowrap">{row.assignedAgentName ?? 'Unassigned'}</td>
              <td className="px-2 py-2 text-xs whitespace-nowrap">{row.nextReleaseLabel}</td>
              <td className="px-2 py-2">
                <div className="flex items-center gap-1.5">
                  {row.queueStatus === 'ready' || row.queueStatus === 'waiting' ? (
                    <Select onValueChange={(agentId) => onAssign(row.id, agentId)}>
                      <SelectTrigger className="h-7 w-[104px] text-[11px] font-medium">
                        <SelectValue placeholder="Assign" />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id} className="text-xs">
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">—</span>
                  )}
                  {onInspect && (
                    <button
                      type="button"
                      onClick={() => onInspect(row.id)}
                      title="View practice history"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

/* ------------------------------------------------------------------ */
/* Release schedule panel                                              */
/* ------------------------------------------------------------------ */

export const OrrReleaseSchedulePanel: React.FC<{
  releaseTimesLabel: string;
  releaseDays: number;
  maxReleases: number;
  nextReleaseLabel: string;
  maxPerAgent: number;
}> = ({ releaseTimesLabel, releaseDays, maxReleases, nextReleaseLabel, maxPerAgent }) => (
  <div className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-3">
    <h4 className="text-sm font-semibold text-foreground">Controlled release — {releaseTimesLabel} UK time</h4>
    <ol className="list-decimal pl-5 space-y-1 text-xs text-foreground">
      <li>At each release window the system checks available, eligible agents and their free lead slots.</li>
      <li>
        It releases only enough leads to match capacity (for example 6 agents × up to {maxPerAgent} slots = max{' '}
        {6 * maxPerAgent} leads).
      </li>
      <li>These leads enter the shared Open Round Robin pool.</li>
      <li>As agents claim and free up capacity, more leads are released from the overnight backlog.</li>
      <li>Remaining overnight leads stay in the queue for the next release or until capacity opens.</li>
    </ol>
    <ul className="list-disc pl-5 space-y-0.5 text-xs text-muted-foreground">
      <li>Chase runs for {releaseDays} days — {maxReleases} releases maximum per lead.</li>
      <li>Next scheduled release: {nextReleaseLabel}.</li>
      <li>A release is an allocation opportunity, never permission to call.</li>
    </ul>
  </div>
);

/* ------------------------------------------------------------------ */
/* Performance + audit log (practice data only)                        */
/* ------------------------------------------------------------------ */

export const OrrPerformancePanel: React.FC<{
  rows: { name: string; claimed: number; contacted: number; dials: number; unworked: number }[];
}> = ({ rows }) => (
  <div className="rounded-xl border border-border bg-card shadow-sm p-4">
    <h4 className="text-sm font-semibold text-foreground">Practice performance</h4>
    <p className="text-xs text-muted-foreground mt-0.5">Made-up figures from this practice run only — no real agent figures change.</p>
    <div className="mt-3 overflow-x-auto border border-border rounded-md">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Agent</th>
            <th className="px-3 py-2 text-center">Claimed</th>
            <th className="px-3 py-2 text-center">Contacted</th>
            <th className="px-3 py-2 text-center">Dials</th>
            <th className="px-3 py-2 text-center">Unworked now</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t border-border">
              <td className="px-3 py-2 font-medium text-foreground">{row.name}</td>
              <td className="px-3 py-2 text-center tabular-nums">{row.claimed}</td>
              <td className="px-3 py-2 text-center tabular-nums">{row.contacted}</td>
              <td className="px-3 py-2 text-center tabular-nums">{row.dials}</td>
              <td className="px-3 py-2 text-center tabular-nums">{row.unworked}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export const OrrAuditLogPanel: React.FC<{
  entries: { leadRef: string; text: string }[];
}> = ({ entries }) => (
  <div className="rounded-xl border border-border bg-card shadow-sm p-4">
    <h4 className="text-sm font-semibold text-foreground">Practice audit log</h4>
    <p className="text-xs text-muted-foreground mt-0.5">Every practice action on this run, newest first. Nothing is saved anywhere.</p>
    {entries.length === 0 ? (
      <p className="mt-3 text-xs text-muted-foreground">No practice actions yet.</p>
    ) : (
      <ul className="mt-3 max-h-72 overflow-y-auto space-y-1">
        {entries.map((entry, index) => (
          <li key={`${entry.leadRef}-${index}`} className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
            <span className="font-semibold text-foreground">{entry.leadRef}</span>{' '}
            <span className="text-muted-foreground">{entry.text}</span>
          </li>
        ))}
      </ul>
    )}
  </div>
);
