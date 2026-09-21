import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  FlaskConical,
  Mail,
  MessageSquare,
  Moon,
  Zap,
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useSandboxLiveLeads } from '@/hooks/useSandboxLiveLeads';
import { useLeadDistribution } from '@/hooks/useLeadDistribution';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { cn } from '@/lib/utils';
import type { LeadStatus } from '@/hooks/useLeads';
import { OrrLogicExplainer, DEFAULT_ORR_CADENCE, type OrrCadenceConfig } from './OrrLogicExplainer';
import {
  OrrSandboxLeadsChrome,
  type SandboxChromeLead,
  type SandboxStatusChip,
} from './OrrSandboxLeadsChrome';

type DummyLeadStatus = 'queued' | 'new' | 'reassigned';

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
  'unsubscribed',
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
  /** Set once the day's attempts are used up — the lead hands over to Team Green. */
  greenTeamAt: number | null;
  /** 0 = day one. 1–7 = the seven-day follow-up chase (max 2 dials a day). */
  followUpDay: number;
  /** True once the seven-day follow-up chase is finished with no contact. */
  chaseComplete: boolean;
  /** True while the lead waits for its next eligible calling window. */
  waiting?: boolean;
  /** Last recorded outcome, shown to the next salesperson as context. */
  previousOutcome?: string;
  /** A dial was logged during the current reservation. */
  dialedThisOffer?: boolean;
  /** When the lead may re-enter Open Round Robin (staffed window aware). */
  eligibleAt?: number | null;
  /** Practice notes typed by whoever is rehearsing as the agent. Never saved anywhere. */
  notes?: { at: number; by: string; text: string }[];
  /** Which system the lead arrived under. 'rr' leads have no countdown and never move on. */
  source?: 'orr' | 'rr';
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
  { id: 'dummy-aisha', name: 'Aisha', extension: '206', order: 5 },
  { id: 'dummy-liam', name: 'Liam', extension: '207', order: 6 },
  { id: 'dummy-chloe', name: 'Chloe', extension: '208', order: 7 },
  { id: 'dummy-mo', name: 'Mo', extension: '209', order: 8 },
];

const AGENT_COUNT_OPTIONS = [1, 2, 3, 4, 6, 8];

const getAgent = (agentId: string | null) => DUMMY_AGENTS.find((agent) => agent.id === agentId) ?? DUMMY_AGENTS[0];



const formatClock = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${secs}s`;
};

/** Full duration with seconds — "1h 05m 12s", "12m 04s", "45s". */
const formatHMS = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(secs)}s`;
  if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(secs)}s`;
  if (minutes > 0) return `${minutes}m ${pad(secs)}s`;
  return `${secs}s`;
};

/** Reservation countdown wording — "1m 23sec", "42sec". */
const formatHold = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}sec` : `${secs}sec`;
};

/* ------------------------------------------------------------------
 * Staffed calling windows
 * Weekdays 09:00–18:00, weekends an ad-hoc 10:00–13:00 window.
 * Genuine attempts must sit at least 3 hours apart; up to 2 a weekday,
 * normally 1 on a weekend day.
 * ------------------------------------------------------------------ */
const MIN_GAP_HOURS = 3;
const CONTACT_DAYS = 7;

const isWeekendDay = (ms: number) => {
  const d = new Date(ms).getDay();
  return d === 0 || d === 6;
};

const windowFor = (ms: number): [number, number] => (isWeekendDay(ms) ? [10, 13] : [9, 18]);

/** Calls allowed on the contact day that `ms` falls in. */
const callsAllowedOn = (ms: number) => (isWeekendDay(ms) ? 1 : 2);

/** The first staffed moment at or after `from`. */
const nextStaffedTime = (from: number) => {
  let cursor = from;
  for (let i = 0; i < 14; i += 1) {
    const [open, close] = windowFor(cursor);
    const openAt = new Date(cursor);
    openAt.setHours(open, 0, 0, 0);
    const closeAt = new Date(cursor);
    closeAt.setHours(close, 0, 0, 0);
    if (cursor < openAt.getTime()) return openAt.getTime();
    if (cursor < closeAt.getTime()) return cursor;
    const next = new Date(cursor);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    cursor = next.getTime();
  }
  return from;
};

/** Start of the next staffed window strictly after the day `ms` sits in. */
const nextDayStaffedTime = (ms: number) => {
  const next = new Date(ms);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return nextStaffedTime(next.getTime());
};

/**
 * When a lead may return to Open Round Robin after a genuine attempt:
 * the real attempt time plus the minimum gap, never squeezed in after
 * the day's closing time.
 */
const nextEligibleAfterAttempt = (attemptAt: number) => {
  const earliest = attemptAt + MIN_GAP_HOURS * 3600 * 1000;
  const [, close] = windowFor(attemptAt);
  const closeAt = new Date(attemptAt);
  closeAt.setHours(close, 0, 0, 0);
  if (earliest >= closeAt.getTime()) return nextDayStaffedTime(attemptAt);
  return nextStaffedTime(earliest);
};

