import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  FileText,
  FlaskConical,
  Mail,
  MessageSquare,
  Phone,
  Lock,
  Pause,
  Play,
  Plus,
  RefreshCw,
  StickyNote,
  Trash2,
  User,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLeadDistribution } from '@/hooks/useLeadDistribution';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { cn } from '@/lib/utils';
import type { LeadStatus } from '@/hooks/useLeads';

type DummyLeadStatus = 'queued' | 'new' | 'reassigned' | 'dormant';

/** Same colours used in the real New Leads table so practice matches production. */
const statusColors: Record<LeadStatus, string> = {
  new: 'bg-green-100 text-green-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  follow_up: 'bg-purple-100 text-purple-800',
  quote_sent: 'bg-indigo-100 text-indigo-800',
  negotiating: 'bg-orange-100 text-orange-800',
  converted: 'bg-teal-100 text-teal-800',
  lost: 'bg-gray-100 text-gray-800',
  not_interested: 'bg-slate-200 text-slate-700',
  fake_lead: 'bg-red-100 text-red-800',
  urgent_callback: 'bg-red-500 text-white',
  no_answer: 'bg-amber-100 text-amber-800',
  left_voicemail: 'bg-sky-100 text-sky-800',
  wrong_number: 'bg-rose-100 text-rose-800',
  callback_booked: 'bg-blue-100 text-blue-800',
  bought_elsewhere: 'bg-zinc-200 text-zinc-800',
  vehicle_sold: 'bg-stone-200 text-stone-800',
  do_not_contact: 'bg-black text-white',
};

