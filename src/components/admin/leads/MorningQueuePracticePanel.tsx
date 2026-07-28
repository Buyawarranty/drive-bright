import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock, Copy, FastForward, HelpCircle, Phone, RotateCcw, Sunrise, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  email: string;
  reg: string;
  arrivedAt: string; // display only, e.g. "22:41"
  arrivedAtMs: number; // full lead date/time
  status: LeadStatus;
  assignedTo: string | null; // null = waiting in the pool, nobody owns it yet
  ownedFromMs: number | null; // when this agent was given the lead
  dueAtMs: number | null; // first-call deadline (ownedFromMs + 30 minutes)
  firstAttemptAtMs: number | null;
  reallocated: boolean;
  reassignments: number;
  warned: boolean;
  calls: number;
  agentActivityAtMs: number | null;
  customerActivity: string;
}

const AGENTS: MorningAgent[] = [
  { id: 'm-james', name: 'James Reed', extension: '201' },
  { id: 'm-freddie', name: 'Freddie', extension: '202' },
  { id: 'm-thomas', name: 'Thomas', extension: '203' },
  { id: 'm-greg', name: 'Greg sales@', extension: '205' },
];

/** Each agent holds at most this many un-called leads at once. */
const BATCH_CAP = 5;
/** How long an agent owns an un-called lead before it goes back to the pool. */
const OWNERSHIP_MS = 30 * 60 * 1000;
/** Warn the agent when this much of the window is gone. */
const WARN_AFTER_MS = 20 * 60 * 1000;
/** Amber once fewer than this many minutes remain. */
const AMBER_MS = 10 * 60 * 1000;


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

/** "Jul 27, 2026 07:32" — same shape as the New Leads Lead Date column. */
const formatLeadDate = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(',', ',');