/** "today at 15:20", "Mon at 09:00" — salesperson-friendly. */
const formatEligible = (ms: number) => {
  const now = new Date();
  const then = new Date(ms);
  const sameDay = now.toDateString() === then.toDateString();
  const time = formatTimeOfDay(ms);
  if (sameDay) return `today at ${time}`;
  return `${then.toLocaleDateString('en-GB', { weekday: 'short' })} at ${time}`;
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
/** Notes button for a practice lead — read the notes so far and type a new one. */
const PracticeNotes = ({
  notes,
  onAdd,
}: {
  notes: { at: number; by: string; text: string }[];
  onAdd: (text: string) => void;
}) => {
  const [draft, setDraft] = useState('');
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors',
            notes.length
              ? 'border-primary/40 bg-primary/10 text-primary font-medium'
              : 'border-dashed border-border text-muted-foreground hover:bg-muted',
          )}
        >
          <StickyNote className="h-3 w-3" /> Notes{notes.length ? ` (${notes.length})` : ''}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-2">
        <div className="text-xs font-semibold text-foreground">Practice notes</div>
        {notes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No notes yet. Type what you would write after the call.</p>
        ) : (
          <ul className="max-h-40 space-y-1.5 overflow-y-auto">
            {notes
              .slice()
              .reverse()
              .map((note) => (
                <li key={note.at} className="rounded-md border border-border bg-muted/40 p-2">
                  <div className="text-[10px] font-medium text-muted-foreground">
                    {note.by} · {formatTimeOfDay(note.at)}
                  </div>
                  <div className="text-xs text-foreground whitespace-pre-wrap">{note.text}</div>
                </li>
              ))}
          </ul>
        )}
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="e.g. Spoke to customer, wants a quote for a 2019 Golf"
          className="min-h-[64px] text-xs"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">Practice only — nothing is saved.</span>
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!draft.trim()}
            onClick={() => {
              onAdd(draft);
              setDraft('');
            }}
          >
            Add note
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

/** A dial was logged during the salesperson's current reservation. */
const hasAttempted = (lead: DummyLead) => !!lead.dialedThisOffer;

/** An agent is busy while they hold a live (not yet expired) dummy lead. */
const isOrr = (lead: DummyLead) => (lead.source ?? 'orr') === 'orr';

/**
 * Once the salesperson records an outcome (anything other than "Not spoken to")
 * the current call attempt is finished.
 */
const isWorked = (lead: DummyLead) => lead.displayStatus !== 'new';

/** The current call opportunity is temporarily reserved for this salesperson. */
const isHeldLive = (lead: DummyLead, now: number) =>
  isOrr(lead) &&
  !lead.waiting &&
  lead.status !== 'queued' &&
  lead.assignedTo !== null &&
  !isWorked(lead) &&
  (hasAttempted(lead) || lead.deadlineAt > now);

/** How many waiting leads are fed back per sweep, so nothing arrives in one spike. */
const RELEASE_PER_SWEEP = 2;

/**
 * One-at-a-time ORR engine. A salesperson holds a temporary reservation for the
 * current attempt only. If the reservation lapses without a call the lead goes
 * straight back into the pool and no attempt is counted; the previous
 * salesperson gets no priority when it is offered again.
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

  // 1. Lapsed reservations release immediately — not counted as an attempt.
  for (const lead of leads) {
    if (
      isOrr(lead) &&
      !lead.waiting &&
      lead.assignedTo !== null &&
      !isWorked(lead) &&
      !hasAttempted(lead) &&
      lead.deadlineAt <= now
    ) {
      lead.assignedTo = null;
      lead.status = 'queued';
      lead.history = [...lead.history, 'Reservation ran out with no call — released back into Open Round Robin (no attempt counted)'];
    }
  }

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

  // 2. Waiting leads whose next eligible time has come, oldest/due first,
  //    staggered a couple at a time so nothing lands in one batch.
  const dueBack = leads
    .filter((lead) => isOrr(lead) && lead.waiting && !lead.chaseComplete && (lead.eligibleAt ?? 0) <= now)
    .sort((a, b) => (a.eligibleAt ?? 0) - (b.eligibleAt ?? 0))
    .slice(0, RELEASE_PER_SWEEP);

  for (const lead of dueBack) {
    lead.waiting = false;
    lead.status = 'queued';
    lead.assignedTo = null;
    lead.displayStatus = 'new';
    lead.eligibleAt = null;
    lead.history = [...lead.history, 'Back in Open Round Robin for its next attempt'];
  }

  // 3. Offer everything unowned to the next free salesperson.
  const pending = leads
    .filter((lead) => isOrr(lead) && !lead.waiting && !isWorked(lead) && lead.status === 'queued')
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const lead of pending) {
    const agent = takeFreeAgent();
    if (!agent) continue;

    lead.status = lead.dials === 0 ? 'new' : 'reassigned';
    lead.displayStatus = 'new';
    lead.assignedTo = agent.id;
    lead.dialedThisOffer = false;
    lead.followUpDay = Math.max(1, lead.followUpDay);
    lead.deadlineAt = now + cfg.claimWindowSeconds * 1000;
    lead.history = [...lead.history, `Held for ${agent.name} for this call attempt`];
    reassigned += 1;
  }

  return { leads, index, reassigned, managerAlerted: 0 };
};


export type OrrPracticeTeam = 'green';

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
  cardBorder: 'border-l-emerald-500',
  iconWrap: 'bg-emerald-100',
  icon: 'text-emerald-600',
  chip: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  holdBox: 'border-emerald-100 bg-emerald-50/40',
  holdLabel: 'text-emerald-800',
  holdValue: 'text-emerald-900',
  holdIcon: 'text-emerald-600',
  bar: 'bg-emerald-100',
  barFill: 'bg-emerald-500',
  reserved: 'border-emerald-200 bg-emerald-50/70 text-emerald-700',
};

const ORR_THEMES: Record<OrrPracticeTeam, OrrTheme> = {
  green: { label: 'Team Green', ...ORR_SHARED_THEME },
};


/**
 * Open Round Robin — frontend-only dummy test mode.
 * This intentionally does not call Supabase, RPCs, edge functions, or live lead tables.
 */
