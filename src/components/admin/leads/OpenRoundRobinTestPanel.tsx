import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Check,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useSandboxLiveLeads } from '@/hooks/useSandboxLiveLeads';
import { useLeadDistribution } from '@/hooks/useLeadDistribution';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { cn } from '@/lib/utils';
import type { LeadStatus } from '@/hooks/useLeads';
import { OrrLogicExplainer, DEFAULT_ORR_CADENCE, type OrrCadenceConfig } from './OrrLogicExplainer';

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
  not_eligible: 'bg-orange-50 text-orange-800',
  unsubscribed: 'bg-rose-200 text-rose-900',
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
  not_eligible: 'Not eligible',
  unsubscribed: 'Unsubscribed',
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
  'not_eligible',
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
  email: string;
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
  /** Dials logged today, used for the day-one calling cadence. */
  dayDials: number;
  /** When the next call attempt is due (start of the next calling window). */
  nextCallAt: number | null;
  /** Set once the day's attempts are used up — the lead hands over to Team Red. */
  redTeamAt: number | null;
  /** 0 = day one. 1–7 = the seven-day follow-up chase (max 2 dials a day). */
  followUpDay: number;
  /** True once the seven-day follow-up chase is finished with no contact. */
  chaseComplete: boolean;
}


/**
 * Day-one calling cadence — every figure below is driven by the manager-editable
 * variables in the "How Open Round Robin works" section, so the practice run can
 * be re-timed without touching code.
 */
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;

const callWindows = (cfg: OrrCadenceConfig) => [
  { key: 'morning', label: `Morning (${hourLabel(cfg.morningStart)}–${hourLabel(cfg.morningEnd)})`, startH: cfg.morningStart, endH: cfg.morningEnd },
  { key: 'lunch', label: `Lunchtime (${hourLabel(cfg.lunchStart)}–${hourLabel(cfg.lunchEnd)})`, startH: cfg.lunchStart, endH: cfg.lunchEnd },
  { key: 'evening', label: `End of day (${hourLabel(cfg.eveningStart)}–${hourLabel(cfg.eveningEnd)})`, startH: cfg.eveningStart, endH: cfg.eveningEnd },
];

const atHour = (ref: number, hour: number, dayOffset = 0) => {
  const d = new Date(ref);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
};

/** Full-day allowance if the lead arrived before midday, otherwise the shorter one. */
const maxDialsForLead = (createdAt: number, cfg: OrrCadenceConfig) =>
  new Date(createdAt).getHours() < 12 ? cfg.maxDialsFullDay : cfg.maxDialsAfterMidday;

/** The next calling window that starts after `from` (rolls to tomorrow morning). */
const nextCallWindow = (from: number, cfg: OrrCadenceConfig) => {
  const windows = callWindows(cfg);
  for (const win of windows) {
    const start = atHour(from, win.startH);
    const end = atHour(from, win.endH);
    if (from < start) return { label: win.label, at: start };
    if (from < end) return { label: win.label, at: from };
  }
  return { label: `${windows[0].label} tomorrow`, at: atHour(from, windows[0].startH, 1) };
};


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

const formatTimeOfDay = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

/** "Aug 16, 2026 08:13" — same shape as the live New Leads table. */
const formatLeadDate = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