/** Copyable email cell with icon + tooltip feedback. */
const CopyEmail = ({ email }: { email: string }) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      toast({ title: 'Copied', description: email, duration: 1500 });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  }, [email, toast]);

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary truncate max-w-[180px] transition-colors"
            aria-label="Copy email"
          >
            <span className="truncate">{email}</span>
            {copied ? (
              <Check className="h-3 w-3 text-green-600 shrink-0" />
            ) : (
              <Copy className="h-3 w-3 shrink-0 opacity-60 hover:opacity-100" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {copied ? 'Copied' : 'Click to copy email'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/** "6 minutes ago" style relative label. */
const formatRelative = (ms: number) => {
  const diff = Math.max(0, Date.now() - ms);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) === 1 ? '' : 's'} ago`;
};

const CUSTOMER_ACTIVITY = ['Shopping page', 'Step 2 form', 'Portal login', 'Quote page', 'No recent activity'];

const initials = (name: string) =>
  name.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();

const slugEmail = (name: string, index: number) =>
  `${name.split(' ')[0].toLowerCase()}${index + 1}@example.co.uk`;

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

  /** Build the overnight batch. Nothing is owned yet — the round robin hands them out. */
  const buildBatch = useCallback((count: number) => {
    const now = Date.now();
    return Array.from({ length: count }, (_, index): MorningLead => {
      const name = `${FIRST_NAMES[index % FIRST_NAMES.length]} (practice)`;
      const arrivedAtMs = now - (30 + index * 37) * 60 * 1000;
      return {
        id: `morning-${now}-${index}`,
        name,
        phone: `079${String(10000000 + Math.floor(Math.random() * 89999999)).slice(0, 8)}`,
        email: slugEmail(name, index),
        reg: randomReg(),
        arrivedAt: overnightTime(index, count),
        arrivedAtMs,
        status: 'new',
        assignedTo: null,
        ownedFromMs: null,
        dueAtMs: null,
        firstAttemptAtMs: null,
        reallocated: false,
        reassignments: 0,
        warned: false,
        calls: 0,
        agentActivityAtMs: null,
        customerActivity: CUSTOMER_ACTIVITY[index % CUSTOMER_ACTIVITY.length],
      };
    });
  }, []);

  /**
   * Rolling round robin: top every working agent up to BATCH_CAP un-called leads,
   * taking the oldest waiting lead first and rotating between agents one at a time.
   */
  const topUp = useCallback((current: MorningLead[], states: Record<string, AgentState>): MorningLead[] => {
    const working = AGENTS.filter((a) => states[a.id] === 'on_shift');
    if (working.length === 0) return current;

    const held: Record<string, number> = {};
    working.forEach((a) => (held[a.id] = 0));
    current.forEach((lead) => {
      if (lead.status === 'new' && lead.assignedTo && held[lead.assignedTo] !== undefined) {
        held[lead.assignedTo] += 1;
      }
    });

    const waiting = current
      .filter((lead) => lead.status === 'new' && !lead.assignedTo)
      .sort((a, b) => a.arrivedAtMs - b.arrivedAtMs)
      .map((lead) => lead.id);
    if (waiting.length === 0) return current;

    const now = Date.now();
    const handout: Record<string, string> = {};
    let cursor = 0;
    let guard = 0;
    while (waiting.length > 0 && guard < 500) {
      guard += 1;
      const agent = working[cursor % working.length];
      cursor += 1;
      if (cursor % working.length === 0 && working.every((a) => held[a.id] >= BATCH_CAP)) break;
      if (held[agent.id] >= BATCH_CAP) continue;
      const leadId = waiting.shift();
      if (!leadId) break;
      handout[leadId] = agent.id;
      held[agent.id] += 1;
    }
    if (Object.keys(handout).length === 0) return current;

    return current.map((lead) =>
      handout[lead.id]
        ? {
            ...lead,
            assignedTo: handout[lead.id],
            ownedFromMs: now,
            dueAtMs: now + OWNERSHIP_MS,
            warned: false,
            reallocated: lead.reassignments > 0,
          }
        : lead,
    );
  }, []);

  const startMorning = (count = 18) => {
    if (onShift.length === 0) {
      toast({ title: 'Nobody is on shift', description: 'Mark at least one agent as on shift first.', variant: 'destructive' });
      return;
    }
    setReleasedAt(Date.now());
    setLeads(topUp(buildBatch(count), agentState));
    toast({
      title: 'Morning leads released',
      description: `${count} practice leads queued. Up to ${BATCH_CAP} each go out in round-robin order, and the rest follow as calls are made.`,
    });
  };

  /** Every second: expire un-called leads past their 30 minutes, warn at 20, then top agents up. */
  useEffect(() => {
    if (!releasedAt) return;
    const now = Date.now();
    setLeads((current) => {
      let expired = 0;
      let warn = 0;
      const stepped = current.map((lead) => {
        if (lead.status !== 'new' || !lead.assignedTo || !lead.dueAtMs) return lead;
        if (now >= lead.dueAtMs) {
          expired += 1;
          return {
            ...lead,
            assignedTo: null,
            ownedFromMs: null,
            dueAtMs: null,
            warned: false,
            reallocated: true,
            reassignments: lead.reassignments + 1,
          };
        }
        if (!lead.warned && lead.ownedFromMs && now - lead.ownedFromMs >= WARN_AFTER_MS) {
          warn += 1;
          return { ...lead, warned: true };
        }
        return lead;
      });
      const next = topUp(stepped, agentState);
      if (expired > 0) {
        toast({
          title: `${expired} lead${expired === 1 ? '' : 's'} timed out`,
          description: 'No first call within 30 minutes — back in the queue for the next available agent.',
          variant: 'destructive',
        });
      } else if (warn > 0) {
        toast({ title: '10 minutes left', description: `${warn} lead${warn === 1 ? '' : 's'} still waiting on a first call.` });
      }
      return next === stepped && expired === 0 && warn === 0 ? current : next;
    });
  }, [releasedAt, agentState, topUp, toast, Math.floor(Date.now() / 1000)]);

  /** Take one agent's un-called leads off them and put them back in the queue. */
  const releaseFrom = useCallback((agentId: string, reason: string) => {
    setLeads((current) => {
      let moved = 0;
      const stepped = current.map((lead) => {
        if (lead.assignedTo !== agentId || lead.status !== 'new') return lead;
        moved += 1;
        return {
          ...lead,
          assignedTo: null,
          ownedFromMs: null,
          dueAtMs: null,
          warned: false,
          reallocated: true,
          reassignments: lead.reassignments + 1,
        };
      });
      if (moved === 0) return current;
      toast({ title: `${moved} lead(s) back in the queue`, description: reason });
      return topUp(stepped, { ...agentState, [agentId]: 'off' });
    });
  }, [agentState, toast, topUp]);

  const setState = (agentId: string, state: AgentState) => {
    const nextStates = { ...agentState, [agentId]: state };
    setAgentState(nextStates);
    if ((state === 'off' || state === 'running_late') && releasedAt) {
      releaseFrom(
        agentId,
        state === 'off'
          ? `${AGENTS.find((a) => a.id === agentId)?.name} is off — their un-called leads went back to the queue.`
          : `${AGENTS.find((a) => a.id === agentId)?.name} is running late — their un-called leads went back to the queue.`,
      );
    }
    if (state === 'on_shift' && releasedAt) {
      setLeads((current) => topUp(current, nextStates));
    }
  };

  const startShift = (agentId: string) => {
    setStartedAgents((current) => (current.includes(agentId) ? current : [...current, agentId]));
    toast({ title: 'Morning leads started', description: 'Work down your list — each one must have a call within 30 minutes.' });
  };

  const updateStatus = (leadId: string, status: LeadStatus) => {
    setLeads((current) =>
      topUp(
        current.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                status,
                firstAttemptAtMs: lead.firstAttemptAtMs ?? Date.now(),
                agentActivityAtMs: Date.now(),
              }
            : lead,
        ),
        agentState,
      ),
    );
  };

  /** Manual +/- call ticker, same backup behaviour as the New Leads table. */
  const adjustCalls = (leadId: string, delta: number) => {
    setLeads((current) =>
      topUp(
        current.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                calls: Math.max(0, lead.calls + delta),
                status: delta > 0 && lead.status === 'new' ? 'contacted' : lead.status,
                agentActivityAtMs: delta > 0 ? Date.now() : lead.agentActivityAtMs,
                firstAttemptAtMs: delta > 0 ? lead.firstAttemptAtMs ?? Date.now() : lead.firstAttemptAtMs,
              }
            : lead,
        ),
        agentState,
      ),
    );
  };

  const reset = () => {
    setLeads([]);
    setReleasedAt(null);
    setStartedAgents([]);
    toast({ title: 'Morning practice cleared', description: 'The simulation has been reset.' });
  };

  /** Fast-forward: push every live ownership window past its deadline. */
  const jumpToExpiry = () => {
    if (!releasedAt) return;
    const past = Date.now() - OWNERSHIP_MS - 1000;
    setLeads((current) =>
      current.map((lead) =>
        lead.status === 'new' && lead.assignedTo ? { ...lead, ownedFromMs: past, dueAtMs: Date.now() - 1000 } : lead,
      ),
    );
  };

  const myLeads = useMemo(() => leads.filter((lead) => lead.assignedTo === viewAgentId), [leads, viewAgentId]);
  const untouched = leads.filter((lead) => lead.status === 'new').length;
  const actioned = leads.length - untouched;
  const waitingCount = leads.filter((lead) => lead.status === 'new' && !lead.assignedTo).length;
  const overdueRisk = leads.filter(
    (lead) => lead.status === 'new' && lead.dueAtMs && lead.dueAtMs - Date.now() < AMBER_MS,
  ).length;
  const reassignedCount = leads.filter((lead) => lead.reassignments > 0).length;
  const iStarted = startedAgents.includes(viewAgentId);

  const perAgentCounts = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {};
    AGENTS.forEach((a) => (map[a.id] = { total: 0, done: 0 }));
    leads.forEach((lead) => {
      if (!lead.assignedTo || !map[lead.assignedTo]) return;
      map[lead.assignedTo].total += 1;
      if (lead.status !== 'new') map[lead.assignedTo].done += 1;
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
                    <strong className="text-foreground">{leads.length}</strong> overnight leads are going out in
                    round-robin order to {onShift.length} agent{onShift.length === 1 ? '' : 's'} on shift — up to{' '}
                    {BATCH_CAP} each at a time, with 30 minutes to make the first call.
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {actioned} actioned · {untouched} still not spoken to · {waitingCount} waiting in the queue
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground max-w-2xl">
                  Everything that came in after 6 pm is released at 9:00 am. Leads are pre-assigned one at a time in
                  round-robin order — up to {BATCH_CAP} per agent — so nobody cherry-picks. Each lead must have a first
                  call within 30 minutes or it goes back to the queue for the next available agent.
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
                  Pretend 9:00 am has arrived. This creates 18 practice overnight leads and hands them out in
                  round-robin order, <strong>{BATCH_CAP} at a time per agent</strong>. Nothing real changes.
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={jumpToExpiry} disabled={!releasedAt}>
                    <FastForward className="h-3.5 w-3.5 mr-1.5" /> Jump to 30-minute timeout
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  Fast-forward every live ownership window past its deadline. Any lead without a recorded first call is
                  taken off that agent and handed to the next available one.
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
          <div className="mt-3 flex items-center gap-2 flex-wrap text-sm font-medium">
            <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-900">
              <Clock className="h-4 w-4" /> 30 minutes to first call on every lead
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-900">
              {overdueRisk} running out of time
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-foreground">
              {waitingCount} waiting · {reassignedCount} reassigned
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
            Then use <strong>Jump to 30-minute timeout</strong> to see un-called leads returned to the queue.
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
                    <th className="w-[70px] px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Calls</th>
                    <th className="w-[130px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                    <th className="w-[130px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="w-[160px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Phone</th>
                    <th className="w-[180px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
                    <th className="w-[95px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reg</th>
                    <th className="w-[80px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Payment</th>
                    <th className="w-[100px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Paid Date</th>
                    <th className="w-[120px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Agent activity</th>
                    <th className="w-[110px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lead Date</th>
                    <th className="w-[140px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Customer activity</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => {
                    const mine = lead.assignedTo === viewAgentId;
                    const remaining = lead.dueAtMs ? lead.dueAtMs - Date.now() : null;
                    const overdue = lead.status === 'new' && remaining !== null && remaining <= 0;
                    const agent = lead.assignedTo ? AGENTS.find((a) => a.id === lead.assignedTo) : null;
                    return (
                      <tr
                        key={lead.id}
                        className={cn(
                          'border-b border-border hover:bg-muted/40 transition-colors',
                          mine && 'bg-amber-50/50',
                          !lead.assignedTo && lead.status === 'new' && 'bg-slate-50',
                        )}
                      >
                        <td className="px-2 py-2 text-center text-[11px] text-muted-foreground tabular-nums">{i + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            {agent ? (
                              <>
                                <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                                  {initials(agent.name)}
                                </span>
                                <span className="text-xs">{agent.name}</span>
                              </>
                            ) : (
                              <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                In queue
                              </span>
                            )}
                          </span>
                          {lead.reassignments > 0 && (
                            <span className="ml-1.5 rounded bg-orange-100 px-1 py-0.5 text-[10px] font-semibold text-orange-800">
                              reassigned ×{lead.reassignments}
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          {mine ? (
                            <Select
                              value={lead.status}
                              onValueChange={(value) => updateStatus(lead.id, value as LeadStatus)}
                            >
                              <SelectTrigger
                                className={cn(
                                  'h-7 px-2 text-[11px] font-medium whitespace-nowrap border gap-1 w-auto min-w-[120px]',
                                  STATUS_META[lead.status].className,
                                )}
                              >
                                <SelectValue>{STATUS_META[lead.status].label}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_ORDER.map((status) => (
                                  <SelectItem key={status} value={status} className="text-xs">
                                    <span className={cn('inline-block px-2 py-0.5 rounded', STATUS_META[status].className)}>
                                      {STATUS_META[status].label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                          {/* First-call countdown: green, amber under 10 minutes, red overdue */}
                          <div className="mt-1 text-[10px] tabular-nums whitespace-nowrap">
                            {lead.status !== 'new' ? (
                              <span className="text-muted-foreground">first call logged</span>
                            ) : !lead.assignedTo ? (
                              <span className="font-semibold text-slate-600">waiting for the next agent</span>
                            ) : overdue ? (
                              <span className="rounded px-1.5 py-0.5 font-semibold bg-rose-100 text-rose-800">
                                call overdue
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  'rounded px-1.5 py-0.5 font-semibold',
                                  (remaining ?? 0) < AMBER_MS
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-emerald-100 text-emerald-800',
                                )}
                              >
                                call in {formatCountdown(remaining ?? 0)}
                              </span>
                            )}
                          </div>

                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={!mine}
                              onClick={() => adjustCalls(lead.id, -1)}
                              className="h-5 w-5 rounded border border-border text-xs leading-none text-muted-foreground disabled:opacity-40"
                              aria-label="Remove a call"
                            >
                              −
                            </button>
                            <span className="w-5 text-center text-xs font-semibold tabular-nums">{lead.calls}</span>
                            <button
                              type="button"
                              disabled={!mine}
                              onClick={() => adjustCalls(lead.id, 1)}
                              className="h-5 w-5 rounded border border-border text-xs leading-none text-muted-foreground disabled:opacity-40"
                              aria-label="Add a call"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Notes
                            </span>
                            <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              Quote
                            </span>
                          </div>
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
                        <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[180px]">
                          <CopyEmail email={lead.email} />
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center rounded bg-yellow-300 px-2 py-0.5 text-xs font-bold text-yellow-950 font-mono">
                            {lead.reg}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">—</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">—</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {lead.agentActivityAtMs ? formatRelative(lead.agentActivityAtMs) : 'No agent activity'}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                          {formatLeadDate(lead.arrivedAtMs)}
                        </td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap">
                          <div className="text-muted-foreground">{formatRelative(lead.arrivedAtMs)}</div>
                          <div className="text-foreground">{lead.customerActivity}</div>
                        </td>
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
          <span className="font-semibold text-foreground">How it works:</span> at 9:00 am the system looks at who is on
          shift and hands leads out one at a time in round-robin order — James, Freddie, Thomas, Greg, then back to
          James. Each agent holds at most <strong>{BATCH_CAP} un-called leads</strong>, so nothing sits unworked and
          nobody cherry-picks. As soon as an agent records a call, the next waiting lead drops in automatically.
        </p>
        <p className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">The 30-minute ownership window:</span> every lead starts as{' '}
          <strong>Not spoken to</strong> with a 30-minute countdown — green with plenty of time, amber under 10 minutes,
          red once overdue, and a warning at 20 minutes. If no call is recorded in 30 minutes the lead leaves that agent
          and returns to the queue for the next available agent, tagged with how many times it has been reassigned. Once
          an agent makes the first call, the lead is theirs for follow-ups, quotes and negotiation.
        </p>
        <p className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Running late or off:</span> their un-called leads go straight
          back to the queue and are shared out to the agents who are working. Anything they have already called stays
          with them.
        </p>
      </div>

    </section>
  );
};

export default MorningQueuePracticePanel;
