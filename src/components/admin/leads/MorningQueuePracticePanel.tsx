import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, FastForward, HelpCircle, Phone, RotateCcw, Sunrise, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { LeadStatus } from '@/hooks/useLeads';

/**
 * Morning leads — frontend-only practice simulation.
 * No Supabase, no RPCs, no real leads. Everything here is made up.
 *
 * Rules mirrored here:
 *  - Everything that arrives after 6 pm is released at 9:00 am.
 *  - The batch is split EQUALLY between the agents on shift. There is no shared queue
 *    and nobody claims anything — leads are already sitting with their owner at 9:00 am.
 *  - Every lead starts as "Not spoken to", exactly like New Leads.
 *  - Each lead has its own first-contact timer; the whole overnight batch must have a
 *    first attempt by 11:00 am.
 *  - Running late: the agent flags it, their share is held for 30 minutes, then shared out.
 *  - No word by 9:30 am: their untouched leads are shared out to the agents on shift.
 */

type MorningAgent = { id: string; name: string; extension: string };

type AgentState = 'on_shift' | 'running_late' | 'off';

/** Same status values and labels used by the New Leads table. */

interface MorningLead {
  id: string;
  name: string;
  phone: string;
  reg: string;
  arrivedAt: string; // display only, e.g. "22:41"
  status: LeadStatus;
  assignedTo: string | null;
  dueAtMs: number; // first-contact deadline for this specific lead
  firstAttemptAtMs: number | null;
  reallocated: boolean;
}

const AGENTS: MorningAgent[] = [
  { id: 'm-james', name: 'James Reed', extension: '201' },
  { id: 'm-freddie', name: 'Freddie', extension: '202' },
  { id: 'm-thomas', name: 'Thomas', extension: '203' },
  { id: 'm-greg', name: 'Greg sales@', extension: '205' },
];

/** 9:00 → 11:00 in the real world, shortened so a manager can rehearse it quickly. */
const BATCH_WINDOW_MS = 30 * 60 * 1000;
/** 9:00 → 9:30 grace before an unstarted agent's share is shared out. */
const LATE_GRACE_MS = 8 * 60 * 1000;
/** Minutes allowed per lead for the first attempt (spaced across the batch window). */
const PER_LEAD_MS = 6 * 60 * 1000;