/** "1 minute ago" style relative label. */
const formatAgo = (ms: number) => {
  const secs = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (secs < 60) return `${secs} second${secs === 1 ? '' : 's'} ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};




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


/**
 * Once an agent has logged a dial the lead stops counting down — the attempt
 * was made, so it stays with them until they record an outcome. It is only
 * offered elsewhere if the window runs out with no dial at all.
 */
const hasAttempted = (lead: DummyLead) => lead.dials > 0;

/** An agent is busy while they hold a live (not yet expired) dummy lead. */
const isHeldLive = (lead: DummyLead, now: number) =>
  lead.status !== 'dormant' &&
  lead.status !== 'queued' &&
  lead.assignedTo !== null &&
  (hasAttempted(lead) || lead.deadlineAt > now);


/**
 * One-at-a-time ORR engine: an agent may only ever hold ONE dummy lead.
 * Expired leads roll to the next free agent; if everyone is busy the lead waits in the queue.
 */
const advance = (
  input: DummyLead[],
  startIndex: number,
  now: number,
  cfg: OrrCadenceConfig,
  roster: DummyAgent[] = DUMMY_AGENTS,
) => {
  const leads = input.map((lead) => ({ ...lead }));
  let index = roster.length ? startIndex % roster.length : 0;
  let reassigned = 0;
  let dormant = 0;

  const busy = new Set(leads.filter((lead) => isHeldLive(lead, now)).map((lead) => lead.assignedTo as string));

  const takeFreeAgent = (): DummyAgent | null => {
    for (let step = 0; step < roster.length; step += 1) {
      const candidate = roster[(index + step) % roster.length];
      if (!busy.has(candidate.id)) {
        index = (index + step + 1) % roster.length;
        busy.add(candidate.id);
        return candidate;
      }
    }
    return null;
  };


  // Oldest first, so waiting leads are handled before newly expired ones.
  const pending = leads
    .filter((lead) => lead.status !== 'dormant' && (lead.status === 'queued' || (!hasAttempted(lead) && lead.deadlineAt <= now)))
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const lead of pending) {
    if (lead.status !== 'queued' && lead.attemptCount >= cfg.maxAttempts) {
      lead.status = 'dormant';
      lead.assignedTo = null;
      lead.history = [...lead.history, `Moved to Dormant – No Contact after ${cfg.maxAttempts} unanswered attempts`];
      dormant += 1;
      continue;
    }

    const agent = takeFreeAgent();
    if (!agent) {
      if (lead.status !== 'queued') {
        lead.status = 'queued';
        lead.assignedTo = null;
        lead.history = [
          ...lead.history,
          cfg.whenAllBusy === 'queue'
            ? 'All agents busy — waiting in the open pool queue (oldest first, released as soon as someone frees up)'
            : 'All agents busy — kept circulating round the rotation until someone frees up',
        ];
      }
      continue;
    }

    const attempt = lead.status === 'queued' && lead.attemptCount === 0 ? 1 : lead.attemptCount + 1;
    lead.status = attempt === 1 ? 'new' : 'reassigned';
    lead.displayStatus = 'new';
    lead.assignedTo = agent.id;
    lead.attemptCount = attempt;
    lead.deadlineAt = now + cfg.claimWindowSeconds * 1000;
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

const ORR_SHARED_THEME: Omit<OrrTheme, 'label'> = {
  cardBorder: 'border-l-teal-500',
  iconWrap: 'bg-teal-100',
  icon: 'text-teal-600',
  chip: 'bg-teal-100 text-teal-800 border border-teal-200',
  holdBox: 'border-teal-100 bg-teal-50/40',
  holdLabel: 'text-teal-800',
  holdValue: 'text-teal-900',
  holdIcon: 'text-teal-600',
  bar: 'bg-teal-100',
  barFill: 'bg-teal-500',
  reserved: 'border-teal-200 bg-teal-50/70 text-teal-700',
};

const ORR_THEMES: Record<OrrPracticeTeam, OrrTheme> = {
  blue: { label: 'Team Blue', ...ORR_SHARED_THEME },
  red: { label: 'Team Red', ...ORR_SHARED_THEME },
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
  const [simulatedAgentId, setSimulatedAgentId] = useState<string>('all');
  // How many agents are "on shift" for this rehearsal (1–4).
  const [agentCount, setAgentCount] = useState(DUMMY_AGENTS.length);
  const roster = useMemo(() => DUMMY_AGENTS.slice(0, agentCount), [agentCount]);
  const rosterRef = useRef(roster);
  useEffect(() => {
    rosterRef.current = roster;
    if (simulatedAgentId !== 'all' && !roster.some((a) => a.id === simulatedAgentId)) {
      setSimulatedAgentId('all');
    }
  }, [roster, simulatedAgentId]);

  const [tick, setTick] = useState(0);
  // 'practice' = made-up TEST leads. 'live' = a READ-ONLY copy of the leads we
  // really received, so ORR can be proven against real-world data while it is
  // still switched off. Live mode never writes: New Leads stays untouched.
  const [dataSource, setDataSource] = useState<'practice' | 'live'>('practice');
  const {
    leads: liveLeads,
    loading: liveLoading,
    error: liveError,
    refresh: refreshLive,
  } = useSandboxLiveLeads(dataSource === 'live', { window: 'recent', limit: 25 });

  // Manager-editable timing / frequency rules for this practice run.
  const [cadence, setCadence] = useState<OrrCadenceConfig>(DEFAULT_ORR_CADENCE);
  const cadenceRef = useRef(cadence);
  useEffect(() => {
    cadenceRef.current = cadence;
  }, [cadence]);



  // Practice-only pause toggle. This is deliberately LOCAL state: this panel must
  // never write anything, so rehearsing "focus on current leads" here does NOT
  // change the real agent presence used by live lead distribution.
  const [isPausedReceiving, setIsPausedReceiving] = useState(false);
  const [togglingPause] = useState(false);
  const handlePauseToggle = () => {
    setIsPausedReceiving((paused) => !paused);
  };

  // 1s clock + automatic sweep so expired dummy leads never sit around for hours.
  useEffect(() => {
    const clock = window.setInterval(() => {
      setTick((current) => current + 1);
      const now = Date.now();
      setLeads((current) => {
        const needsWork = current.some(
          (lead) => lead.status !== 'dormant' && (lead.status === 'queued' || (!hasAttempted(lead) && lead.deadlineAt <= now)),
        );
        if (!needsWork) return current;
        const result = advance(current, nextAgentIndexRef.current, now, cadenceRef.current, rosterRef.current);

        nextAgentIndexRef.current = result.index;
        return result.leads;
      });
    }, 1000);
    return () => window.clearInterval(clock);
  }, []);

  const visibleLeads = useMemo(
    () =>
      leads.filter(
        (lead) =>
          lead.status !== 'dormant' &&
          (simulatedAgentId === 'all'
            ? lead.assignedTo !== null || lead.status === 'queued'
            : lead.assignedTo === simulatedAgentId),
      ),
    [leads, simulatedAgentId],
  );


  const queuedLeads = useMemo(() => leads.filter((lead) => lead.status === 'queued'), [leads]);

  /** Everyone holding a live lead means the next arrival has to wait. */
  const allAgentsBusy = useMemo(() => {
    const now = Date.now();
    const busy = new Set(leads.filter((lead) => isHeldLive(lead, now)).map((lead) => lead.assignedTo));
    return roster.every((agent) => busy.has(agent.id));
  }, [leads, tick, roster]);


  /**
   * A new enquiry is offered by the rotation — never handed to whoever pressed the
   * button. If every agent is busy it waits instead of landing on a live call.
   */
  const createTestLead = useCallback(() => {

    const now = Date.now();

    setLeads((current) => {
      const leadNumber = current.length + 1;
      const busy = new Set(current.filter((lead) => isHeldLive(lead, now)).map((lead) => lead.assignedTo as string));

      let offeredTo: DummyAgent | null = null;
      const activeRoster = rosterRef.current;
      for (let step = 0; step < activeRoster.length; step += 1) {
        const candidate = activeRoster[(nextAgentIndexRef.current + step) % activeRoster.length];
        if (!busy.has(candidate.id)) {
          nextAgentIndexRef.current = (nextAgentIndexRef.current + step + 1) % activeRoster.length;

          offeredTo = candidate;
          break;
        }
      }

      const draft: DummyLead = {
        id: `dummy-orr-${now}-${Math.random().toString(36).slice(2, 7)}`,
        firstName: 'TEST',
        lastName: `Lead ${String(leadNumber).padStart(2, '0')}`,
        email: `test.lead${leadNumber}@example.com`,
        status: offeredTo ? 'new' : 'queued',
        displayStatus: 'new',
        assignedTo: offeredTo ? offeredTo.id : null,
        attemptCount: offeredTo ? 1 : 0,
        deadlineAt: offeredTo ? now + cadenceRef.current.claimWindowSeconds * 1000 : now,
        vehicleReg: 'TEST123',
        phone: '07902222222',
        createdAt: now,
        dials: 0,
        contactedAt: null,
        dayDials: 0,
        nextCallAt: null,
        redTeamAt: null,
        followUpDay: 0,
        chaseComplete: false,
        history: offeredTo
          ? [`Created — attempt 1 offered to ${offeredTo.name} by the rotation`]
          : ['Created — every agent is on a call, waiting in the open pool queue'],
      };

      window.setTimeout(() => {
        toast(
          offeredTo
            ? {
                title: `Offered to ${offeredTo.name}`,
                description: `The rotation picked the next free agent — ${Math.round(cadenceRef.current.claimWindowSeconds)} seconds to make the first call.`,
              }
            : {
                title: 'Everyone is busy — lead is waiting',
                description: 'No agent is free, so the lead waits in the queue and is released to the first agent who frees up.',
              },
        );
      }, 0);

      return [draft, ...current];
    });
  }, [toast]);

  /**
   * Overnight leads: enquiries that arrived while nobody was on shift are parked
   * and released into this same flow at 09:00. From then on the day continues as
   * normal — same table, same columns, same rules.
   */
  const [overnightParked, setOvernightParked] = useState(12);
  const [morningReleasedAt, setMorningReleasedAt] = useState<Date | null>(null);

  const releaseOvernight = useCallback(() => {
    const count = overnightParked;
    if (count <= 0) return;
    const now = Date.now();

    setLeads((current) => {
      const activeRoster = rosterRef.current;
      let index = activeRoster.length ? nextAgentIndexRef.current % activeRoster.length : 0;
      const busy = new Set(
        current.filter((lead) => isHeldLive(lead, now)).map((lead) => lead.assignedTo as string),
      );
      const drafts: DummyLead[] = [];

      for (let i = 0; i < count; i += 1) {
        let offeredTo: DummyAgent | null = null;
        for (let step = 0; step < activeRoster.length; step += 1) {
          const candidate = activeRoster[(index + step) % activeRoster.length];
          if (!busy.has(candidate.id)) {
            index = (index + step + 1) % activeRoster.length;
            busy.add(candidate.id);
            offeredTo = candidate;
            break;
          }
        }


        const leadNumber = current.length + i + 1;
        drafts.push({
          id: `dummy-orr-overnight-${now}-${i}`,
          firstName: 'TEST',
          lastName: `Overnight ${String(i + 1).padStart(2, '0')}`,
          email: `overnight.lead${leadNumber}@example.com`,
          status: offeredTo ? 'new' : 'queued',
          displayStatus: 'new',
          assignedTo: offeredTo ? offeredTo.id : null,
          attemptCount: offeredTo ? 1 : 0,
          deadlineAt: offeredTo ? now + cadenceRef.current.claimWindowSeconds * 1000 : now,
          vehicleReg: 'TEST123',
          phone: '07902222222',
          createdAt: now - (count - i) * 45 * 60 * 1000,
          dials: 0,
          contactedAt: null,
          dayDials: 0,
          nextCallAt: null,
          redTeamAt: null,
          followUpDay: 0,
          chaseComplete: false,
          history: offeredTo
            ? [`Arrived overnight — released at 09:00 and offered to ${offeredTo.name}`]
            : ['Arrived overnight — released at 09:00, waiting in the open pool queue'],
        });
      }

      nextAgentIndexRef.current = index;
      return [...drafts.reverse(), ...current];
    });

    setOvernightParked(0);
    setMorningReleasedAt(new Date());
    toast({
      title: '09:00 release done',
      description: `${count} overnight leads went into the same flow — one at a time, oldest first.`,
    });
  }, [overnightParked, toast]);



  /**
   * Self-claiming a waiting lead. Blocked unless a manager has switched the
   * permission on, so nobody can pull leads out of the queue for themselves.
   */
  const claimQueuedLead = (leadId: string) => {
    if (!cadence.allowSelfAssign) {
      toast({
        title: 'You cannot assign this lead to yourself',
        description: 'Waiting leads are handed out by the rotation. A manager has to grant self-assign permission first.',
        variant: 'destructive',
      });
      return;
    }
    const viewer = getAgent(simulatedAgentId);
    const now = Date.now();
    setLeads((current) =>
      current.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              status: 'new',
              assignedTo: viewer.id,
              attemptCount: Math.max(1, lead.attemptCount),
              deadlineAt: now + cadence.claimWindowSeconds * 1000,
              history: [...lead.history, `Self-assigned by ${viewer.name} with manager permission`],
            }
          : lead,
      ),
    );
    toast({ title: 'Lead claimed', description: `${viewer.name} took a waiting lead with manager permission.` });
  };


  // A dial only logs an attempt. It never marks the lead as spoken to and never
  // hands ownership over — the agent must pick an outcome status (Spoken to,
  // Quote sent, etc.) for that to happen.
  const adjustDials = (id: string, delta: number) => {
    setLeads((current) =>
      current.map((lead) => {
        if (lead.id !== id) return lead;
        const dials = Math.max(0, lead.dials + delta);
        return {
          ...lead,
          dials,
          history: [...lead.history, `Manual dial counter ${delta > 0 ? '+1' : '-1'} (no outcome recorded)`],
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

  /**
   * One-click “couldn’t connect / no answer”: logs the dial and applies the cadence.
   * Day one: up to 3 dials (2 if the lead arrived after midday), then handover to
   * Team Red at 6pm. After that the lead is chased for the next seven days with a
   * maximum of two dials a day, for as long as it stays uncontacted and unowned.
   */
  const recordNoAnswer = (id: string) => {
    let toastTitle = 'No answer recorded';
    let toastBody = '';
    setLeads((current) =>
      current.map((lead) => {
        if (lead.id !== id) return lead;
        const now = Date.now();
        const dials = lead.dials + 1;
        const dayDials = lead.dayDials + 1;
        const inChase = lead.followUpDay > 0;
        const maxDials = inChase ? cadence.followUpDailyDials : maxDialsForLead(lead.createdAt, cadence);
        const exhausted = dayDials >= maxDials;
        const nextWin = nextCallWindow(now + 60_000, cadence);
        const nextDay = lead.followUpDay + 1;
        const chaseOver = exhausted && nextDay > cadence.followUpDays;
        const nextDayAt = atHour(now, callWindows(cadence)[0].startH, 1);

        const notes: string[] = [
          `No answer — dial ${dayDials} of ${maxDials} today (${dials} total)${inChase ? ` · follow-up day ${lead.followUpDay} of ${cadence.followUpDays}` : ''}`,
        ];
        if (!exhausted) {
          notes.push(`Next attempt due ${nextWin.label} at ${formatTimeOfDay(nextWin.at)}`);
          toastBody = `Dial logged. Next attempt due ${nextWin.label} at ${formatTimeOfDay(nextWin.at)}.`;
        } else if (chaseOver) {
          notes.push(`Seven-day follow-up finished with no contact — no further dials scheduled`);
          toastTitle = 'Follow-up finished';
          toastBody = 'Seven days of chasing are done with no contact. No further dials are scheduled.';
        } else if (!inChase) {
          notes.push(`Day's attempts used — handing over to Team Red at ${formatTimeOfDay(atHour(now, cadence.redTeamHandoverHour))}`);
          notes.push(`Seven-day follow-up starts tomorrow — up to ${cadence.followUpDailyDials} dials a day while the lead is uncontacted and unowned`);
          toastTitle = 'Attempts used — moving to Team Red';
          toastBody = `Day one is done. The seven-day follow-up starts tomorrow at ${formatTimeOfDay(nextDayAt)} with up to ${cadence.followUpDailyDials} dials a day.`;
        } else {
          notes.push(`Follow-up day ${lead.followUpDay} done — day ${nextDay} of ${cadence.followUpDays} resumes at ${formatTimeOfDay(nextDayAt)}`);
          toastTitle = `Follow-up day ${lead.followUpDay} done`;
          toastBody = `Both dials used. Day ${nextDay} of ${cadence.followUpDays} resumes at ${formatTimeOfDay(nextDayAt)}.`;
        }

        return {
          ...lead,
          dials,
          dayDials: exhausted ? 0 : dayDials,
          displayStatus: 'no_answer',
          followUpDay: exhausted && !chaseOver ? nextDay : lead.followUpDay,
          chaseComplete: chaseOver,
          nextCallAt: chaseOver ? null : exhausted ? nextDayAt : nextWin.at,
          redTeamAt: !inChase && exhausted ? atHour(now, cadence.redTeamHandoverHour) : lead.redTeamAt,
          history: [...lead.history, ...notes],
        };
      }),
    );
    toast({ title: toastTitle, description: toastBody });
  };




  const runSweep = () => {

    const now = Date.now();
    setLeads((current) => {
      const result = advance(current, nextAgentIndexRef.current, now, cadenceRef.current);
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

  /**
   * Load a read-only copy of the real leads into the practice queue. They enter
   * as waiting leads so the rotation offers them exactly as it would live.
   * Nothing here is written back to the database.
   */
  const loadLiveLeadsIntoPractice = useCallback(() => {
    const now = Date.now();
    const drafts: DummyLead[] = liveLeads.map((lead) => ({
      id: `live-orr-${lead.id}`,
      firstName: lead.firstName || 'Customer',
      lastName: lead.lastName || '',
      email: lead.email,
      status: 'queued',
      displayStatus: 'new',
      assignedTo: null,
      attemptCount: 0,
      deadlineAt: now,
      vehicleReg: lead.reg,
      phone: lead.phone,
      createdAt: lead.createdAt.getTime(),
      dials: 0,
      contactedAt: null,
      dayDials: 0,
      nextCallAt: null,
      redTeamAt: null,
      followUpDay: 0,
      chaseComplete: false,
      history: ['Read-only copy of a live lead — loaded for practice, nothing is written back'],
    }));
    setLeads(drafts);
    nextAgentIndexRef.current = 0;
    toast({
      title: drafts.length ? `${drafts.length} live leads loaded (read-only)` : 'No live leads found',
      description: drafts.length
        ? 'The rotation will offer them exactly as it would live. Nothing is saved and New Leads is untouched.'
        : 'No leads in the last 7 days matched. Try Refresh live leads.',
    });
  }, [liveLeads, toast]);

  const cleanup = () => {
    setLeads([]);
    nextAgentIndexRef.current = 0;
    setOvernightParked(12);
    setMorningReleasedAt(null);
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
              <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1 leading-relaxed max-w-2xl">
                <li>Rehearse the 2-minute first-call window, pass-on, agent view, phone column, click-to-dial and copy button.</li>
                <li>{dataSource === 'live' ? 'Live leads mode shows a read-only copy of real leads.' : 'Every name here is made up.'}</li>
                <li>Nothing is written back, no customer is contacted and no agent's figures change.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-border rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-foreground">Agents on shift</span>
            <div className="inline-flex items-center rounded-md border border-border overflow-hidden">
              {[1, 2, 3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => { setAgentCount(count); setLeads([]); nextAgentIndexRef.current = 0; }}
                  className={cn(
                    'px-3 py-1.5 text-xs font-semibold transition-colors',
                    agentCount === count ? 'bg-teal-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted',
                  )}
                >
                  {count} {count === 1 ? 'agent' : 'agents'}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              On now: {roster.map((a) => a.name).join(', ')}
            </span>
          </div>
          <ul className="mt-2 text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
            <li>Change how many agents are working, then run the 09:00 release or take leads.</li>
            <li>With one agent, every lead queues behind the one they are holding.</li>
            <li>Changing this clears the practice list so the rotation starts clean.</li>
          </ul>
        </div>


        <div className="mt-5 pt-4 border-t border-border rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-amber-900">Start of day — 09:00 release</span>
            <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
              {overnightParked} waiting from overnight
            </span>
            <Button size="sm" onClick={releaseOvernight} disabled={overnightParked === 0 || dataSource === 'live'}>
              <Play className="h-3.5 w-3.5 mr-1.5" /> Run the 09:00 release
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setOvernightParked((n) => n + 12); setMorningReleasedAt(null); }}
              disabled={dataSource === 'live'}
              title="Park another overnight batch so you can run the 09:00 release again"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Park another overnight batch
            </Button>
            {morningReleasedAt ? (
              <span className="text-xs text-amber-900/80">
                Released at {morningReleasedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} — the day now carries on below.
              </span>
            ) : (
              <span className="text-xs text-amber-900/80">Not run yet in this practice session.</span>
            )}
          </div>
          <ul className="mt-2 text-xs text-amber-900/90 list-disc pl-4 space-y-0.5">
            <li>Leads that come in overnight are parked and handed out from 09:00.</li>
            <li>They go into the same list below, oldest first, one lead at a time.</li>
            <li>After the release, new leads keep arriving into that same list all day.</li>
          </ul>
        </div>

        <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => { setDataSource('practice'); setLeads([]); nextAgentIndexRef.current = 0; }}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold transition-colors',
                dataSource === 'practice' ? 'bg-teal-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              Made-up names
            </button>
            <button
              type="button"
              onClick={() => { setDataSource('live'); setLeads([]); nextAgentIndexRef.current = 0; }}
              title="Rehearse against the real leads we received. Read-only copy — nothing is written back and New Leads is untouched."
              className={cn(
                'px-3 py-1.5 text-xs font-semibold border-l border-border transition-colors',
                dataSource === 'live' ? 'bg-teal-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              Live leads (read-only)
            </button>
          </div>
          {dataSource === 'live' && (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                Live data · read-only · nothing saved
              </span>
              <Button size="sm" variant="outline" onClick={loadLiveLeadsIntoPractice} disabled={liveLoading}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Load live leads ({liveLeads.length})
              </Button>
              <Button size="sm" variant="outline" onClick={() => void refreshLive()} disabled={liveLoading}>
                <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', liveLoading && 'animate-spin')} /> Refresh live leads
              </Button>
              {liveError && <span className="text-xs text-destructive">{liveError}</span>}
            </>
          )}
          <Button size="sm" onClick={createTestLead} disabled={dataSource === 'live'} title={dataSource === 'live' ? 'Live leads mode uses the real leads — use Load live leads instead.' : undefined}>
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

      {/* Rules, timings and editable variables */}
      <OrrLogicExplainer config={cadence} onChange={setCadence} teamLabel={theme.label} />

      {allAgentsBusy && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <p className="font-semibold">Every agent is on a call.</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>
              {cadence.whenAllBusy === 'queue'
                ? 'New enquiries wait in the open pool queue, oldest first.'
                : 'New enquiries keep circulating round the rotation.'}
            </li>
            <li>
              {cadence.whenAllBusy === 'queue'
                ? 'The first agent who frees up gets the oldest waiting lead — not whoever clicks fastest.'
                : 'They are re-offered until an agent frees up and answers.'}
            </li>
          </ul>
        </div>
      )}


      {/* Agent preview */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Agent preview</div>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              <li>See the page exactly as a sales agent would.</li>
              <li>Pick an agent from the list to switch their view.</li>
              <li>Choose &ldquo;Whole team&rdquo; to watch every lead in the flow at once.</li>
            </ul>
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
            <option value="all">Whole team — everyone&rsquo;s leads</option>
            {roster.map((agent) => (
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
              <h4 className="text-base font-semibold text-foreground">Practice New Leads — {theme.label}</h4>

              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                <li>Leads are assigned automatically in a fair rotation.</li>
                <li>Only one lead is reserved for an agent at a time.</li>
                <li>If the agent does not start a call in time, the lead passes to the next agent.</li>
              </ul>
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
          <div className="mb-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-2">
            <div>
              <strong className="text-foreground">{queuedLeads.length}</strong> practice lead{queuedLeads.length === 1 ? '' : 's'} waiting —
              everyone currently holds one. They release automatically as windows free up, so no one has to race.
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => claimQueuedLead(queuedLeads[0].id)}
                title={
                  cadence.allowSelfAssign
                    ? 'Manager permission granted — you may take a waiting lead'
                    : 'Blocked: only a manager can allow agents to take a waiting lead themselves'
                }
              >
                <Lock className="h-3 w-3 mr-1.5" /> Take a waiting lead myself
              </Button>
              <span className={cn('text-[11px] font-medium', cadence.allowSelfAssign ? 'text-emerald-700' : 'text-rose-700')}>
                {cadence.allowSelfAssign
                  ? 'Self-assign allowed by a manager'
                  : 'Self-assign blocked — the rotation decides who gets the lead'}
              </span>
            </div>
          </div>
        )}




        {visibleLeads.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-md bg-muted/30">
            {simulatedAgentId === 'all'
              ? 'No practice leads yet. Click Take this lead or run the 09:00 release.'
              : `No practice leads for ${getAgent(simulatedAgentId).name} right now — they may be with another agent. Switch to "Whole team" to see them all.`}
          </div>
        ) : (
          <div className="overflow-x-auto border border-border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-center w-11">#</th>
                  <th className="px-2 py-2 text-left w-9"></th>
                  <th className="px-2 py-2 text-left">Agent</th>
                  <th className="px-2 py-2 text-left">Time to Lead</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-center">Calls</th>
                  <th className="px-2 py-2 text-left">Actions</th>
                  <th className="px-2 py-2 text-left">Name</th>
                  <th className="px-2 py-2 text-left">Phone</th>
                  <th className="px-2 py-2 text-left">Email</th>
                  <th className="px-2 py-2 text-left">Reg</th>
                  <th className="px-2 py-2 text-left">Payment</th>
                  <th className="px-2 py-2 text-left">Paid Date</th>
                  <th className="px-2 py-2 text-left">Agent activity</th>
                  <th className="px-2 py-2 text-left">Lead Date</th>
                  <th className="px-2 py-2 text-left">Customer activity</th>
                  <th className="px-2 py-2 text-left">Time to contact</th>
                </tr>
              </thead>
              <tbody>
                {visibleLeads.map((lead, rowIndex) => {
                  const now = Date.now();
                  const remainingMs = lead.deadlineAt - now;
                  const remaining = Math.max(0, Math.round(remainingMs / 1000));
                  const attempted = lead.dials > 0;
                  const expired = remainingMs <= 0 && !attempted;

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
                      <td className="px-2 py-2">
                        <div className="flex flex-col items-start gap-1">
                          {lead.assignedTo === null ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 whitespace-nowrap">
                              <Clock className="h-3 w-3" /> Waiting in the open pool
                            </span>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 whitespace-nowrap">
                                <span className="h-4 w-4 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center">
                                  {agent.name.charAt(0)}
                                </span>
                                {agent.name}
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              </span>
                              {!expired && (
                                <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', theme.reserved)}>
                                  Reserved
                                </span>
                              )}
                            </>
                          )}
                        </div>
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
                          ) : attempted ? (
                            <>
                              <div className={cn('inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap', theme.holdLabel)}>
                                <Lock className={cn('h-3 w-3', theme.holdIcon)} /> Still yours
                              </div>
                              <div className={cn('text-sm font-semibold', theme.holdValue)}>
                                Dial logged — set an outcome
                              </div>
                            </>
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

                          {lead.chaseComplete ? (
                            <div className="mt-1.5 rounded border border-slate-300 bg-slate-50 px-2 py-1">
                              <div className="text-[11px] font-semibold text-slate-800">
                                Seven-day follow-up finished
                              </div>
                              <div className="text-[10px] text-slate-600">
                                No contact made · {lead.dials} dials in total
                              </div>
                            </div>
                          ) : lead.followUpDay > 0 ? (
                            <div className="mt-1.5 rounded border border-purple-300 bg-purple-50 px-2 py-1">
                              <div className="text-[11px] font-semibold text-purple-900">
                                Follow-up day {lead.followUpDay} of {cadence.followUpDays}
                                {lead.nextCallAt ? ` · next call ${formatTimeOfDay(lead.nextCallAt)}` : ''}
                              </div>
                              <div className="text-[10px] text-purple-800/80">
                                Dial {lead.dayDials} of {cadence.followUpDailyDials} today · chased while uncontacted and unowned
                              </div>
                            </div>
                          ) : lead.redTeamAt ? (
                            <div className="mt-1.5 rounded border border-red-300 bg-red-50 px-2 py-1">
                              <div className="text-[11px] font-semibold text-red-800">
                                Moving to Team Red at {formatTimeOfDay(lead.redTeamAt)}
                              </div>
                              <div className="text-[10px] text-red-700/80">
                                Seven-day follow-up starts tomorrow · up to {cadence.followUpDailyDials} dials a day
                              </div>
                            </div>
                          ) : lead.nextCallAt ? (
                            <div className="mt-1.5 rounded border border-amber-300 bg-amber-50 px-2 py-1">
                              <div className="text-[11px] font-semibold text-amber-900">
                                Next call due {formatTimeOfDay(lead.nextCallAt)}
                              </div>
                              <div className="text-[10px] text-amber-800/80">
                                Dial {lead.dayDials} of {maxDialsForLead(lead.createdAt, cadence)} today
                              </div>
                            </div>
                          ) : null}

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
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => recordNoAnswer(lead.id)}
                                  className="h-7 rounded-md border border-amber-300 px-2 text-xs font-medium text-amber-700 hover:bg-amber-50"
                                >
                                  No answer
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                Couldn&apos;t connect / no answer
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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
                      <td className="px-2 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        <CopyEmail email={lead.email} />
                      </td>
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center rounded bg-yellow-300 px-2 py-1 text-xs font-bold text-yellow-950 font-mono">
                          {lead.vehicleReg}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">—</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">—</td>
                      <td className="px-2 py-2 text-xs whitespace-nowrap">
                        {lead.dials > 0 ? (
                          <div>
                            <div className="font-medium text-foreground">{lead.dials} dial{lead.dials === 1 ? '' : 's'} logged</div>
                            <div className="text-[11px] text-muted-foreground">practice · {formatAgo(lead.createdAt)}</div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-muted-foreground">No agent activity</div>
                            <div className="text-[11px] text-muted-foreground">sys {formatAgo(lead.createdAt)}</div>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {formatLeadDate(lead.createdAt)}
                      </td>
                      <td className="px-2 py-2 text-xs whitespace-nowrap">
                        <div className="text-muted-foreground">{formatAgo(lead.createdAt)}</div>
                        <div className="text-[11px] font-medium text-foreground">Shopping page</div>
                      </td>
                      <td className="px-2 py-2 text-xs whitespace-nowrap">
                        {lead.contactedAt ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
                            {formatClock(Math.max(0, Math.round((lead.contactedAt - lead.createdAt) / 1000)))}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
                            Not contacted
                          </span>
                        )}
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
            <span className="font-semibold text-foreground">Day one calling plan:</span>{' '}
            {callWindows(cadence).map((w) => w.label).join(', ')}. Maximum {cadence.maxDialsFullDay} dials in a full day,
            or {cadence.maxDialsAfterMidday} if the lead arrives after midday. Once those attempts are used the lead hands
            over to Team Red at {formatTimeOfDay(atHour(Date.now(), cadence.redTeamHandoverHour))} the same day, then is
            chased for {cadence.followUpDays} days with up to {cadence.followUpDailyDials} dials a day. Practice leads are
            reserved privately to one agent and wiped when you clear or reload. Change any of these figures in the section
            above.
          </p>


        </div>
      </section>
    </div>
  );

};

export default OpenRoundRobinTestPanel;