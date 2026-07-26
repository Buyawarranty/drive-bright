import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FastForward,
  PhoneCall,
  PhoneOff,
  RotateCcw,
  Sunrise,
  Users,
  Voicemail,
  CalendarClock,
  Ban,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/**
 * Morning queue — frontend-only practice simulation.
 * No Supabase, no RPCs, no real leads. Everything here is made up.
 */

type MorningAgent = { id: string; name: string; extension: string };

type MorningStatus =
  | 'waiting' // in the shared overnight pool
  | 'with_agent' // handed to an agent, no attempt yet (counts towards the 9:30 rule)
  | 'in_conversation' // customer answered — stays with the agent, timer stopped
  | 'attempted' // dialled, no answer
  | 'voicemail'
  | 'callback'
  | 'invalid'
  | 'returned'; // no attempt by 9:30 — went back to the shared queue

interface MorningLead {
  id: string;
  name: string;
  phone: string;
  reg: string;
  arrivedAt: string; // display only, e.g. "22:41"
  status: MorningStatus;
  assignedTo: string | null;
  handedAtMs: number | null;
  history: string[];
}

const AGENTS: MorningAgent[] = [
  { id: 'm-james', name: 'James Reed', extension: '201' },
  { id: 'm-freddie', name: 'Freddie', extension: '202' },
  { id: 'm-thomas', name: 'Thomas', extension: '203' },
  { id: 'm-greg', name: 'Greg sales@', extension: '205' },
];

/** 30 minutes in the real world; shortened here so a manager can rehearse it quickly. */
const FIRST_ATTEMPT_WINDOW_MS = 30 * 60 * 1000;

const ATTEMPTED_STATUSES: MorningStatus[] = [
  'in_conversation',
  'attempted',
  'voicemail',
  'callback',
  'invalid',
];

const FIRST_NAMES = ['Amira', 'Daniel', 'Priya', 'Callum', 'Rosie', 'Idris', 'Megan', 'Tomasz', 'Femi', 'Holly', 'Ravi', 'Sian', 'Owen', 'Bea', 'Marek', 'Nadia', 'Joel', 'Katie'];
const REG_LETTERS = 'ABCDEFGHJKLMNOPRSTVWXY';

const randomReg = () => {
  const pick = (source: string, count: number) =>
    Array.from({ length: count }, () => source[Math.floor(Math.random() * source.length)]).join('');
  return `${pick(REG_LETTERS, 2)}${String(19 + Math.floor(Math.random() * 6))} ${pick(REG_LETTERS, 3)}`;
};

const overnightTime = (index: number, total: number) => {
  // Spread arrivals between 18:05 and 08:55
  const startMin = 18 * 60 + 5;
  const spanMin = 14 * 60 + 50;
  const minutes = (startMin + Math.round((spanMin * index) / Math.max(1, total - 1))) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

const buildOvernightLeads = (count: number): MorningLead[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `morning-${Date.now()}-${index}`,
    name: `${FIRST_NAMES[index % FIRST_NAMES.length]} (practice)`,
    phone: `079${String(10000000 + Math.floor(Math.random() * 89999999)).slice(0, 8)}`,
    reg: randomReg(),
    arrivedAt: overnightTime(index, count),
    status: 'waiting' as MorningStatus,
    assignedTo: null,
    handedAtMs: null,
    history: ['Arrived overnight — waiting for the 9:00 release'],
  }));