export const OpenRoundRobinTestPanel: React.FC<{ team?: OrrPracticeTeam }> = ({ team = 'green' }) => {
  const theme = ORR_THEMES[team];
  const { toast } = useToast();
  const [leads, setLeads] = useState<DummyLead[]>([]);
  const nextAgentIndexRef = useRef(0);
  const [simulatedAgentId, setSimulatedAgentId] = useState<string>('all');
  const [roleView, setRoleView] = useState<'manager' | 'agent'>('manager');
  const isManagerView = roleView === 'manager';
  // How many agents are "on shift" for this rehearsal (1–4).
  // Default rehearsal: two agents live, which is the everyday picture on the floor.
  const [agentCount, setAgentCount] = useState(2);
  const roster = useMemo(() => DUMMY_AGENTS.slice(0, agentCount), [agentCount]);
  const rosterRef = useRef(roster);
  useEffect(() => {
    rosterRef.current = roster;
    if (simulatedAgentId !== 'all' && !roster.some((a) => a.id === simulatedAgentId)) {
      setSimulatedAgentId(isManagerView ? 'all' : roster[0]?.id ?? 'all');
    }
    if (!isManagerView && simulatedAgentId === 'all' && roster[0]) {
      setSimulatedAgentId(roster[0].id);
    }
  }, [roster, simulatedAgentId, isManagerView]);


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
          (lead) => lead.status === 'queued' || (!hasAttempted(lead) && lead.deadlineAt <= now),
        );
        if (!needsWork) return current;

        const result = advance(current, nextAgentIndexRef.current, now, cadenceRef.current, rosterRef.current);

        nextAgentIndexRef.current = result.index;
        return result.leads;
      });
    }, 1000);
    return () => window.clearInterval(clock);
  }, []);

  // Same toolbar controls as the live New Leads page, working on practice leads only.
  const [chromeSearch, setChromeSearch] = useState('');
  const [chromeStatusChip, setChromeStatusChip] = useState<SandboxStatusChip>('all');
  const [chromeSort, setChromeSort] = useState<'newest' | 'oldest'>('newest');

  const rosterLeads = useMemo(
    () =>
      leads.filter((lead) =>
        simulatedAgentId === 'all'
          ? lead.assignedTo !== null || lead.status === 'queued'
          : lead.assignedTo === simulatedAgentId && !lead.waiting,
      ),
    [leads, simulatedAgentId],
  );

  const chromeLeads = useMemo<SandboxChromeLead[]>(
    () =>
      rosterLeads.map((lead) => ({
        id: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        vehicleReg: lead.vehicleReg,
        displayStatus: lead.displayStatus,
        createdAt: lead.createdAt,
      })),
    [rosterLeads],
  );

  const liveHeldCount = useMemo(() => {
    const now = Date.now();
    return rosterLeads.filter((lead) => isHeldLive(lead, now)).length;
  }, [rosterLeads, tick]);

  const visibleLeads = useMemo(() => {
    const term = chromeSearch.trim().toLowerCase();
    const now = Date.now();
    return rosterLeads
      .filter((lead) => {
        if (chromeStatusChip === 'live') return isHeldLive(lead, now);
        if (chromeStatusChip !== 'all' && lead.displayStatus !== chromeStatusChip) return false;
        if (!term) return true;
        return [
          `${lead.firstName} ${lead.lastName}`,
          lead.email,
          lead.phone,
          lead.vehicleReg,
        ].some((field) => (field ?? '').toLowerCase().includes(term));
      })
      // Open Round Robin leads always sit at the top — they are the ones on a clock.
      .sort((a, b) => {
        const orr = Number(isOrr(b)) - Number(isOrr(a));
        if (orr !== 0) return orr;
        return chromeSort === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt;
      });
  }, [rosterLeads, chromeSearch, chromeStatusChip, chromeSort, tick]);


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
        greenTeamAt: null,
        followUpDay: 0,
        chaseComplete: false,
        history: offeredTo
          ? [`Created — attempt 1 offered to ${offeredTo.name} by the rotation`]
          : ['Created — every agent is on a call, waiting in the open pool queue'],
      };

      if (offeredTo) {
        const claimSeconds = Math.round(cadenceRef.current.claimWindowSeconds);
        window.setTimeout(() => {
          toast({
            title: `Offered to ${offeredTo.name}`,
            description: `The rotation picked the next free agent — ${claimSeconds} seconds to make the first call.`,
          });
        }, 0);
      }
      // When everyone is busy there is no pop-up: the lead simply shows as
      // "Waiting in the open pool" in the list below, which is correct behaviour.


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
          greenTeamAt: null,
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
          dialedThisOffer: delta > 0 ? true : lead.dialedThisOffer,
          history: [...lead.history, `Manual dial counter ${delta > 0 ? '+1' : '-1'} (no outcome recorded)`],
        };
      }),
    );
  };


  /**
   * Practice note. Saved only in this page's memory so a manager can rehearse
   * exactly what an agent types after a call. Nothing reaches the real lead notes.
   */
  const addPracticeNote = (id: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLeads((current) =>
      current.map((lead) => {
        if (lead.id !== id) return lead;
        const by =
          simulatedAgentId !== 'all'
            ? getAgent(simulatedAgentId).name
            : lead.assignedTo
              ? getAgent(lead.assignedTo).name
              : 'Unassigned';
        return {
          ...lead,
          notes: [...(lead.notes ?? []), { at: Date.now(), by, text: trimmed }],
          history: [...lead.history, `Note added by ${by}: ${trimmed}`],
        };
      }),
    );
    toast({ title: 'Practice note added', description: 'Nothing real was changed.', duration: 1800 });
  };

  const updateDisplayStatus = (id: string, status: LeadStatus) => {
    // "No answer" is a genuine call attempt, so it runs the chase rules.
    if (status === 'no_answer') {
      recordNoAnswer(id);
      return;
    }
    setLeads((current) =>
      current.map((lead) => {
        if (lead.id !== id) return lead;
        return {
          ...lead,
          displayStatus: status,
          contactedAt: status === 'new' ? null : (lead.contactedAt ?? Date.now()),
          history: [...lead.history, `${statusLabels[status]} recorded`],
        };
      }),
    );
  };

  /**
   * A real outbound call that did not reach the customer.
   *
   * It counts as one genuine attempt, leaves the salesperson's active queue and
   * waits for its next eligible staffed window (at least 3 hours after the
   * actual attempt). Normal Round Robin then decides who gets it next — the
   * previous salesperson gets no priority.
   */
  const recordNoAnswer = (id: string) => {
    let toastTitle = '✓ No answer logged';
    let toastBody = '';
    setLeads((current) =>
      current.map((lead) => {
        if (lead.id !== id) return lead;
        const now = Date.now();
        const dials = lead.dials + 1;
        const day = Math.max(1, lead.followUpDay);
        const allowance = callsAllowedOn(now);
        const callsToday = Math.min(allowance, lead.dayDials + 1);
        const dayDone = callsToday >= allowance;
        const nextDay = day + 1;
        const chaseOver = dayDone && nextDay > CONTACT_DAYS;
        const eligibleAt = dayDone ? nextDayStaffedTime(now) : nextEligibleAfterAttempt(now);

        toastBody = chaseOver
          ? `Contact day ${day} of ${CONTACT_DAYS} · call ${callsToday} of ${allowance} complete. Chase complete — ${CONTACT_DAYS} contact days done.`
          : `Day ${day} of ${CONTACT_DAYS} · Call ${callsToday} of ${allowance} complete. Back in Round Robin from ${formatEligible(eligibleAt)}.`;
        if (chaseOver) toastTitle = 'Chase complete';

        return {
          ...lead,
          dials,
          dayDials: dayDone ? 0 : callsToday,
          followUpDay: dayDone && !chaseOver ? nextDay : day,
          displayStatus: 'no_answer',
          previousOutcome: 'No answer',
          waiting: !chaseOver,
          assignedTo: null,
          status: 'queued',
          dialedThisOffer: false,
          chaseComplete: chaseOver,
          eligibleAt: chaseOver ? null : eligibleAt,
          nextCallAt: chaseOver ? null : eligibleAt,
          greenTeamAt: null,
          history: [
            ...lead.history,
            `No answer logged — day ${day} of ${CONTACT_DAYS}, call ${callsToday} of ${allowance} (${dials} attempts in total)`,
            chaseOver
              ? `Chase complete — ${CONTACT_DAYS} contact days done`
              : `Back in Round Robin from ${formatEligible(eligibleAt)}`,
          ],
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
            description: `Moved on ${result.reassigned}. Nothing real was changed.`,
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
      greenTeamAt: null,
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

  /**
   * PHASE 1 — scenario walkthrough.
   * Each scenario drops a ready-made practice list into the table below so a
   * manager can watch one exact situation an agent meets during a shift.
   * Nothing is written anywhere: these are made-up leads in local state only.
   */
  const buildLead = useCallback(
    (over: Partial<DummyLead> & { n: number }): DummyLead => {
      const now = Date.now();
      const { n, ...rest } = over;
      return {
        id: `dummy-scenario-${now}-${n}-${Math.random().toString(36).slice(2, 7)}`,
        firstName: 'TEST',
        lastName: `Lead ${String(n).padStart(2, '0')}`,
        email: `test.lead${n}@example.com`,
        status: 'queued',
        displayStatus: 'new',
        assignedTo: null,
        attemptCount: 0,
        deadlineAt: now,
        vehicleReg: 'TEST123',
        phone: '07902222222',
        createdAt: now,
        dials: 0,
        contactedAt: null,
        dayDials: 0,
        nextCallAt: null,
        greenTeamAt: null,
        followUpDay: 0,
        chaseComplete: false,
        history: ['Scenario walkthrough — made-up lead, nothing saved'],
        ...rest,
      };
    },
    [],
  );

  /**
   * Practice helper: drops a normal round robin lead into the same list so the
   * agent can see how the two sit together. Round robin leads have no countdown
   * and never move on to another agent.
   */
  const createRrLead = useCallback(() => {
    const now = Date.now();
    setLeads((current) => {
      const activeRoster = rosterRef.current;
      const owner =
        simulatedAgentId !== 'all'
          ? activeRoster.find((agent) => agent.id === simulatedAgentId) ?? activeRoster[0]
          : activeRoster[current.filter((lead) => (lead.source ?? 'orr') === 'rr').length % activeRoster.length];
      const leadNumber = current.length + 1;
      const draft: DummyLead = {
        id: `dummy-rr-${now}-${Math.random().toString(36).slice(2, 7)}`,
        firstName: 'TEST',
        lastName: `RR Lead ${String(leadNumber).padStart(2, '0')}`,
        email: `test.rr${leadNumber}@example.com`,
        status: 'new',
        displayStatus: 'new',
        assignedTo: owner?.id ?? null,
        attemptCount: 1,
        deadlineAt: now,
        vehicleReg: 'TEST123',
        phone: '07903333333',
        createdAt: now,
        dials: 0,
        contactedAt: null,
        dayDials: 0,
        nextCallAt: null,
        greenTeamAt: null,
        followUpDay: 0,
        chaseComplete: false,
        source: 'rr',
        history: ['Round robin practice lead — stays with this agent, no countdown'],
      };
      return [draft, ...current];
    });
    toast({ title: 'Round robin practice lead added. Nothing real was changed.' });
  }, [simulatedAgentId]);

  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  // Scenario walkthrough starts closed; press the header to open it.
  const [scenariosOpen, setScenariosOpen] = useState(false);

  const scenarios = useMemo(
    () => [
      {
        id: 'busy-day',
        title: 'Busy morning — everyone gets one at a time',
        what: 'Eight agents on shift, eight enquiries land together.',
        watch: 'Each lead sits with a different agent, nobody holds two.',
        agents: 8,
        build: (r: DummyAgent[], now: number) =>
          r.map((agent, i) =>
            buildLead({
              n: i + 1,
              status: 'new',
              assignedTo: agent.id,
              attemptCount: 1,
              createdAt: now - i * 4000,
              deadlineAt: now + cadence.claimWindowSeconds * 1000 - i * 4000,
            }),
          ),
      },
      {
        id: 'window-expires',
        title: 'Nobody calls in time — the lead moves on',
        what: 'One lead is held with only seconds left on the first-call window.',
        watch: 'When the clock hits zero the rotation passes it to the next free agent.',
        agents: 4,
        build: (r: DummyAgent[], now: number) => [
          buildLead({
            n: 1,
            status: 'new',
            assignedTo: r[0].id,
            attemptCount: 1,
            createdAt: now - 60000,
            deadlineAt: now + 8000,
          }),
        ],
      },
      {
        id: 'dial-logged',
        title: 'Agent dials in time — the lead stays with them',
        what: 'A dial has been logged, so the countdown stops.',
        watch: 'The lead stays in the salesperson\'s queue until they record an outcome.',
        agents: 4,
        build: (r: DummyAgent[], now: number) => [
          buildLead({
            n: 1,
            status: 'new',
            assignedTo: r[0].id,
            attemptCount: 1,
            dials: 1,
            dayDials: 1,
            createdAt: now - 90000,
            deadlineAt: now - 1000,
          }),
        ],
      },
      {
        id: 'contacted',
        title: 'Customer answers — the lead is won to that agent',
        what: 'Contact made inside the window.',
        watch: 'The row turns green: "This lead is now yours".',
        agents: 4,
        build: (r: DummyAgent[], now: number) => [
          buildLead({
            n: 1,
            status: 'new',
            assignedTo: r[0].id,
            attemptCount: 1,
            dials: 1,
            dayDials: 1,
            contactedAt: now - 5000,
            createdAt: now - 120000,
            deadlineAt: now - 60000,
          }),
        ],
      },
      {
        id: 'all-busy',
        title: 'Everyone on a call — the queue holds the rest',
        what: 'Two agents on shift, both holding a lead, four more arrive.',
        watch: 'The extras wait in the open pool, oldest first, and drop in as agents free up.',
        agents: 2,
        build: (r: DummyAgent[], now: number) => [
          ...r.map((agent, i) =>
            buildLead({
              n: i + 1,
              status: 'new',
              assignedTo: agent.id,
              attemptCount: 1,
              dials: 1,
              dayDials: 1,
              createdAt: now - 300000 - i * 1000,
              deadlineAt: now - 1000,
            }),
          ),
          ...[1, 2, 3, 4].map((k) =>
            buildLead({ n: r.length + k, createdAt: now - (5 - k) * 30000 }),
          ),
        ],
      },
      {
        id: 'overnight',
        title: 'Overnight backlog at 09:00',
        what: 'Twelve enquiries came in overnight, eight agents start at 09:00.',
        watch: 'Oldest first: eight go straight out, four wait their turn.',
        agents: 8,
        build: (_r: DummyAgent[], now: number) =>
          Array.from({ length: 12 }, (_, i) =>
            buildLead({ n: i + 1, createdAt: now - (12 - i) * 45 * 60 * 1000 }),
          ),
      },
      {
        id: 'unanswered',
        title: 'Passed round and still nobody calls',
        what: `A lead already offered ${cadence.maxAttempts} times with no dial.`,
        watch: 'It keeps circulating through ORR and a manager alert is raised so a human can reassign it.',
        agents: 4,
        build: (r: DummyAgent[], now: number) => [
          buildLead({
            n: 1,
            status: 'reassigned',
            assignedTo: r[0].id,
            attemptCount: cadence.maxAttempts,
            createdAt: now - 20 * 60 * 1000,
            deadlineAt: now + 6000,
          }),
        ],
      },
      {
        id: 'no-answer-cadence',
        title: 'Customer does not pick up — day-one call pattern',
        what: 'Dials logged today, next call booked for the next calling window.',
        watch: 'The row shows which dial of the day it is and when the next one is due.',
        agents: 4,
        build: (r: DummyAgent[], now: number) => [
          buildLead({
            n: 1,
            status: 'new',
            assignedTo: r[0].id,
            attemptCount: 1,
            dials: 2,
            dayDials: 2,
            nextCallAt: now + 45 * 60 * 1000,
            createdAt: now - 3 * 60 * 60 * 1000,
            deadlineAt: now - 60000,
          }),
        ],
      },
      {
        id: 'follow-up',
        title: 'Seven-day follow-up chase',
        what: 'Still no contact after day one, so the lead is chased daily.',
        watch: 'The purple note shows the follow-up day and dials used today.',
        agents: 4,
        build: (r: DummyAgent[], now: number) => [
          buildLead({
            n: 1,
            status: 'new',
            assignedTo: r[1].id,
            attemptCount: 1,
            dials: 5,
            dayDials: 1,
            followUpDay: 3,
            nextCallAt: now + 2 * 60 * 60 * 1000,
            createdAt: now - 3 * 24 * 60 * 60 * 1000,
            deadlineAt: now - 60000,
          }),
        ],
      },
      {
        id: 'chase-done',
        title: 'Chase finished with no contact',
        what: 'All seven days used, customer never answered.',
        watch: 'The lead is closed off for the chase and shown as finished.',
        agents: 4,
        build: (r: DummyAgent[], now: number) => [
          buildLead({
            n: 1,
            status: 'new',
            assignedTo: r[2].id,
            attemptCount: 1,
            dials: 12,
            followUpDay: cadence.followUpDays,
            chaseComplete: true,
            createdAt: now - 8 * 24 * 60 * 60 * 1000,
            deadlineAt: now - 60000,
          }),
        ],
      },
    ],
    [buildLead, cadence],
  );

  const runScenario = useCallback(
    (id: string) => {
      const scenario = scenarios.find((s) => s.id === id);
      if (!scenario) return;
      const now = Date.now();
      const nextRoster = DUMMY_AGENTS.slice(0, scenario.agents);
      setAgentCount(scenario.agents);
      rosterRef.current = nextRoster;
      nextAgentIndexRef.current = 0;
      setSimulatedAgentId('all');
      setDataSource('practice');
      setLeads(scenario.build(nextRoster, now));
      setActiveScenario(id);
      toast({ title: scenario.title, description: scenario.watch });
    },
    [scenarios, toast],
  );


  const cleanup = () => {
    setLeads([]);
    nextAgentIndexRef.current = 0;
    setActiveScenario(null);
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
      {/* Who is practising — manager/super admin view vs sales agent view */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-3 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-foreground">Practice as</span>
        <div className="inline-flex items-center rounded-md border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => { setRoleView('manager'); setSimulatedAgentId('all'); }}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold transition-colors',
              isManagerView ? 'bg-teal-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            Manager / super admin
          </button>
          <button
            type="button"
            onClick={() => {
              setRoleView('agent');
              setSimulatedAgentId((current) => (current === 'all' ? (roster[0]?.id ?? 'all') : current));
            }}
            className={cn(
              'px-3 py-1.5 text-xs font-semibold border-l border-border transition-colors',
              !isManagerView ? 'bg-teal-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            Sales agent
          </button>
        </div>
        <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
          {isManagerView ? (
            <>
              <li>Full setup: agents on shift, scenarios, the 09:00 release and the timing rules.</li>
              <li>You can watch the whole team or look through any one agent&rsquo;s eyes.</li>
            </>
          ) : (
            <>
              <li>Exactly what a sales agent sees — only their own leads and buttons.</li>
              <li>Setup, scenarios and timing rules are hidden.</li>
            </>
          )}
        </ul>
      </div>

      {/* Same page furniture as New Leads, driven by the practice leads only */}
      <OrrSandboxLeadsChrome
        leads={chromeLeads}
        liveHeldCount={liveHeldCount}
        agents={roster.map((agent) => ({ id: agent.id, name: agent.name }))}
        teamLabel={theme.label}
        isManagerView={isManagerView}
        search={chromeSearch}
        onSearchChange={setChromeSearch}
        statusChip={chromeStatusChip}
        onStatusChipChange={setChromeStatusChip}
        agentFilter={simulatedAgentId}
        onAgentFilterChange={setSimulatedAgentId}
        sort={chromeSort}
        onSortChange={setChromeSort}
        onClearFilters={() => {
          setChromeSearch('');
          setChromeStatusChip('all');
          setChromeSort('newest');
          if (isManagerView) setSimulatedAgentId('all');
        }}
        agentName={roster.find((agent) => agent.id === simulatedAgentId)?.name}
      />

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
                  {isManagerView ? 'Manager & super admin view' : 'Sales agent view'}
                </span>
                <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] font-medium px-2.5 py-0.5">
                  Nothing counts
                </span>
              </div>
              <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1 leading-relaxed max-w-2xl">
                <li>
                  {isManagerView
                    ? 'Set the shift up, run a scenario and watch the 2-minute first-call window, pass-on, phone column, click-to-dial and copy button.'
                    : 'Practise your own leads: answer inside the 2-minute window, call, copy the number and let one pass on.'}
                </li>
                <li>{dataSource === 'live' ? 'Live leads mode shows a read-only copy of real leads.' : 'Every name here is made up.'}</li>
                <li>Nothing is written back, no customer is contacted and no agent's figures change.</li>
              </ul>
            </div>
          </div>
        </div>

        {isManagerView && (
        <div className="mt-5 pt-4 border-t border-border rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-foreground">Agents on shift</span>
            <div className="inline-flex items-center rounded-md border border-border overflow-hidden">
              {AGENT_COUNT_OPTIONS.map((count) => (
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
        )}

        {/* PHASE 1 — every situation an agent meets, one click each */}
        {isManagerView && (
        <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setScenariosOpen((open) => !open)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:underline"
              aria-expanded={scenariosOpen}
            >
              {scenariosOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Scenario walkthrough
            </button>
            <span className="rounded-full bg-teal-100 text-teal-800 border border-teal-200 text-[11px] font-medium px-2.5 py-0.5">
              Phase 1
            </span>
            {!scenariosOpen && (
              <span className="text-xs text-muted-foreground">
                {scenarios.length} practice situations — press to open
              </span>
            )}
            {activeScenario && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cleanup}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear scenario
              </Button>
            )}
          </div>
          {scenariosOpen && (
            <>
              <ul className="mt-1 mb-3 text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                <li>Press a scenario — it sets the agents on shift and fills the list below.</li>
                <li>Watch the list and the countdowns to see exactly what the agent sees.</li>
                <li>Nothing is saved, nobody is called and no figures move.</li>
              </ul>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {scenarios.map((scenario) => (
                  <button
                    key={scenario.id}
                    type="button"
                    onClick={() => runScenario(scenario.id)}
                    className={cn(
                      'text-left rounded-lg border p-3 transition-colors',
                      activeScenario === scenario.id
                        ? 'border-teal-400 bg-teal-50/70'
                        : 'border-border bg-background hover:bg-muted/50',
                    )}
                  >
                    <div className="text-xs font-semibold text-foreground">{scenario.title}</div>
                    <ul className="mt-1 text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
                      <li>{scenario.what}</li>
                      <li>{scenario.watch}</li>
                    </ul>
                    <div className="mt-1.5 text-[10px] font-medium text-teal-700">
                      {scenario.agents} {scenario.agents === 1 ? 'agent' : 'agents'} on shift
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        )}





        {isManagerView && (
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
        )}

        <div className="mt-4 pt-4 border-t border-border flex items-center gap-2 flex-wrap">
          {isManagerView && (<>
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
          <Button size="sm" variant="outline" onClick={createRrLead} disabled={dataSource === 'live'} title="Adds a normal round robin lead so you can see both kinds side by side">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add a round robin lead
          </Button>
          <Button size="sm" onClick={createTestLead} disabled={dataSource === 'live'} title={dataSource === 'live' ? 'Live leads mode uses the real leads — use Load live leads instead.' : undefined}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Take this lead
          </Button>
          </>)}
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
          {isManagerView && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-muted-foreground"
            onClick={cleanup}
            disabled={leads.length === 0}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear practice leads
          </Button>
          )}
        </div>
      </section>

      {/* Rules, timings and editable variables */}
      {isManagerView && <OrrLogicExplainer config={cadence} onChange={setCadence} teamLabel={theme.label} />}

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
            <div className="text-sm font-semibold text-foreground">
              {isManagerView ? 'Agent preview' : 'Your practice list'}
            </div>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              {isManagerView ? (
                <>
                  <li>See the page exactly as a sales agent would.</li>
                  <li>Pick an agent from the list to switch their view.</li>
                  <li>Choose &ldquo;Whole team&rdquo; to watch every lead in the flow at once.</li>
                </>
              ) : (
                <>
                  <li>You only see the leads that have come to you.</li>
                  <li>Pick your name so the practice list matches your seat.</li>
                  <li>Nothing here is real — no customer is contacted.</li>
                </>
              )}
            </ul>

          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            {isManagerView ? 'Viewing as sales agent' : 'You are practising as'}
          </span>
          <select
            className="h-9 w-64 rounded-lg border border-input bg-muted/40 px-3 text-sm font-medium"
            value={simulatedAgentId}
            onChange={(event) => setSimulatedAgentId(event.target.value)}
          >
            {isManagerView && <option value="all">Whole team — everyone&rsquo;s leads</option>}
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
                <li>A new lead is unowned. The rotation holds it for one salesperson for the current call attempt only.</li>
                <li>Nobody owns future attempts — if the countdown runs out with no call, it goes straight back into the pool and no attempt is counted.</li>
                <li>No answer counts as one genuine attempt, leaves your queue and comes back at its next eligible time — the rotation decides who gets it.</li>
                <li>Weekdays 09:00–18:00, weekends about 10:00–13:00 when staffed. At least 3 hours between attempts.</li>
                <li>Up to 2 attempts a weekday, normally 1 at a weekend, across 7 contact days.</li>
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
                  <th className="px-2 py-2 text-left w-[130px]">Lead type</th>
                  <th className="px-2 py-2 text-left w-[110px]">Agent</th>
                  <th className="px-2 py-2 text-left w-[130px]">Time to Lead</th>
                  <th className="px-2 py-2 text-left">Status</th>
                  <th className="px-2 py-2 text-center">Calls</th>
                  <th className="px-2 py-2 text-left">Actions</th>
                  <th className="px-2 py-2 text-left">Name</th>
                  <th className="px-2 py-2 text-left">Phone</th>
                  <th className="px-2 py-2 text-left">WhatsApp</th>
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
                  const orrLead = isOrr(lead);

                  return (
                    <tr
                      key={lead.id}
                      className={cn(
                        'border-t border-border align-middle',
                        expired ? 'bg-muted/40' : 'bg-background',
                        orrLead && !expired && 'ring-2 ring-inset ring-primary/60 bg-primary/5',
                      )}
                    >
                      <td className="px-2 py-2 text-muted-foreground">{rowIndex + 1}</td>
                      {/* Lead type — same column for both rotations. Open Round
                          Robin rows show the live badge; plain round robin rows
                          show the standard badge in the same place. */}
                      <td className="px-2 py-2">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap',
                              orrLead
                                ? 'border-orange-300 bg-orange-100 text-orange-800'
                                : 'border-border bg-muted text-muted-foreground',
                            )}
                          >
                            {orrLead ? 'Open Round Robin' : 'Round robin'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                            {orrLead ? (
                              <>
                                <Zap className="h-3 w-3 text-emerald-600" /> Live
                              </>
                            ) : (
                              <>
                                <Moon className="h-3 w-3 text-blue-500" /> Standard
                              </>
                            )}
                          </span>
                        </div>
                      </td>
                      {/* Agent */}
                      <td className="px-2 py-2">
                        <div className="flex flex-col items-start gap-1">
                          {lead.assignedTo === null ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-900 whitespace-nowrap">
                              <Clock className="h-3 w-3" /> Open pool
                            </span>
                          ) : (
                            <>
                              <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                                {agent.name}
                              </span>
                              {orrLead && !expired && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 whitespace-nowrap">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Reserved
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* Time to Lead — one compact cell with the same shape on
                          both rotations. The countdown only applies to Open
                          Round Robin; round robin rows show the plain wait. */}
                      <td className="px-2 py-2 align-middle">
                        {(() => {
                          let value: string;
                          let caption: string;
                          let tone = 'text-foreground';

                          if (!orrLead) {
                            value = formatClock(ageSec);
                            caption = 'with this agent';
                          } else if (lead.contactedAt) {
                            value = formatClock(Math.max(0, Math.round((lead.contactedAt - lead.createdAt) / 1000)));
                            caption = 'contacted — now yours';
                            tone = 'text-emerald-700';
                          } else if (lead.chaseComplete) {
                            value = 'Chase done';
                            caption = `${CONTACT_DAYS} contact days completed`;
                            tone = 'text-muted-foreground';
                          } else if (lead.waiting) {
                            value = lead.eligibleAt ? formatEligible(lead.eligibleAt) : 'Next window';
                            caption = 'back in the rotation';
                            tone = 'text-amber-800';
                          } else if (lead.assignedTo === null) {
                            value = 'In queue';
                            caption = 'next agent who frees up';
                            tone = 'text-amber-800';
                          } else if (attempted) {
                            value = 'Dial logged';
                            caption = 'set an outcome';
                            tone = 'text-foreground';
                          } else {
                            value = formatHold(remaining);
                            caption = 'to start call';
                            tone = 'text-foreground';
                          }

                          return (
                            <div className="flex flex-col leading-tight whitespace-nowrap">
                              <span className={cn('text-sm font-semibold tabular-nums', tone)}>{value}</span>
                              <span className="text-[11px] text-muted-foreground">{caption}</span>
                              <span className="text-[10px] text-muted-foreground">
                                Day {Math.max(1, lead.followUpDay)} of {CONTACT_DAYS} · call{' '}
                                {Math.min(callsAllowedOn(Date.now()), lead.dayDials + 1)} of {callsAllowedOn(Date.now())}
                              </span>
                              {orrLead && !lead.contactedAt && !lead.waiting && lead.assignedTo !== null && (
                                <span className={cn('mt-1 h-1 w-full rounded-full overflow-hidden', theme.bar)}>
                                  <span
                                    className={cn('block h-full rounded-full transition-all', theme.barFill)}
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
                                </span>
                              )}
                            </div>
                          );
                        })()}
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
                          <a href={`tel:${lead.phone}`} title="Call" className="h-7 w-7 rounded-md border border-input flex items-center justify-center text-emerald-600 hover:bg-emerald-50">
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                          <PracticeNotes
                            notes={lead.notes ?? []}
                            onAdd={(text) => addPracticeNote(lead.id, text)}
                          />
                          <span title="Email" className="h-7 w-7 rounded-md border border-input flex items-center justify-center text-blue-600">
                            <Mail className="h-3.5 w-3.5" />
                          </span>
                          <span title="Reminder" className="h-7 w-7 rounded-md border border-input flex items-center justify-center text-muted-foreground">
                            <Bell className="h-3.5 w-3.5" />
                          </span>
                          <span className="inline-flex h-7 items-center gap-1 rounded-md border border-orange-300 px-2 text-xs font-medium text-orange-600">
                            <FileText className="h-3 w-3" /> Quote
                          </span>
                          <span title="More" className="h-7 w-7 rounded-md border border-input flex items-center justify-center text-muted-foreground">
                            <ChevronDown className="h-3.5 w-3.5" />
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
                            <div className="font-medium text-foreground">{lead.dials} call attempt{lead.dials === 1 ? '' : 's'} logged</div>
                            <div className="text-[11px] text-muted-foreground">Last activity {formatAgo(lead.createdAt)}</div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-muted-foreground">No activity yet</div>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {formatLeadDate(lead.createdAt)}
                      </td>
                      <td className="px-2 py-2 text-xs whitespace-nowrap">
                        <div className="font-medium text-foreground">Viewed quote page</div>
                        <div className="text-[11px] text-muted-foreground">{formatAgo(lead.createdAt)}</div>
                      </td>
                      <td className="px-2 py-2 text-xs whitespace-nowrap">
                        {(() => {
                          // The clock starts when the agent was actually given the
                          // lead (the offer), not when the enquiry arrived — a lead
                          // can sit overnight before anyone can act on it.
                          const offeredAt = lead.assignedTo
                            ? (orrLead
                                ? lead.deadlineAt - cadence.claimWindowSeconds * 1000
                                : lead.deadlineAt)
                            : lead.createdAt;
                          const endAt = lead.contactedAt ?? now;
                          const startedAt = Math.min(
                            endAt,
                            Math.max(lead.createdAt, offeredAt)
                          );
                          const fromOffer = startedAt > lead.createdAt;
                          const elapsed = Math.max(0, Math.round((endAt - startedAt) / 1000));
                          const title = fromOffer
                            ? `Timed from the lead being given to the agent at ${new Date(startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                            : 'Timed from the lead arriving';
                          return lead.contactedAt ? (
                            <span
                              className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 tabular-nums"
                              title={title}
                            >
                              {formatHMS(elapsed)}
                              {fromOffer ? ' · from handover' : ''}
                            </span>
                          ) : (
                            <div className="flex flex-col leading-tight">
                              <span
                                className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold text-amber-900 tabular-nums w-fit"
                                title={`${title} — still running, no contact yet`}
                              >
                                {formatHMS(elapsed)}
                              </span>
                              <span className="text-[10px] text-muted-foreground mt-0.5">still running</span>
                            </div>
                          );
                        })()}
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
            <span className="font-semibold text-foreground">Calling plan:</span>{' '}
            Weekdays 09:00–18:00, weekends roughly 10:00–13:00 when staffed. Up to 2 genuine attempts a full weekday and
            normally 1 a weekend day, always at least {MIN_GAP_HOURS} hours apart, across {CONTACT_DAYS} contact days.
            After No answer the lead leaves your queue and returns to Open Round Robin from its next eligible time — waiting
            leads are fed back a couple at a time, so nothing lands in one batch. Practice leads are reserved privately for
            one call attempt and wiped when you clear or reload.
          </p>


        </div>
      </section>
    </div>
  );

};

export default OpenRoundRobinTestPanel;