const STATUS_META: Record<LeadStatus, { label: string; className: string }> = {
  new: { label: 'Not spoken to', className: 'bg-green-100 text-green-800 border-green-200' },
  contacted: { label: 'Spoken to', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  follow_up: { label: 'Follow-up', className: 'bg-purple-100 text-purple-800 border-purple-200' },
  quote_sent: { label: 'Quote sent', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  negotiating: { label: 'Negotiating', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  converted: { label: 'Converted', className: 'bg-teal-100 text-teal-800 border-teal-200' },
  lost: { label: 'Lost', className: 'bg-gray-100 text-gray-800 border-gray-200' },
  not_interested: { label: 'Not interested', className: 'bg-slate-200 text-slate-700 border-slate-200' },
  fake_lead: { label: 'Fake / 404', className: 'bg-red-100 text-red-800 border-red-200' },
  urgent_callback: { label: 'Urgent call-back', className: 'bg-red-500 text-white border-red-500' },
  no_answer: { label: 'No answer', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  left_voicemail: { label: 'Left voicemail', className: 'bg-sky-100 text-sky-800 border-sky-200' },
  wrong_number: { label: 'Wrong number', className: 'bg-rose-100 text-rose-800 border-rose-200' },
  callback_booked: { label: 'Callback booked', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  bought_elsewhere: { label: 'Bought elsewhere', className: 'bg-zinc-200 text-zinc-800 border-zinc-200' },
  vehicle_sold: { label: 'Vehicle sold', className: 'bg-stone-200 text-stone-800 border-stone-200' },
  do_not_contact: { label: 'Do not contact', className: 'bg-black text-white border-black' },
};

const STATUS_ORDER: LeadStatus[] = [
  'new',
  'contacted',
  'follow_up',
  'quote_sent',
  'negotiating',
  'converted',
  'lost',
  'not_interested',
  'fake_lead',
  'urgent_callback',
  'no_answer',
  'left_voicemail',
  'wrong_number',
  'callback_booked',
  'bought_elsewhere',
  'vehicle_sold',
  'do_not_contact',
];

const FIRST_NAMES = ['Amira', 'Daniel', 'Priya', 'Callum', 'Rosie', 'Idris', 'Megan', 'Tomasz', 'Femi', 'Holly', 'Ravi', 'Sian', 'Owen', 'Bea', 'Marek', 'Nadia', 'Joel', 'Katie', 'Sam', 'Leah'];
const REG_LETTERS = 'ABCDEFGHJKLMNOPRSTVWXY';

const randomReg = () => {
  const pick = (source: string, count: number) =>
    Array.from({ length: count }, () => source[Math.floor(Math.random() * source.length)]).join('');
  return `${pick(REG_LETTERS, 2)}${String(19 + Math.floor(Math.random() * 6))} ${pick(REG_LETTERS, 3)}`;
};

const overnightTime = (index: number, total: number) => {
  const startMin = 18 * 60 + 5;
  const spanMin = 14 * 60 + 50;
  const minutes = (startMin + Math.round((spanMin * index) / Math.max(1, total - 1))) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, '0')}s`;
};

export const MorningQueuePracticePanel: React.FC = () => {
  const { toast } = useToast();
  const [leads, setLeads] = useState<MorningLead[]>([]);
  const [agentState, setAgentState] = useState<Record<string, AgentState>>(
    Object.fromEntries(AGENTS.map((a) => [a.id, 'on_shift' as AgentState])),
  );
  const [startedAgents, setStartedAgents] = useState<string[]>([]);
  const [viewAgentId, setViewAgentId] = useState(AGENTS[2].id);
  const [releasedAt, setReleasedAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const sweptRef = useRef(false);

  useEffect(() => {
    const clock = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(clock);
  }, []);

  const onShift = useMemo(
    () => AGENTS.filter((a) => agentState[a.id] === 'on_shift'),
    [agentState],
  );

  /** Split the overnight batch equally between whoever is on shift at 9:00 am. */
  const buildAndSplit = useCallback((count: number, recipients: MorningAgent[]) => {
    const now = Date.now();
    const perAgent: Record<string, number> = {};
    return Array.from({ length: count }, (_, index): MorningLead => {
      const owner = recipients.length ? recipients[index % recipients.length] : null;
      const slot = owner ? (perAgent[owner.id] = (perAgent[owner.id] ?? 0) + 1) : 1;
      return {
        id: `morning-${now}-${index}`,
        name: `${FIRST_NAMES[index % FIRST_NAMES.length]} (practice)`,
        phone: `079${String(10000000 + Math.floor(Math.random() * 89999999)).slice(0, 8)}`,
        reg: randomReg(),
        arrivedAt: overnightTime(index, count),
        status: 'not_spoken_to',
        assignedTo: owner ? owner.id : null,
        dueAtMs: now + Math.min(BATCH_WINDOW_MS, slot * PER_LEAD_MS),
        firstAttemptAtMs: null,
        reallocated: false,
      };
    });
  }, []);

  const startMorning = (count = 18) => {
    if (onShift.length === 0) {
      toast({ title: 'Nobody is on shift', description: 'Mark at least one agent as on shift first.', variant: 'destructive' });
      return;
    }
    sweptRef.current = false;
    setStartedAgents([]);
    setReleasedAt(Date.now());
    setLeads(buildAndSplit(count, onShift));
    toast({
      title: 'Morning leads released',
      description: `${count} practice leads split equally between ${onShift.length} agents on shift. Nothing real was changed.`,
    });
  };

  /** Share one agent's untouched leads out equally between the agents who are working. */
  const reallocateFrom = useCallback((agentId: string, reason: string) => {
    setLeads((current) => {
      const recipients = AGENTS.filter((a) => a.id !== agentId && agentState[a.id] === 'on_shift');
      if (recipients.length === 0) return current;
      let cursor = 0;
      let moved = 0;
      const next = current.map((lead) => {
        if (lead.assignedTo !== agentId || lead.status !== 'not_spoken_to') return lead;
        const owner = recipients[cursor++ % recipients.length];
        moved += 1;
        return { ...lead, assignedTo: owner.id, reallocated: true };
      });
      if (moved > 0) {
        toast({ title: `${moved} lead(s) shared out`, description: reason });
      }
      return next;
    });
  }, [agentState, toast]);

  /** 9:30 sweep — anyone who never started loses their untouched share. */
  useEffect(() => {
    if (!releasedAt || sweptRef.current) return;
    if (Date.now() < releasedAt + LATE_GRACE_MS) return;
    sweptRef.current = true;
    AGENTS.forEach((agent) => {
      const working = agentState[agent.id] === 'on_shift' && startedAgents.includes(agent.id);
      if (!working) reallocateFrom(agent.id, `${agent.name} had not started by 9:30 am.`);
    });
  }, [releasedAt, agentState, startedAgents, reallocateFrom]);

  const setState = (agentId: string, state: AgentState) => {
    setAgentState((current) => ({ ...current, [agentId]: state }));
    if (state === 'off' && releasedAt) {
      reallocateFrom(agentId, `${AGENTS.find((a) => a.id === agentId)?.name} is off — their untouched leads moved.`);
    }
    if (state === 'running_late') {
      toast({
        title: 'Running late logged',
        description: 'Their leads are held for 30 minutes, then shared out automatically.',
      });
    }
  };

  const startShift = (agentId: string) => {
    setStartedAgents((current) => (current.includes(agentId) ? current : [...current, agentId]));
    toast({ title: 'Morning leads started', description: 'Your leads are yours — work down the list in order.' });
  };

  const updateStatus = (leadId: string, status: LeadStatus) => {
    setLeads((current) =>
      current.map((lead) =>
        lead.id === leadId
          ? { ...lead, status, firstAttemptAtMs: lead.firstAttemptAtMs ?? Date.now() }
          : lead,
      ),
    );
  };

  const reset = () => {
    setLeads([]);
    setReleasedAt(null);
    setStartedAgents([]);
    sweptRef.current = false;
    toast({ title: 'Morning practice cleared', description: 'The simulation has been reset.' });
  };

  const jumpToSweep = () => {
    if (!releasedAt) return;
    setReleasedAt(Date.now() - LATE_GRACE_MS - 1000);
    toast({ title: 'Jumped to 9:30 am', description: 'Untouched leads from anyone who never started are shared out.' });
  };

  const myLeads = useMemo(() => leads.filter((lead) => lead.assignedTo === viewAgentId), [leads, viewAgentId]);
  const untouched = leads.filter((lead) => lead.status === 'not_spoken_to').length;
  const actioned = leads.length - untouched;
  const batchEndsIn = releasedAt ? releasedAt + BATCH_WINDOW_MS - Date.now() : 0;
  const iStarted = startedAgents.includes(viewAgentId);

  const perAgentCounts = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {};
    AGENTS.forEach((a) => (map[a.id] = { total: 0, done: 0 }));
    leads.forEach((lead) => {
      if (!lead.assignedTo || !map[lead.assignedTo]) return;
      map[lead.assignedTo].total += 1;
      if (lead.status !== 'not_spoken_to') map[lead.assignedTo].done += 1;
    });
    return map;
  }, [leads]);

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-amber-50 to-transparent">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Sunrise className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-foreground">Morning leads</h4>
              {releasedAt ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">{leads.length}</strong> overnight leads were shared out at 9:00 am
                    between {onShift.length} agent{onShift.length === 1 ? '' : 's'} on shift. First attempt on every lead by
                    11:00 am.
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {actioned} actioned · {untouched} still not spoken to
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground max-w-2xl">
                  Everything that came in after 6 pm is released at 9:00 am and split equally between the agents on shift.
                  Nobody claims anything — the leads are already yours when you sit down.
                </p>
              )}
            </div>
          </div>

          <TooltipProvider delayDuration={100}>
            <div className="flex items-center gap-2 flex-wrap">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" onClick={() => startMorning(18)}>
                    <Sunrise className="h-3.5 w-3.5 mr-1.5" /> Release 9:00 am batch
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  Pretend 9:00 am has arrived. This creates 18 practice overnight leads and shares them equally
                  between the agents marked <strong>on shift</strong>. Nothing real changes.
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={jumpToSweep} disabled={!releasedAt}>
                    <FastForward className="h-3.5 w-3.5 mr-1.5" /> Jump to 9:30 am
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  Fast-forward the practice clock to 9:30 am. Any agent who has not started their leads will lose their
                  untouched share, which is then shared out to the other agents on shift.
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="ghost" onClick={reset} disabled={leads.length === 0}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  Clear the practice simulation and start again.
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 text-amber-800 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 cursor-help">
                    <HelpCircle className="h-3 w-3" /> Manager practice only
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  This whole panel is a safe rehearsal space for managers. No real leads are moved, no agents are called,
                  and no reports are updated.
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {releasedAt && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900">
            <Clock className="h-4 w-4" />
            <span>
              Whole batch must have a first attempt in{' '}
              <span className="tabular-nums font-semibold">{formatCountdown(batchEndsIn)}</span>
            </span>
          </div>
        )}
      </div>

      {/* Shift bar */}
      <div className="px-5 py-2.5 border-b-2 border-border bg-muted/30">
        <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
            <Users className="h-3.5 w-3.5" /> On shift today
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {AGENTS.map((agent) => {
              const state = agentState[agent.id];
              const counts = perAgentCounts[agent.id];
              return (
                <div
                  key={agent.id}
                  className={cn(
                    'inline-flex items-center gap-1.5 h-7 rounded-full border px-2 text-xs font-medium',
                    state === 'on_shift' && 'border-emerald-300 bg-emerald-50 text-emerald-800',
                    state === 'running_late' && 'border-amber-300 bg-amber-50 text-amber-900',
                    state === 'off' && 'border-border bg-muted text-muted-foreground',
                  )}
                >
                  <span className="whitespace-nowrap">{agent.name}</span>
                  {releasedAt && counts.total > 0 && (
                    <span className="tabular-nums opacity-70">
                      {counts.done}/{counts.total}
                    </span>
                  )}
                  <select
                    className="h-5 rounded border-0 bg-transparent text-[11px] font-medium outline-none"
                    value={state}
                    onChange={(event) => setState(agent.id, event.target.value as AgentState)}
                  >
                    <option value="on_shift">on shift</option>
                    <option value="running_late">running late</option>
                    <option value="off">off today</option>
                  </select>
                </div>
              );
            })}
          </div>

          <div className="h-5 w-px bg-border hidden lg:block" />

          <div className="flex items-center gap-2 ml-auto shrink-0">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground whitespace-nowrap">
              Viewing as
            </span>
            <select
              className="h-8 w-52 rounded-md border border-input bg-background px-2 text-sm font-medium"
              value={viewAgentId}
              onChange={(event) => setViewAgentId(event.target.value)}
            >
              {AGENTS.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} · ext {agent.extension}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {!releasedAt ? (
          <div className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-md bg-muted/30">
            Press <strong>Release 9:00 am batch</strong> to rehearse what happens when the overnight leads arrive.
            <br className="hidden sm:block" />
            Then use <strong>Jump to 9:30 am</strong> to see how late-starter leads are shared out.
          </div>
        ) : (
          <>
            {!iStarted && myLeads.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm text-amber-900">
                  <strong>{myLeads.length} leads are already yours.</strong> Tap start when you sit down so the manager
                  knows you are working them.
                </div>
                <Button size="sm" onClick={() => startShift(viewAgentId)}>
                  Start my morning leads
                </Button>
              </div>
            )}

            {/* Leads table — same format as New Leads */}
            <div className="rounded-md border-2 border-border overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-muted/30 border-b-2 border-border">
                    <th className="w-[44px] px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">#</th>
                    <th className="w-[130px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Agent</th>
                    <th className="w-[150px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="w-[90px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Call by</th>
                    <th className="w-[130px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="w-[160px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Phone</th>
                    <th className="w-[95px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reg</th>
                    <th className="w-[100px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lead Date</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => {
                    const mine = lead.assignedTo === viewAgentId;
                    const overdue = lead.status === 'not_spoken_to' && Date.now() > lead.dueAtMs;
                    return (
                      <tr
                        key={lead.id}
                        className={cn(
                          'border-b border-border hover:bg-muted/40 transition-colors',
                          mine && 'bg-amber-50/50',
                        )}
                      >
                        <td className="px-2 py-2 text-center text-[11px] text-muted-foreground tabular-nums">{i + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-foreground">
                          {lead.assignedTo ? AGENTS.find((a) => a.id === lead.assignedTo)?.name : '—'}
                          {lead.reallocated && (
                            <span className="ml-1.5 rounded bg-orange-100 px-1 py-0.5 text-[10px] font-semibold text-orange-800">
                              moved
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {mine ? (
                            <select
                              className={cn(
                                'h-7 rounded-full border px-2 text-xs font-medium',
                                STATUS_META[lead.status].className,
                              )}
                              value={lead.status}
                              onChange={(event) => updateStatus(lead.id, event.target.value as LeadStatus)}
                            >
                              {STATUS_ORDER.map((status) => (
                                <option key={status} value={status}>
                                  {STATUS_META[status].label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                                STATUS_META[lead.status].className,
                              )}
                            >
                              {STATUS_META[lead.status].label}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs tabular-nums whitespace-nowrap">
                          {lead.status !== 'not_spoken_to' ? (
                            <span className="text-muted-foreground">done</span>
                          ) : overdue ? (
                            <span className="font-semibold text-rose-700">overdue</span>
                          ) : (
                            <span className="text-muted-foreground">{formatCountdown(lead.dueAtMs - Date.now())}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{lead.name}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <a
                            href={`tel:${lead.phone}`}
                            onClick={(event) => event.preventDefault()}
                            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 tabular-nums"
                          >
                            <Phone className="h-3 w-3" /> {lead.phone}
                          </a>
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center rounded bg-yellow-300 px-2 py-0.5 text-xs font-bold text-yellow-950 font-mono">
                            {lead.reg}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground tabular-nums whitespace-nowrap">{lead.arrivedAt}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="bg-muted/40 px-5 py-3 border-t border-border space-y-1">
        <p className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">How it works:</span> overnight leads release at 9:00 am and are
          split equally between the agents on shift — no shared queue and no claiming. Every lead starts as{' '}
          <strong>Not spoken to</strong>, and each one shows how long is left for the first attempt (about 6 minutes per
          lead, whole batch done by 11:00 am, so 10–20 leads fits comfortably in the morning).
        </p>
        <p className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Running late:</span> the agent (or a manager) sets them to
          “running late” before 9:00 am — their share is held for 30 minutes and then shared out automatically.{' '}
          <span className="font-semibold text-foreground">No word by 9:30 am:</span> every lead of theirs still marked
          Not spoken to is shared out equally between the agents who are working, tagged “moved”. Anything they had
          already touched stays with them.
        </p>
      </div>
    </section>
  );
};

export default MorningQueuePracticePanel;