const STATUS_META: Record<MorningStatus, { label: string; className: string }> = {
  waiting: { label: 'Waiting in the shared queue', className: 'bg-muted text-muted-foreground border-border' },
  with_agent: { label: 'With you — no attempt yet', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  in_conversation: { label: 'In conversation', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  attempted: { label: 'Attempt made — no answer', className: 'bg-blue-50 text-blue-800 border-blue-200' },
  voicemail: { label: 'Voicemail left', className: 'bg-blue-50 text-blue-800 border-blue-200' },
  callback: { label: 'Callback arranged', className: 'bg-violet-50 text-violet-800 border-violet-200' },
  invalid: { label: 'Not a usable lead', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  returned: { label: 'Returned to the shared queue', className: 'bg-orange-50 text-orange-800 border-orange-200' },
};

const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, '0')}s`;
};

export const MorningQueuePracticePanel: React.FC = () => {
  const { toast } = useToast();
  const [leads, setLeads] = useState<MorningLead[]>([]);
  const [available, setAvailable] = useState<string[]>(AGENTS.map((a) => a.id));
  const [viewAgentId, setViewAgentId] = useState(AGENTS[2].id); // Thomas, as in the example
  const [releasedAt, setReleasedAt] = useState<number | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const rotationRef = useRef(0);

  useEffect(() => {
    const clock = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(clock);
  }, []);

  /** Hand one lead at a time to every agent who is available and not already holding one. */
  const feedQueue = useCallback((input: MorningLead[], availableIds: string[]): MorningLead[] => {
    const next = input.map((lead) => ({ ...lead }));
    const busy = new Set(
      next
        .filter((lead) => lead.assignedTo && (lead.status === 'with_agent' || lead.status === 'in_conversation'))
        .map((lead) => lead.assignedTo as string),
    );

    const pool = next.filter((lead) => lead.status === 'waiting' || lead.status === 'returned');
    for (const lead of pool) {
      const candidates = AGENTS.filter((agent) => availableIds.includes(agent.id) && !busy.has(agent.id));
      if (candidates.length === 0) break;
      const agent = candidates[rotationRef.current % candidates.length];
      rotationRef.current += 1;
      lead.status = 'with_agent';
      lead.assignedTo = agent.id;
      lead.handedAtMs = Date.now();
      lead.history = [...lead.history, `Handed to ${agent.name} — no claim needed`];
      busy.add(agent.id);
    }
    return next;
  }, []);

  /** 9:30 sweep: only leads with no genuine attempt go back to the shared queue. */
  useEffect(() => {
    if (!deadlineAt || Date.now() < deadlineAt) return;
    setLeads((current) => {
      const needsSweep = current.some((lead) => lead.status === 'with_agent');
      if (!needsSweep) return current;
      const swept = current.map((lead) =>
        lead.status === 'with_agent'
          ? {
              ...lead,
              status: 'returned' as MorningStatus,
              assignedTo: null,
              handedAtMs: null,
              history: [...lead.history, 'No attempt recorded by 9:30 — returned to the shared queue'],
            }
          : lead,
      );
      return feedQueue(swept, available);
    });
  }, [deadlineAt, available, feedQueue]);

  const startMorning = (count = 18) => {
    const now = Date.now();
    rotationRef.current = 0;
    setReleasedAt(now);
    setDeadlineAt(now + FIRST_ATTEMPT_WINDOW_MS);
    setLeads(feedQueue(buildOvernightLeads(count), available));
    toast({
      title: 'Morning leads released',
      description: `${count} practice leads are ready. First attempt by 9:30 am. Nothing real was changed.`,
    });
  };

  const recordOutcome = (leadId: string, status: MorningStatus, note: string) => {
    setLeads((current) => {
      const updated = current.map((lead) =>
        lead.id === leadId ? { ...lead, status, history: [...lead.history, note] } : lead,
      );
      // In conversation keeps the agent out of the rotation; every other outcome frees them.
      return status === 'in_conversation' ? updated : feedQueue(updated, available);
    });
    toast({ title: 'Lead updated', description: 'Preparing your next lead…' });
  };

  const finishConversation = (leadId: string, status: MorningStatus, note: string) => {
    setLeads((current) => {
      const updated = current.map((lead) =>
        lead.id === leadId ? { ...lead, status, history: [...lead.history, note] } : lead,
      );
      return feedQueue(updated, available);
    });
    toast({ title: 'Lead updated', description: 'Preparing your next lead…' });
  };

  const toggleAvailable = (agentId: string) => {
    setAvailable((current) => {
      const next = current.includes(agentId) ? current.filter((id) => id !== agentId) : [...current, agentId];
      setLeads((leadsNow) => feedQueue(leadsNow, next));
      return next;
    });
  };

  const jumpToDeadline = () => {
    if (!releasedAt) return;
    setDeadlineAt(Date.now() - 1);
    toast({ title: 'Jumped to 9:30 am', description: 'Only leads with no attempt at all are moved.' });
  };

  const reset = () => {
    setLeads([]);
    setReleasedAt(null);
    setDeadlineAt(null);
    rotationRef.current = 0;
    toast({ title: 'Morning practice cleared', description: 'The simulation has been reset.' });
  };

  const remaining = useMemo(
    () => leads.filter((lead) => lead.status === 'waiting' || lead.status === 'returned').length,
    [leads],
  );
  const actioned = useMemo(
    () => leads.filter((lead) => ATTEMPTED_STATUSES.includes(lead.status)).length,
    [leads],
  );
  const notYetAttempted = useMemo(() => leads.filter((lead) => lead.status === 'with_agent').length, [leads]);

  const myLeads = useMemo(
    () => leads.filter((lead) => lead.assignedTo === viewAgentId),
    [leads, viewAgentId],
  );
  const myActive = myLeads.find((lead) => lead.status === 'with_agent' || lead.status === 'in_conversation') ?? null;
  const msLeft = deadlineAt ? deadlineAt - Date.now() : 0;
  const pastDeadline = deadlineAt !== null && msLeft <= 0;

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
                    <strong className="text-foreground">{leads.length}</strong> overnight leads are ready for the team.
                    Make the first attempt by 9:30 am.
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {available.length} agent{available.length === 1 ? '' : 's'} available · {remaining} lead
                    {remaining === 1 ? '' : 's'} remaining · {actioned} actioned
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground max-w-2xl">
                  Everything that came in after 6 pm is released together at 9:00 am, then fed to agents one lead at a
                  time. Nobody claims anything and nobody gets a pile.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={() => startMorning(18)}>
              <Sunrise className="h-3.5 w-3.5 mr-1.5" /> Start my morning leads
            </Button>
            <Button size="sm" variant="outline" onClick={jumpToDeadline} disabled={!releasedAt || pastDeadline}>
              <FastForward className="h-3.5 w-3.5 mr-1.5" /> Jump to 9:30 am
            </Button>
            <Button size="sm" variant="ghost" onClick={reset} disabled={leads.length === 0}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
            </Button>
          </div>
        </div>

        {releasedAt && (
          <div
            className={cn(
              'mt-3 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium',
              pastDeadline
                ? 'border-orange-200 bg-orange-50 text-orange-800'
                : 'border-amber-200 bg-amber-50 text-amber-900',
            )}
          >
            <Clock className="h-4 w-4" />
            {pastDeadline ? (
              <span>9:30 am has passed — {notYetAttempted} lead(s) with no attempt were returned to the queue.</span>
            ) : (
              <span>
                First attempt window closes in <span className="tabular-nums font-semibold">{formatCountdown(msLeft)}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Availability + agent preview — single inline control bar */}
      <div className="px-5 py-2.5 border-b-2 border-border bg-muted/30">
        <div className="flex items-center gap-x-3 gap-y-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
            <Users className="h-3.5 w-3.5" /> Available
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {AGENTS.map((agent) => {
              const on = available.includes(agent.id);
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => toggleAvailable(agent.id)}
                  className={cn(
                    'h-7 rounded-full border px-2.5 text-xs font-medium transition-colors whitespace-nowrap',
                    on
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-border bg-muted text-muted-foreground',
                  )}
                >
                  {agent.name}
                  <span className="ml-1 opacity-70">{on ? 'available' : 'away'}</span>
                </button>
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


      {/* Agent's current lead */}
      <div className="px-5 py-4 space-y-4">
        {!releasedAt ? (
          <div className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-md bg-muted/30">
            Press <strong>Start my morning leads</strong> to release a practice batch of overnight enquiries.
          </div>
        ) : !myActive ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4">
            <div className="flex items-center gap-2 text-emerald-900 font-semibold">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Ready for your next lead
            </div>
            <p className="text-sm text-emerald-900/80 mt-1">
              {remaining > 0
                ? 'Preparing your next lead…'
                : available.includes(viewAgentId)
                  ? 'The overnight queue is clear. Nothing left to hand out.'
                  : 'You are marked unavailable, so no leads are being sent to you.'}
            </p>
          </div>
        ) : (
          <div
            className={cn(
              'rounded-xl border p-4',
              myActive.status === 'in_conversation'
                ? 'border-emerald-200 bg-emerald-50/60'
                : 'border-amber-200 bg-amber-50/50',
            )}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-base font-semibold text-foreground">{myActive.name}</div>
                <div className="text-sm text-muted-foreground">
                  {myActive.phone} · <span className="font-mono font-semibold">{myActive.reg}</span> · arrived{' '}
                  {myActive.arrivedAt}
                </div>
              </div>
              <span
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-semibold',
                  STATUS_META[myActive.status].className,
                )}
              >
                {STATUS_META[myActive.status].label}
              </span>
            </div>

            {myActive.status === 'in_conversation' ? (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-white/70 px-3 py-3">
                <div className="text-sm font-semibold text-emerald-900">You're speaking with this customer</div>
                <p className="text-sm text-emerald-900/80 mt-0.5">
                  New leads are paused until you finish. This lead is yours — take as long as the customer needs.
                </p>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <Button size="sm" onClick={() => finishConversation(myActive.id, 'callback', 'Conversation finished — callback arranged')}>
                    <CalendarClock className="h-3.5 w-3.5 mr-1.5" /> Finished — callback arranged
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => finishConversation(myActive.id, 'attempted', 'Conversation finished — outcome recorded')}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Finished — record outcome
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Call this customer now — no need to claim it. Recording any outcome below counts as your first
                  attempt.
                </p>
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <Button size="sm" onClick={() => recordOutcome(myActive.id, 'in_conversation', 'Customer answered — in conversation')}>
                    <PhoneCall className="h-3.5 w-3.5 mr-1.5" /> Customer answered
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => recordOutcome(myActive.id, 'attempted', 'Called — no answer')}>
                    <PhoneOff className="h-3.5 w-3.5 mr-1.5" /> No answer
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => recordOutcome(myActive.id, 'voicemail', 'Voicemail left')}>
                    <Voicemail className="h-3.5 w-3.5 mr-1.5" /> Voicemail left
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => recordOutcome(myActive.id, 'callback', 'Callback arranged')}>
                    <CalendarClock className="h-3.5 w-3.5 mr-1.5" /> Callback arranged
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => recordOutcome(myActive.id, 'invalid', 'Marked invalid or duplicate')}>
                    <Ban className="h-3.5 w-3.5 mr-1.5" /> Invalid or duplicate
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Returned notice for this agent */}
        {myLeads.some((lead) => lead.status === 'returned') && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900 inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> This lead has returned to the shared queue because no attempt was
            recorded.
          </div>
        )}

        {/* Team view */}
        {leads.length > 0 && (
          <div className="overflow-x-auto border border-border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Arrived</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Phone</th>
                  <th className="px-3 py-2 text-left">Reg</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">With</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{lead.arrivedAt}</td>
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{lead.name}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{lead.phone}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded bg-yellow-300 px-2 py-0.5 text-xs font-bold text-yellow-950 font-mono">
                        {lead.reg}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                          STATUS_META[lead.status].className,
                        )}
                      >
                        {STATUS_META[lead.status].label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {lead.assignedTo ? AGENTS.find((a) => a.id === lead.assignedTo)?.name : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-muted/40 px-5 py-3 border-t border-border">
        <p className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">How it works:</span> all overnight leads release together at
          9:00 am, but each available agent only ever holds one at a time. A lead counts as actioned once there is a
          conversation, a call with no answer, a voicemail, a callback or an invalid/duplicate mark. At 9:30 am only
          leads with no attempt at all go back to the shared queue — and the agent is never told who receives them.
        </p>
      </div>
    </section>
  );
};

export default MorningQueuePracticePanel;