const statusLabels: Record<LeadStatus, string> = {
  new: 'Not spoken to',
  contacted: 'Spoken to',
  follow_up: 'Follow-up',
  quote_sent: 'Quote sent',
  negotiating: 'Negotiating',
  converted: 'Converted',
  lost: 'Lost',
  not_interested: 'Not interested',
  fake_lead: 'Fake / 404',
  urgent_callback: 'Urgent call-back',
  no_answer: 'No answer',
  left_voicemail: 'Left voicemail',
  wrong_number: 'Wrong number',
  callback_booked: 'Callback booked',
  bought_elsewhere: 'Bought elsewhere',
  vehicle_sold: 'Vehicle sold',
  do_not_contact: 'Do not contact',
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

interface DummyAgent {
  id: string;
  name: string;
  extension: string;
  order: number;
}

interface DummyLead {
  id: string;
  firstName: string;
  lastName: string;
  status: DummyLeadStatus;
  displayStatus: LeadStatus;
  assignedTo: string | null;
  deadlineAt: number;
  attemptCount: number;
  vehicleReg: string;
  phone: string;
  createdAt: number;
  dials: number;
  contactedAt: number | null;
  history: string[];
}

const CLAIM_WINDOW_MS = 120_000;
const MAX_ATTEMPTS = 7;

const DUMMY_AGENTS: DummyAgent[] = [
  { id: 'dummy-james', name: 'James Reed', extension: '201', order: 1 },
  { id: 'dummy-freddie', name: 'Freddie', extension: '202', order: 2 },
  { id: 'dummy-thomas', name: 'Thomas', extension: '203', order: 3 },
  { id: 'dummy-greg', name: 'Greg sales@', extension: '205', order: 4 },
];

const getAgent = (agentId: string | null) => DUMMY_AGENTS.find((agent) => agent.id === agentId) ?? DUMMY_AGENTS[0];

const formatClock = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}m ${ss}sec`;
};


/** An agent is busy while they hold a live (not yet expired) dummy lead. */
const isHeldLive = (lead: DummyLead, now: number) =>
  lead.status !== 'dormant' && lead.status !== 'queued' && lead.assignedTo !== null && lead.deadlineAt > now;

/**
 * One-at-a-time ORR engine: an agent may only ever hold ONE dummy lead.
 * Expired leads roll to the next free agent; if everyone is busy the lead waits in the queue.
 */
const advance = (input: DummyLead[], startIndex: number, now: number) => {
  const leads = input.map((lead) => ({ ...lead }));
  let index = startIndex;
  let reassigned = 0;
  let dormant = 0;

  const busy = new Set(leads.filter((lead) => isHeldLive(lead, now)).map((lead) => lead.assignedTo as string));

  const takeFreeAgent = (): DummyAgent | null => {
    for (let step = 0; step < DUMMY_AGENTS.length; step += 1) {
      const candidate = DUMMY_AGENTS[(index + step) % DUMMY_AGENTS.length];
      if (!busy.has(candidate.id)) {
        index = (index + step + 1) % DUMMY_AGENTS.length;
        busy.add(candidate.id);
        return candidate;
      }
    }
    return null;
  };

  // Oldest first, so waiting leads are handled before newly expired ones.
  const pending = leads
    .filter((lead) => lead.status !== 'dormant' && (lead.status === 'queued' || lead.deadlineAt <= now))
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const lead of pending) {
    if (lead.status !== 'queued' && lead.attemptCount >= MAX_ATTEMPTS) {
      lead.status = 'dormant';
      lead.assignedTo = null;
      lead.history = [...lead.history, 'Moved to Dormant – No Contact after 7 unanswered attempts'];
      dormant += 1;
      continue;
    }

    const agent = takeFreeAgent();
    if (!agent) {
      if (lead.status !== 'queued') {
        lead.status = 'queued';
        lead.assignedTo = null;
        lead.history = [...lead.history, 'All agents busy — waiting in the open pool queue'];
      }
      continue;
    }

    const attempt = lead.status === 'queued' && lead.attemptCount === 0 ? 1 : lead.attemptCount + 1;
    lead.status = attempt === 1 ? 'new' : 'reassigned';
    lead.displayStatus = 'new';
    lead.assignedTo = agent.id;
    lead.attemptCount = attempt;
    lead.deadlineAt = now + CLAIM_WINDOW_MS;
    lead.history = [...lead.history, `Attempt ${attempt} assigned to ${agent.name}`];
    reassigned += 1;
  }

  return { leads, index, reassigned, dormant };
};

export type OrrPracticeTeam = 'blue' | 'red';

interface OrrTheme {
  label: string;
  cardBorder: string;
  iconWrap: string;
  icon: string;
  chip: string;
  holdBox: string;
  holdLabel: string;
  holdValue: string;
  holdIcon: string;
  bar: string;
  barFill: string;
  reserved: string;
}

const ORR_THEMES: Record<OrrPracticeTeam, OrrTheme> = {
  blue: {
    label: 'Team Blue',
    cardBorder: 'border-l-blue-500',
    iconWrap: 'bg-blue-100',
    icon: 'text-blue-600',
    chip: 'bg-blue-100 text-blue-800 border border-blue-200',
    holdBox: 'border-teal-100 bg-teal-50/40',
    holdLabel: 'text-teal-800',
    holdValue: 'text-teal-900',
    holdIcon: 'text-teal-600',
    bar: 'bg-teal-100',
    barFill: 'bg-teal-500',
    reserved: 'border-teal-200 bg-teal-50/70 text-teal-700',
  },
  red: {
    label: 'Team Red',
    cardBorder: 'border-l-rose-500',
    iconWrap: 'bg-rose-100',
    icon: 'text-rose-600',
    chip: 'bg-rose-100 text-rose-800 border border-rose-200',
    holdBox: 'border-rose-100 bg-rose-50/40',
    holdLabel: 'text-rose-800',
    holdValue: 'text-rose-900',
    holdIcon: 'text-rose-600',
    bar: 'bg-rose-100',
    barFill: 'bg-rose-500',
    reserved: 'border-rose-200 bg-rose-50/70 text-rose-700',
  },
};

/**
 * Open Round Robin — frontend-only dummy test mode.
 * This intentionally does not call Supabase, RPCs, edge functions, or live lead tables.
 */
export const OpenRoundRobinTestPanel: React.FC<{ team?: OrrPracticeTeam }> = ({ team = 'blue' }) => {
  const theme = ORR_THEMES[team];
  const { toast } = useToast();
  const [leads, setLeads] = useState<DummyLead[]>([]);
  const nextAgentIndexRef = useRef(0);
  const [simulatedAgentId, setSimulatedAgentId] = useState(DUMMY_AGENTS[0].id);
  const [tick, setTick] = useState(0);


  // Real self-service pause toggle — mirrors the real agent pause state
  const currentAdminId = useCurrentAdminId();
  const { agentPresences, togglePauseReceiving } = useLeadDistribution();
  const myPresence = currentAdminId
    ? agentPresences.find((p) => p.admin_user_id === currentAdminId)
    : undefined;
  const isPausedReceiving = myPresence?.is_paused_receiving ?? false;
  const [togglingPause, setTogglingPause] = useState(false);
  const handlePauseToggle = async () => {
    if (togglingPause) return;
    setTogglingPause(true);
    await togglePauseReceiving();
    setTogglingPause(false);
  };

  // 1s clock + automatic sweep so expired dummy leads never sit around for hours.
  useEffect(() => {
    const clock = window.setInterval(() => {
      setTick((current) => current + 1);
      const now = Date.now();
      setLeads((current) => {
        const needsWork = current.some(
          (lead) => lead.status !== 'dormant' && (lead.status === 'queued' || lead.deadlineAt <= now),
        );
        if (!needsWork) return current;
        const result = advance(current, nextAgentIndexRef.current, now);
        nextAgentIndexRef.current = result.index;
        return result.leads;
      });
    }, 1000);
    return () => window.clearInterval(clock);
  }, []);

  const visibleLeads = useMemo(
    () => leads.filter((lead) => lead.assignedTo === simulatedAgentId && lead.status !== 'dormant'),
    [leads, simulatedAgentId],
  );

  const queuedLeads = useMemo(() => leads.filter((lead) => lead.status === 'queued'), [leads]);

  const createTestLead = useCallback(() => {
    const now = Date.now();
    const viewer = getAgent(simulatedAgentId);

    setLeads((current) => {
      const leadNumber = current.length + 1;
      const viewerBusy = current.some((lead) => isHeldLive(lead, now) && lead.assignedTo === viewer.id);

      const draft: DummyLead = {
        id: `dummy-orr-${now}-${Math.random().toString(36).slice(2, 7)}`,
        firstName: 'TEST',
        lastName: `Lead ${String(leadNumber).padStart(2, '0')}`,
        status: viewerBusy ? 'queued' : 'new',
        displayStatus: 'new',
        assignedTo: viewerBusy ? null : viewer.id,
        attemptCount: viewerBusy ? 0 : 1,
        deadlineAt: viewerBusy ? now : now + CLAIM_WINDOW_MS,
        vehicleReg: 'TEST123',
        phone: '07902222222',
        createdAt: now,
        dials: 0,
        contactedAt: null,
        history: viewerBusy
          ? ['Created — waiting in the open pool (you already hold a lead)']
          : [`Created — attempt 1 assigned to ${viewer.name}`],
      };

      window.setTimeout(() => {
        toast(
          viewerBusy
            ? {
                title: 'Waiting in the queue',
                description: `${viewer.name} already holds a live practice lead. It releases as soon as that window ends.`,
              }
            : {
                title: 'Lead taken',
                description: `Practice lead assigned to ${viewer.name} — 2 minutes to make the first call.`,
              },
        );
      }, 0);

      return [draft, ...current];
    });
  }, [simulatedAgentId, toast]);

  const adjustDials = (id: string, delta: number) => {
    setLeads((current) =>
      current.map((lead) => {
        if (lead.id !== id) return lead;
        const dials = Math.max(0, lead.dials + delta);
        const contactedAt = dials > 0 ? (lead.contactedAt ?? Date.now()) : null;
        return {
          ...lead,
          dials,
          contactedAt,
          displayStatus: dials > 0 && lead.displayStatus === 'new' ? 'contacted' : lead.displayStatus,
          history: [...lead.history, `Manual dial counter ${delta > 0 ? '+1' : '-1'}`],
        };
      }),
    );
  };

  const updateDisplayStatus = (id: string, status: LeadStatus) => {
    setLeads((current) =>
      current.map((lead) => {
        if (lead.id !== id) return lead;
        return {
          ...lead,
          displayStatus: status,
          contactedAt: status === 'new' ? null : (lead.contactedAt ?? Date.now()),
          history: [...lead.history, `Status changed to ${statusLabels[status]}`],
        };
      }),
    );
  };

  const runSweep = () => {

    const now = Date.now();
    setLeads((current) => {
      const result = advance(current, nextAgentIndexRef.current, now);
      nextAgentIndexRef.current = result.index;
      window.setTimeout(
        () =>
          toast({
            title: 'Passed on',
            description: `Moved on ${result.reassigned} · Waiting ${result.dormant}. Nothing real was changed.`,
          }),
        0,
      );
      return result.leads;
    });
  };

  const cleanup = () => {
    setLeads([]);
    nextAgentIndexRef.current = 0;
    toast({ title: 'Practice leads cleared', description: 'The practice page has been reset.' });

  };

  const copyPhone = async (phone: string) => {
    await navigator.clipboard.writeText(phone);
    toast({ title: 'Phone number copied', description: phone });
  };

  void tick;

  return (
    <div className="space-y-4">
      {/* Header card */}
      <section className="rounded-xl border border-border bg-card shadow-sm p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center shrink-0', theme.iconWrap)}>
              <FlaskConical className={cn('h-5 w-5', theme.icon)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                  Open Round Robin practice — {theme.label}
                </h3>
                <span className={cn('rounded-full text-[11px] font-medium px-2.5 py-0.5', theme.chip)}>
                  Practice mode
                </span>

                <span className="rounded-full bg-muted text-muted-foreground text-[11px] font-medium px-2.5 py-0.5">
                  Managers only
                </span>
                <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] font-medium px-2.5 py-0.5">
                  Nothing counts
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                A safe place to rehearse the 2-minute window, pass-on, agent view, phone column, click-to-dial and copy
                button. Every name here is made up — no customer is contacted and no agent's figures change.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-border flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={createTestLead}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Take this lead
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTick((current) => current + 1)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh queue
          </Button>
          <Button size="sm" variant="outline" onClick={runSweep} disabled={leads.length === 0}>
            <Play className="h-3.5 w-3.5 mr-1.5" /> I’ll take the next one
          </Button>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
              isPausedReceiving
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            )}
            title={isPausedReceiving ? 'You are temporarily opted out of new lead offers' : 'You are receiving new lead offers'}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                isPausedReceiving ? 'bg-amber-500' : 'bg-emerald-500'
              )}
            />
            {isPausedReceiving ? 'Focusing on current leads' : 'Ready for new leads'}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={handlePauseToggle}
            disabled={togglingPause}
            className={cn(
              'gap-1.5',
              isPausedReceiving
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 hover:text-emerald-900'
                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300'
            )}
            title={isPausedReceiving ? 'Resume receiving new lead offers' : 'Pause new lead offers to focus on current leads'}
          >
            {isPausedReceiving ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5 fill-current" />}
            {isPausedReceiving ? 'Ready for new leads' : 'Focus on current leads'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-muted-foreground"
            onClick={cleanup}
            disabled={leads.length === 0}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear practice leads
          </Button>
        </div>
      </section>


      {/* Agent preview */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Agent preview</div>
            <div className="text-xs text-muted-foreground">See the page exactly as a sales agent would.</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            Viewing as sales agent
          </span>
          <select
            className="h-9 w-64 rounded-lg border border-input bg-muted/40 px-3 text-sm font-medium"
            value={simulatedAgentId}
            onChange={(event) => setSimulatedAgentId(event.target.value)}
          >
            {DUMMY_AGENTS.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.order}. {agent.name} · ext {agent.extension}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Leads */}
      <section className={cn('rounded-xl border-l-4 border-y border-r border-border bg-card shadow-sm overflow-hidden', theme.cardBorder)}>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', theme.iconWrap)}>
              <Clock className={cn('h-4 w-4', theme.icon)} />
            </div>
            <div>
              <h4 className="text-base font-semibold text-foreground">New Leads — {theme.label}</h4>

              <p className="text-xs text-muted-foreground">
                Assigned automatically in a fair rotation and reserved for one agent at a time.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-5 text-[11px] font-medium text-muted-foreground">
            <span>Fair</span>
            <span className="text-border">|</span>
            <span>Transparent</span>
            <span className="text-border">|</span>
            <span>One at a time</span>
          </div>
        </div>

        <div className="px-5 py-4">
        {queuedLeads.length > 0 && (
          <div className="mb-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">{queuedLeads.length}</strong> practice lead{queuedLeads.length === 1 ? '' : 's'} waiting —
            everyone currently holds one. They release automatically as windows free up, so no one has to race.
          </div>
        )}



        {visibleLeads.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-md bg-muted/30">
            No practice leads for {getAgent(simulatedAgentId).name}. Click <strong>Take this lead</strong> or switch the agent preview.
          </div>
        ) : (
          <div className="overflow-x-auto border border-border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left w-8">#</th>
                  <th className="px-2 py-2 text-left w-8"></th>
                  <th className="px-2 py-2 text-left">Name</th>
                  <th className="px-2 py-2 text-left">Phone</th>
                  <th className="px-2 py-2 text-left">Reg</th>
                  <th className="px-2 py-2 text-left">Your turn</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-left">Dials</th>
                  <th className="px-2 py-2 text-left">Actions</th>
                  <th className="px-2 py-2 text-left">Agent</th>
                  <th className="px-2 py-2 text-left w-8">Src</th>
                  <th className="px-2 py-2 text-left">Email</th>
                </tr>
              </thead>
              <tbody>
                {visibleLeads.map((lead, rowIndex) => {
                  const now = Date.now();
                  const remainingMs = lead.deadlineAt - now;
                  const remaining = Math.max(0, Math.round(remainingMs / 1000));
                  const expired = remainingMs <= 0;
                  const ageSec = Math.round((now - lead.createdAt) / 1000);
                  const agent = getAgent(lead.assignedTo);

                  return (
                    <tr
                      key={lead.id}
                      className={`border-t border-border align-middle ${expired ? 'bg-muted/40' : 'bg-background'}`}
                    >
                      <td className="px-2 py-2 text-muted-foreground">{rowIndex + 1}</td>
                      <td className="px-2 py-2">
                        <input type="checkbox" className="h-4 w-4 rounded border-input" readOnly />
                      </td>
                      <td className="px-2 py-2 font-semibold text-foreground whitespace-nowrap">
                        {lead.firstName} {lead.lastName}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="h-5 w-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">Z</span>
                          <a
                            href={`tel:${lead.phone}`}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-900"
                          >
                            <Phone className="h-3 w-3" /> {lead.phone}
                          </a>
                          <button type="button" onClick={() => copyPhone(lead.phone)} title="Copy number">
                            <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                          </button>
                          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center rounded bg-yellow-300 px-2 py-1 text-xs font-bold text-yellow-950 font-mono">
                          {lead.vehicleReg}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        {lead.contactedAt ? (
                          <div className="min-w-[180px] rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                              <span className="text-sm font-semibold text-emerald-800">This lead is now yours</span>
                            </div>
                            <div className="mt-1 text-xs text-emerald-900/80">
                              Contacted within{' '}
                              <span className="font-semibold">
                                {formatClock(Math.max(0, Math.round((lead.contactedAt - lead.createdAt) / 1000)))}
                              </span>
                            </div>
                            <div className="text-xs text-emerald-900/70">The lead has been assigned to you.</div>
                          </div>
                        ) : (
                        <div className={cn('min-w-[160px] rounded-md border px-2.5 py-2', theme.holdBox)}>
                          {expired ? (
                            <div className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Offered to another agent
                            </div>
                          ) : (
                            <>
                              <div className={cn('inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap', theme.holdLabel)}>
                                <Lock className={cn('h-3 w-3', theme.holdIcon)} /> Held for you
                              </div>
                              <div className={cn('text-sm font-semibold tabular-nums', theme.holdValue)}>
                                {formatClock(remaining)} left to call
                              </div>
                            </>
                          )}
                          <div className="text-[11px] text-muted-foreground">
                            Lead arrived {formatClock(ageSec)} ago · Attempt {lead.attemptCount}
                          </div>

                          <div className={cn('mt-1.5 h-1.5 w-full rounded-full overflow-hidden', theme.bar)}>
                            <div
                              className={cn('h-full rounded-full transition-all', theme.barFill)}

                              style={{
                                width: `${Math.max(
                                  0,
                                  Math.min(
                                    100,
                                    (remaining / Math.max(1, Math.round((lead.deadlineAt - lead.createdAt) / 1000))) * 100,
                                  ),
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                        )}
                      </td>
                      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={lead.displayStatus}
                          onValueChange={(value) => updateDisplayStatus(lead.id, value as LeadStatus)}
                        >
                          <SelectTrigger
                            className={cn(
                              'h-7 px-2 text-[11px] font-medium whitespace-nowrap border gap-1 w-auto min-w-[120px]',
                              statusColors[lead.displayStatus],
                            )}
                          >
                            <SelectValue>{statusLabels[lead.displayStatus]}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_ORDER.map((status) => (
                              <SelectItem key={status} value={status} className="text-xs">
                                <span className={cn('inline-block px-2 py-0.5 rounded', statusColors[status])}>
                                  {statusLabels[status]}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-2">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            className="h-5 w-5 rounded border border-input text-xs leading-none"
                            onClick={() => adjustDials(lead.id, -1)}
                          >
                            −
                          </button>
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-semibold tabular-nums">{lead.dials}</span>
                          <button
                            type="button"
                            className="h-5 w-5 rounded border border-input text-xs leading-none"
                            onClick={() => adjustDials(lead.id, 1)}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="h-7 w-7 rounded-md border-2 border-orange-500 flex items-center justify-center">
                            <ChevronDown className="h-3.5 w-3.5 text-orange-600" />
                          </span>
                          <a href={`tel:${lead.phone}`} className="h-7 w-7 rounded-md flex items-center justify-center text-emerald-600 hover:bg-emerald-50">
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                          <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs text-muted-foreground">
                            <StickyNote className="h-3 w-3" /> Notes
                          </span>
                          <Mail className="h-4 w-4 text-blue-600" />
                          <Bell className="h-4 w-4 text-muted-foreground" />
                          <span className="inline-flex items-center gap-1 rounded-md border border-orange-300 px-2 py-1 text-xs font-medium text-orange-600">
                            <FileText className="h-3 w-3" /> Quote
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 whitespace-nowrap">
                            <span className="h-4 w-4 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center">
                              {agent.name.charAt(0)}
                            </span>
                            {agent.name}
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </span>
                          {!expired && (
                            <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50/70 px-2 py-0.5 text-[11px] font-medium text-teal-700 whitespace-nowrap">
                              Reserved
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-xs font-bold text-blue-700">F</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        test.lead@example.com
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>

        <div className="bg-muted/40 px-5 py-3 flex items-center gap-3 border-t border-border">
          <span className="h-6 w-6 rounded-full bg-card border border-border flex items-center justify-center shrink-0">
            <Clock className="h-3 w-3 text-primary" />
          </span>
          <p className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">Tip:</span> practice leads are reserved privately to one
            agent at a time, so there's no need to rush or compete — everything here is wiped when you clear it or
            reload.
          </p>
        </div>
      </section>
    </div>
  );

};

export default OpenRoundRobinTestPanel;