import React, { useCallback, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bell,
  Clock,
  CreditCard,
  Eraser,
  LogIn,
  MessageSquare,
  Phone,
  PhoneOff,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Users,
  Voicemail,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ClaimResult } from '@/lib/orrPractice/engine';
import {
  OPEN_CLAIM_CARD_LIMIT,
  OPEN_CLAIM_UNWORKED_LIMIT,
  canOverride,
  managerMoveHold,
  openClaim,
  openClaimCards,
  unworkedHolds,
  type PracticeRole,
} from '@/lib/orrPractice/openClaim';
import {
  PRESENCE_TTL_MINUTES,
  eligibleMinutesBetween,
  isPresent,
  makeOvernightBatch,
  queueViews,
  runIntakeTick,
  type PresenceMap,
} from '@/lib/orrPractice/intake';
import {
  OFFER_SECONDS,
  acceptOffer,
  declineOffer,
  initialRoundRobin,
  makeOffers,
  switchMode,
  type RoundRobinState,
} from '@/lib/orrPractice/autoRoundRobin';

import {
  DEFAULT_ORR_PRACTICE_SETTINGS,
  RE_RELEASE_INTERVAL_CHOICES_MINUTES,
  sanitiseSettings,
  type OrrPracticeSettings,
} from '@/lib/orrPractice/settings';
import { makeSyntheticAgents, makeSyntheticLead } from '@/lib/orrPractice/syntheticLeads';
import {
  allocateQueued,
  applyJourneyEvent,
  claimLead,
  evaluateStages,
  recordContactOutcome,
} from '@/lib/orrPractice/engine';
import { canAttemptContact } from '@/lib/orrPractice/contactSafety';
import { intervalReport, poolSummary } from '@/lib/orrPractice/analytics';
import type {
  ContactResult,
  ContactSource,
  JourneyEvent,
  JourneyEventKind,
  PracticeAgent,
  PracticeLead,
} from '@/lib/orrPractice/types';

/**
 * Open Round Robin: website lead triggers and continuous re-release.
 *
 * Practice only. Every lead on this panel is invented and the engine it runs on
 * holds no database client, so nothing here can call, text, WhatsApp or route a
 * real customer. Use it to try the rules before any live journey is touched.
 */

const MINUTE = 60_000;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatClock = (at: number) => {
  const d = new Date(at);
  return `${DAY_NAMES[d.getDay()]} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
};

const minutesBetween = (from: number, to: number) => Math.max(0, Math.round((to - from) / MINUTE));

const STAGE_LABEL: Record<PracticeLead['stage'], string> = {
  anonymous: 'Browsing, no details',
  active_session: 'Still working on it',
  awaiting_release: 'Ready to release',
  queued: 'In the pool',
  reserved: 'Held by an agent',
  owned: 'Spoken to',
  closed: 'Closed',
};

const STAGE_STYLE: Record<PracticeLead['stage'], string> = {
  anonymous: 'bg-slate-100 text-slate-700 border-slate-200',
  active_session: 'bg-sky-100 text-sky-800 border-sky-200',
  awaiting_release: 'bg-amber-100 text-amber-900 border-amber-200',
  queued: 'bg-emerald-100 text-emerald-900 border-emerald-200',
  reserved: 'bg-violet-100 text-violet-900 border-violet-200',
  owned: 'bg-teal-100 text-teal-900 border-teal-200',
  closed: 'bg-gray-100 text-gray-700 border-gray-200',
};

const NumberField = ({
  label,
  hint,
  value,
  min = 0,
  max = 9999,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
}) => (
  <div className="space-y-1">
    <Label className="text-[11px] font-semibold text-foreground">{label}</Label>
    <Input
      type="number"
      className="h-8 text-sm"
      value={value}
      min={min}
      max={max}
      onChange={e => onChange(Number(e.target.value))}
    />
    {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
  </div>
);

const ToggleField = ({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-muted/30 p-2">
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-foreground">{label}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

const AutoRoundRobinSection = ({
  leads,
  agents,
  settings,
  clock,
  onResult,
  onTick,
}: {
  leads: PracticeLead[];
  agents: PracticeAgent[];
  settings: OrrPracticeSettings;
  clock: number;
  onResult: (r: ClaimResult) => void;
  onTick: (minutes: number) => void;
}) => {
  const [rr, setRr] = useState<RoundRobinState>(initialRoundRobin);
  const open = rr.offers.filter(o => o.status === 'open' && clock < o.expiresAt);
  const recent = rr.offers.slice(-8).reverse();
  const nameOf = (id: string) => agents.find(a => a.id === id)?.name ?? id;
  const leadName = (id: string) => leads.find(l => l.id === id)?.name.split(' ')[0] ?? 'lead';
  return (
    <Section
      id="orr-auto"
      title="Phase 3: Automatic round robin"
      subtitle={`Each pool lead is offered to one agent at a time for ${OFFER_SECONDS} seconds, in turn. Accepting gives the usual ${settings.claimExpiryMinutes}-minute hold.`}
      icon={<RotateCcw className="h-4 w-4 text-primary" />}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Switch checked={rr.mode === 'auto'} onCheckedChange={v => setRr(s => switchMode(s, v ? 'auto' : 'open_claim'))} />
          <span className="text-sm">{rr.mode === 'auto' ? 'Automatic offers on' : 'Open Claim mode'}</span>
        </div>
        <Button size="sm" variant="outline" disabled={rr.mode !== 'auto'} onClick={() => setRr(s => makeOffers(leads, agents, s, clock).state)}>
          Send offers
        </Button>
        <Button size="sm" variant="outline" onClick={() => onTick(10 / 60)}>
          <ArrowRight className="h-3.5 w-3.5 mr-1" /> +10 sec
        </Button>
      </div>
      <div className="mt-3 space-y-1">
        {open.length === 0 && <p className="text-xs text-muted-foreground">No open offers.</p>}
        {open.map(o => (
          <div key={o.leadId + o.agentId + o.offeredAt} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-foreground">{leadName(o.leadId)}</span>
            <span>offered to {nameOf(o.agentId)}, {Math.ceil((o.expiresAt - clock) / 1000)}s left</span>
            <Button size="sm" onClick={() => {
              const r = acceptOffer(leads, agents, rr, o.leadId, o.agentId, settings, clock);
              setRr(r.state);
              onResult(r);
            }}>Accept</Button>
            <Button size="sm" variant="outline" onClick={() => setRr(s => declineOffer(s, o.leadId, o.agentId, clock))}>Decline</Button>
          </div>
        ))}
      </div>
      {recent.length > 0 && (
        <ul className="mt-3 space-y-0.5">
          {recent.map(o => (
            <li key={o.leadId + o.agentId + o.offeredAt} className="text-xs text-muted-foreground">
              {leadName(o.leadId)} to {nameOf(o.agentId)}: {o.status.replace('_', ' ')}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
};

const IntakeSection = ({
  leads,
  agents,
  settings,
  clock,
  onLeads,
}: {
  leads: PracticeLead[];
  agents: PracticeAgent[];
  settings: OrrPracticeSettings;
  clock: number;
  onLeads: (leads: PracticeLead[], notes: string[]) => void;
}) => {
  const [presence, setPresence] = useState<PresenceMap>({});
  const [lastTickAt, setLastTickAt] = useState(0);
  const views = queueViews(leads, settings);
  const lists: [string, PracticeLead[]][] = [
    ['Waiting to go quiet', views.pending],
    ['Call-backs booked', views.callbacks],
    ['Overnight arrivals', views.overnight],
    ['Back in the pool', views.recycled],
  ];
  return (
    <Section
      id="orr-intake"
      title="Phase 2: Continuous intake and recycling"
      subtitle={`Leads arrive 24/7; calls only in calling hours (UK time). Agents count as present for ${PRESENCE_TTL_MINUTES} minutes after each check-in.`}
      icon={<Activity className="h-4 w-4 text-primary" />}
    >
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onLeads([...leads, ...makeOvernightBatch(50, clock, Date.now() % 100000)], ['Added 50 made-up overnight enquiries'])}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add 50 overnight enquiries
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const r = runIntakeTick(leads, settings, clock, { lastTickAt });
            setLastTickAt(r.state.lastTickAt);
            onLeads(r.leads, r.notes.length ? r.notes : ['Review pass ran; nothing changed (running it again at the same time is safe)']);
          }}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Run review pass
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {agents.map(a => (
          <Button key={a.id} size="sm" variant={isPresent(presence, a.id, clock) ? 'default' : 'outline'} onClick={() => setPresence(p => ({ ...p, [a.id]: clock }))}>
            {a.name}: {isPresent(presence, a.id, clock) ? 'present' : 'check in'}
          </Button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-4 mt-3">
        {lists.map(([label, items]) => (
          <div key={label} className="rounded-md border border-border p-3">
            <p className="text-xs font-semibold text-foreground">{label}: {items.length}</p>
            <ul className="mt-1 space-y-0.5 max-h-40 overflow-auto">
              {items.slice(0, 20).map(l => (
                <li key={l.id} className="text-xs text-muted-foreground">
                  {l.name.split(' ')[0]}, {eligibleMinutesBetween(settings, l.lastStageChangeAt, clock)} calling-hour min
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
};

const OpenClaimSection = ({
  leads,
  agents,
  settings,
  clock,
  onResult,
}: {
  leads: PracticeLead[];
  agents: PracticeAgent[];
  settings: OrrPracticeSettings;
  clock: number;
  onResult: (r: ClaimResult) => void;
}) => {
  const seats = agents.filter(a => a.available);
  const [seatId, setSeatId] = useState(seats[0]?.id ?? '');
  const [role, setRole] = useState<PracticeRole>('sales');
  const [moveTo, setMoveTo] = useState(seats[1]?.id ?? '');
  const [reason, setReason] = useState('');
  const cards = openClaimCards(leads, clock);
  const held = leads.filter(l => l.stage === 'reserved');
  const mine = unworkedHolds(leads, seatId).length;

  return (
    <Section
      id="orr-open-claim"
      title="Phase 1: Open Claim (agent view)"
      subtitle={`Each agent sees up to ${OPEN_CLAIM_CARD_LIMIT} pool cards with first name only, and can hold up to ${OPEN_CLAIM_UNWORKED_LIMIT} leads nobody has worked yet.`}
      icon={<Users className="h-4 w-4 text-primary" />}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Seat</Label>
          <Select value={seatId} onValueChange={setSeatId}>
            <SelectTrigger className="w-48 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {seats.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Practice role</Label>
          <Select value={role} onValueChange={v => setRole(v as PracticeRole)}>
            <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(['sales', 'sales_lead', 'sales_manager', 'admin', 'viewer'] as PracticeRole[]).map(r => (
                <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Badge variant="outline">Unworked holds: {mine} of {OPEN_CLAIM_UNWORKED_LIMIT}</Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 mt-3">
        {cards.length === 0 && <p className="text-xs text-muted-foreground">Nothing in the pool right now.</p>}
        {cards.map(c => (
          <div key={c.leadId} className="rounded-md border border-border p-3 space-y-1 bg-card">
            <p className="text-sm font-semibold text-foreground">{c.firstName}</p>
            <p className="text-xs text-muted-foreground">{c.stepReached}</p>
            <p className="text-xs text-muted-foreground">Waiting {c.minutesWaiting} min</p>
            <Button
              size="sm"
              className="w-full mt-1"
              onClick={() => onResult(openClaim(leads, agents, c.leadId, seatId, role, settings, clock))}
            >
              Take this lead
            </Button>
          </div>
        ))}
      </div>

      {canOverride(role) && held.length > 0 && (
        <div className="mt-4 space-y-2 rounded-md border border-border p-3">
          <p className="text-sm font-semibold text-foreground">Management: move a held lead</p>
          <div className="flex flex-wrap items-end gap-2">
            <Select value={moveTo} onValueChange={setMoveTo}>
              <SelectTrigger className="w-48 h-8"><SelectValue placeholder="Move to" /></SelectTrigger>
              <SelectContent>
                {seats.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input className="h-8 w-64" placeholder="Reason (required)" value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          {held.map(l => (
            <div key={l.id} className="flex items-center justify-between text-xs">
              <span>{l.name}, held by {agents.find(a => a.id === l.reservedAgentId)?.name}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onResult(managerMoveHold(leads, agents, l.id, moveTo, role, reason, settings, clock))}
              >
                Move
              </Button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
};

const Section = ({
  id,
  title,
  subtitle,
  icon,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section id={id} className="rounded-lg border border-border bg-card p-4 space-y-3">
    <div className="flex items-start gap-2">
      <div className="rounded-md bg-primary/10 p-1.5">{icon}</div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
    {children}
  </section>
);

const startOfPracticeDay = () => {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  return d.getTime();
};

export const OrrWebsiteTriggerPracticePanel: React.FC = () => {
  const [clock, setClock] = useState<number>(startOfPracticeDay);
  const [leads, setLeads] = useState<PracticeLead[]>([]);
  const [agents, setAgents] = useState<PracticeAgent[]>(makeSyntheticAgents);
  const [settings, setSettings] = useState<OrrPracticeSettings>(DEFAULT_ORR_PRACTICE_SETTINGS);
  const [notes, setNotes] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [source, setSource] = useState<ContactSource>('zoiper');
  const [secondsOnLine, setSecondsOnLine] = useState(180);

  const pushNotes = useCallback((incoming: string[]) => {
    if (!incoming.length) return;
    setNotes(prev => [...incoming, ...prev].slice(0, 40));
  }, []);

  /** Move the practice clock on and let the engine react to the elapsed time. */
  const tick = useCallback(
    (minutes: number) => {
      setClock(prev => {
        const next = prev + minutes * MINUTE;
        setLeads(current => {
          const result = evaluateStages(current, settings, next);
          pushNotes(result.notes);
          return result.leads;
        });
        return next;
      });
    },
    [settings, pushNotes],
  );

  /** Add one invented customer who has just opened the pricing page. */
  const addLead = useCallback(
    (count = 1) => {
      setLeads(prev => {
        const created: PracticeLead[] = [];
        for (let i = 0; i < count; i += 1) {
          const base = makeSyntheticLead(clock);
          created.push(
            applyJourneyEvent(base, { kind: 'pricing_page_entered', at: clock }),
          );
        }
        return [...prev, ...created];
      });
      pushNotes([`${count} made-up ${count === 1 ? 'customer' : 'customers'} added on the pricing page`]);
    },
    [clock, pushNotes],
  );

  /** Fire one journey step at a lead, keeping the clock as the server clock. */
  const fireEvent = useCallback(
    (leadId: string, kind: JourneyEventKind, extra: Partial<JourneyEvent> = {}) => {
      setLeads(prev =>
        prev.map(l =>
          l.id === leadId
            ? applyJourneyEvent(l, { kind, at: clock, ...extra } as JourneyEvent)
            : l,
        ),
      );
    },
    [clock],
  );

  const takeLead = useCallback(
    (leadId: string, agentId: string) => {
      const result = claimLead(leads, agents, leadId, agentId, settings, clock);
      setLeads(result.leads);
      setAgents(result.agents);
      pushNotes(result.notes);
    },
    [leads, agents, settings, clock, pushNotes],
  );

  const autoAllocate = useCallback(() => {
    const result = allocateQueued(leads, agents, settings, clock, cursor);
    setLeads(result.leads);
    setAgents(result.agents);
    setCursor(result.nextIndex);
    pushNotes(result.notes.length ? result.notes : ['Nothing to hand out, or every seat is full']);
  }, [leads, agents, settings, clock, cursor, pushNotes]);

  const logOutcome = useCallback(
    (leadId: string, result: ContactResult) => {
      const lead = leads.find(l => l.id === leadId);
      if (!lead || !lead.reservedAgentId) return;
      const engine = recordContactOutcome(leads, leadId, {
        at: clock,
        agentId: lead.reservedAgentId,
        result,
        source,
        durationSeconds: result === 'spoke' ? secondsOnLine : 0,
      }, settings);
      setLeads(engine.leads);
      pushNotes(engine.notes);
    },
    [leads, clock, source, secondsOnLine, settings, pushNotes],
  );

  const reset = useCallback(() => {
    setLeads([]);
    setAgents(makeSyntheticAgents());
    setNotes([]);
    setCursor(0);
    setClock(startOfPracticeDay());
  }, []);

  const summary = useMemo(() => poolSummary(leads), [leads]);
  const stats = useMemo(() => intervalReport(leads), [leads]);
  const agentName = useCallback(
    (id: string | null) => agents.find(a => a.id === id)?.name ?? 'nobody',
    [agents],
  );

  const update = (patch: Partial<OrrPracticeSettings>) =>
    setSettings(prev => sanitiseSettings({ ...prev, ...patch }));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Practice mode</Badge>
          <Badge variant="outline">Made-up leads only</Badge>
          <Badge variant="outline">Cannot call, text or message anybody</Badge>
        </div>
        <p className="text-sm text-foreground font-semibold">
          Website lead triggers and continuous re-release
        </p>
        <p className="text-xs text-muted-foreground max-w-3xl">
          Rehearse how a website enquiry becomes a telephone lead, how long the pool waits, and
          what an agent sees. Add a made-up customer, fire the journey steps, then move the clock
          on and watch the lead move through the stages.
        </p>
      </div>

      <IntakeSection
        leads={leads}
        agents={agents}
        settings={settings}
        clock={clock}
        onLeads={(l, n) => {
          setLeads(l);
          pushNotes(n);
        }}
      />

      <AutoRoundRobinSection
        leads={leads}
        agents={agents}
        settings={settings}
        clock={clock}
        onTick={m => tick(m)}
        onResult={(r: ClaimResult) => {
          setLeads(r.leads);
          setAgents(r.agents);
          pushNotes(r.notes);
        }}
      />

      <OpenClaimSection
        leads={leads}
        agents={agents}
        settings={settings}
        clock={clock}
        onResult={(r: ClaimResult) => {
          setLeads(r.leads);
          setAgents(r.agents);
          pushNotes(r.notes);
        }}
      />

      <Section
        title="Practice clock and queue at a glance"
        subtitle="Move time on to see the two-minute rule, the three-minute hold and the two-hour review happen."
        icon={<Clock className="h-4 w-4 text-primary" />}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground tabular-nums">{formatClock(clock)}</span>
          {[1, 2, 5, 30, 120].map(m => (
            <Button key={m} size="sm" variant="outline" onClick={() => tick(m)}>
              <ArrowRight className="h-3.5 w-3.5 mr-1" />
              {m < 60 ? `+${m} min` : `+${m / 60} hr`}
            </Button>
          ))}
          <div className="flex-1" />
          <Button size="sm" onClick={() => addLead(1)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add practice customer
          </Button>
          <Button size="sm" variant="outline" onClick={() => addLead(10)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add ten
          </Button>
          <Button size="sm" variant="outline" onClick={autoAllocate}>
            <Users className="h-3.5 w-3.5 mr-1" /> Hand out queued leads
          </Button>
          <Button size="sm" variant="ghost" onClick={reset}>
            <Eraser className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {[
            { label: 'Browsing', value: summary.anonymous },
            { label: 'Working on it', value: summary.activeSession },
            { label: 'Ready to release', value: summary.awaitingRelease },
            { label: 'In the pool', value: summary.queued },
            { label: 'Held', value: summary.reserved },
            { label: 'Spoken to', value: summary.owned },
            { label: 'Closed', value: summary.closed },
            { label: 'Suppressed', value: summary.suppressed },
          ].map(item => (
            <div key={item.label} className="rounded-md border border-border bg-muted/30 p-2 text-center">
              <p className="text-lg font-bold text-foreground tabular-nums">{item.value}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {agents.map(agent => (
            <div key={agent.id} className="rounded-md border border-border p-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground truncate">{agent.name}</p>
                <Switch
                  checked={agent.available}
                  onCheckedChange={v =>
                    setAgents(prev => prev.map(a => (a.id === agent.id ? { ...a, available: v } : a)))
                  }
                />
              </div>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {agent.usedToday} of {agent.dailyCap === 0 ? 'no allowance' : `${agent.dailyCap} taken today`}
                {!agent.available && ' · away'}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Practice leads"
        subtitle="Each row is invented. Use the buttons to act out what the customer does, then what the agent does."
        icon={<Activity className="h-4 w-4 text-primary" />}
      >
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/30 p-2">
          <div className="flex items-center gap-2">
            <Label className="text-[11px] font-semibold">Call results come from</Label>
            <Select value={source} onValueChange={v => setSource(v as ContactSource)}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zoiper">Zoiper</SelectItem>
                <SelectItem value="dial_nine">Dial Nine</SelectItem>
                <SelectItem value="manual">Typed by hand</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-[11px] font-semibold">Seconds on the line</Label>
            <Input
              type="number"
              className="h-8 w-24 text-xs"
              value={secondsOnLine}
              min={0}
              onChange={e => setSecondsOnLine(Math.max(0, Number(e.target.value)))}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            A voicemail never makes a lead somebody's, however long it ran.
          </p>
        </div>

        {!leads.length && (
          <p className="text-xs text-muted-foreground">
            No practice leads yet. Add a practice customer to begin.
          </p>
        )}

        <div className="space-y-2">
          {leads.map(lead => {
            const decision = canAttemptContact(lead, settings, clock);
            const quiet = minutesBetween(lead.lastActivityAt, clock);
            const heldBy = lead.reservedAgentId ? agentName(lead.reservedAgentId) : null;
            const holdLeft =
              lead.reservedExpiresAt !== null
                ? Math.max(0, Math.ceil((lead.reservedExpiresAt - clock) / MINUTE))
                : null;
            const reviewIn =
              lead.reReleaseDueAt !== null
                ? Math.max(0, Math.ceil((lead.reReleaseDueAt - clock) / MINUTE))
                : null;

            return (
              <div key={lead.id} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{lead.name}</span>
                  <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold', STAGE_STYLE[lead.stage])}>
                    {STAGE_LABEL[lead.stage]}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {lead.phone} · {lead.reg}
                  </span>
                  <span className="text-[11px] text-muted-foreground">quiet {quiet} min</span>
                  {heldBy && (
                    <Badge variant="outline" className="text-[10px]">
                      held by {heldBy}, {holdLeft} min left
                    </Badge>
                  )}
                  {reviewIn !== null && lead.stage === 'queued' && (
                    <Badge variant="outline" className="text-[10px]">
                      reviewed in {reviewIn} min
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    handed {lead.releaseCount} time{lead.releaseCount === 1 ? '' : 's'}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => fireEvent(lead.id, 'quote_details_submitted')}>
                    <LogIn className="h-3 w-3 mr-1" /> Quote details
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => fireEvent(lead.id, 'checkout_entered')}>
                    <CreditCard className="h-3 w-3 mr-1" /> Checkout
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => fireEvent(lead.id, 'activity')}>
                    <Activity className="h-3 w-3 mr-1" /> Still active
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => fireEvent(lead.id, 'checkout_abandoned')}>
                    <PhoneOff className="h-3 w-3 mr-1" /> Left checkout
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      fireEvent(lead.id, 'callback_requested', { callbackAt: clock + 30 * MINUTE })
                    }
                  >
                    <Bell className="h-3 w-3 mr-1" /> Call back in 30 min
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fireEvent(lead.id, 'purchase_completed', { amount: 540 })}
                  >
                    <ShieldCheck className="h-3 w-3 mr-1" /> Bought for £540
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {agents
                    .filter(a => a.available && a.dailyCap > a.usedToday)
                    .map(a => (
                      <Button
                        key={a.id}
                        size="sm"
                        variant="secondary"
                        disabled={lead.stage !== 'queued'}
                        onClick={() => takeLead(lead.id, a.id)}
                      >
                        <Phone className="h-3 w-3 mr-1" /> {a.name} takes it
                      </Button>
                    ))}
                </div>

                {lead.stage === 'reserved' && (
                  <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-violet-50 border border-violet-200 p-2">
                    <span className="text-[11px] font-semibold text-violet-900">Log how it went:</span>
                    <Button size="sm" variant="outline" onClick={() => logOutcome(lead.id, 'spoke')}>
                      <Phone className="h-3 w-3 mr-1" /> Spoke to them
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => logOutcome(lead.id, 'voicemail')}>
                      <Voicemail className="h-3 w-3 mr-1" /> Voicemail
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => logOutcome(lead.id, 'no_answer')}>
                      <PhoneOff className="h-3 w-3 mr-1" /> No answer
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => logOutcome(lead.id, 'wrong_number')}>
                      <MessageSquare className="h-3 w-3 mr-1" /> Wrong number
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => logOutcome(lead.id, 'complaint')}>
                      <Bell className="h-3 w-3 mr-1" /> Complaint
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => logOutcome(lead.id, 'opt_out')}>
                      <Eraser className="h-3 w-3 mr-1" /> Opt out
                    </Button>
                  </div>
                )}

                <p
                  className={cn(
                    'text-[11px]',
                    decision.allowed ? 'text-emerald-800' : 'text-amber-900',
                  )}
                >
                  <ShieldCheck className="h-3 w-3 inline mr-1" />
                  {decision.reason}
                </p>

                {lead.history.length > 0 && (
                  <details className="text-[11px] text-muted-foreground">
                    <summary className="cursor-pointer select-none">
                      What has happened so far ({lead.history.length})
                    </summary>
                    <ul className="mt-1 space-y-0.5 ml-3 list-disc">
                      {lead.history.slice(-8).map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title="Management controls"
        subtitle="These rules apply to this practice run only. Nothing here reaches the live website or the phone system."
        icon={<Sliders className="h-4 w-4 text-primary" />}
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <NumberField
            label="Pricing journey quiet minutes"
            hint="Default two minutes"
            value={settings.pricingInactivityMinutes}
            min={1}
            max={120}
            onChange={n => update({ pricingInactivityMinutes: n })}
          />
          <NumberField
            label="Checkout quiet minutes"
            hint="Default two minutes"
            value={settings.checkoutAbandonmentMinutes}
            min={1}
            max={120}
            onChange={n => update({ checkoutAbandonmentMinutes: n })}
          />
          <NumberField
            label="Claim expiry minutes"
            hint="Default three minutes"
            value={settings.claimExpiryMinutes}
            min={1}
            max={60}
            onChange={n => update({ claimExpiryMinutes: n })}
          />
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-foreground">Re-release review</Label>
            <Select
              value={String(settings.reReleaseIntervalMinutes)}
              onValueChange={v => update({ reReleaseIntervalMinutes: Number(v) })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RE_RELEASE_INTERVAL_CHOICES_MINUTES.map(m => (
                  <SelectItem key={m} value={String(m)}>
                    Every {m < 60 ? `${m} minutes` : `${m / 60} hours`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">Round the clock, with no attempt cap.</p>
          </div>
          <NumberField
            label="Attempts per rolling day"
            value={settings.maxContactAttemptsPerDay}
            min={1}
            max={20}
            onChange={n => update({ maxContactAttemptsPerDay: n })}
          />
          <NumberField
            label="Minutes between attempts"
            value={settings.contactCooldownMinutes}
            min={1}
            max={720}
            onChange={n => update({ contactCooldownMinutes: n })}
          />
          <NumberField
            label="Flag for a manager after"
            hint="Hand-offs before a manager is told"
            value={settings.escalationPriorityAfterReleases}
            min={1}
            max={100}
            onChange={n => update({ escalationPriorityAfterReleases: n })}
          />
          <NumberField
            label="Close after"
            hint="Hand-offs before it stops. Zero means never."
            value={settings.permanentSuppressionAfterReleases}
            min={0}
            max={100}
            onChange={n => update({ permanentSuppressionAfterReleases: n })}
          />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <ToggleField
            label="Pause calling while checkout is open"
            hint="A customer who comes back is left alone."
            checked={settings.activeCheckoutSuppression}
            onChange={v => update({ activeCheckoutSuppression: v })}
          />
          <ToggleField
            label="Require the register check"
            hint="Numbers on the register are never called."
            checked={settings.tpsCheckEnabled}
            onChange={v => update({ tpsCheckEnabled: v })}
          />
          <ToggleField
            label="Require phone consent"
            hint="Only customers who agreed are phoned."
            checked={settings.phoneConsentRequired}
            onChange={v => update({ phoneConsentRequired: v })}
          />
        </div>

        <div className="rounded-md border border-border p-2 space-y-2">
          <p className="text-[11px] font-semibold text-foreground">Permitted calling hours</p>
          <p className="text-[10px] text-muted-foreground">
            Kept separate from the round-the-clock intake clock, so a lead can be collected at
            3am without anybody being phoned then.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {settings.contactWindows.map((w, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md bg-muted/30 p-2">
                <Select
                  value={String(w.day)}
                  onValueChange={v => {
                    const next = [...settings.contactWindows];
                    next[i] = { ...w, day: Number(v) };
                    update({ contactWindows: next });
                  }}
                >
                  <SelectTrigger className="h-7 w-20 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAY_NAMES.map((name, day) => (
                      <SelectItem key={day} value={String(day)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  className="h-7 w-16 text-[11px]"
                  value={w.startHour}
                  min={0}
                  max={23}
                  onChange={e => {
                    const next = [...settings.contactWindows];
                    next[i] = { ...w, startHour: Number(e.target.value) };
                    update({ contactWindows: next });
                  }}
                />
                <span className="text-[11px] text-muted-foreground">to</span>
                <Input
                  type="number"
                  className="h-7 w-16 text-[11px]"
                  value={w.endHour}
                  min={1}
                  max={24}
                  onChange={e => {
                    const next = [...settings.contactWindows];
                    next[i] = { ...w, endHour: Number(e.target.value) };
                    update({ contactWindows: next });
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() =>
                    update({ contactWindows: settings.contactWindows.filter((_, j) => j !== i) })
                  }
                >
                  <Eraser className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              update({
                contactWindows: [
                  ...settings.contactWindows,
                  { day: 1, startHour: 9, endHour: 18 },
                ],
              })
            }
          >
            <Plus className="h-3 w-3 mr-1" /> Add a window
          </Button>
        </div>

        <Button size="sm" variant="ghost" onClick={() => setSettings(DEFAULT_ORR_PRACTICE_SETTINGS)}>
          <RotateCcw className="h-3 w-3 mr-1" /> Restore the defaults
        </Button>
      </Section>

      <Section
        title="Does calling sooner help?"
        subtitle="Compare a one-minute, two-minute and five-minute wait using only made-up leads."
        icon={<Users className="h-4 w-4 text-primary" />}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pr-3 font-semibold">Wait before first call</th>
                <th className="pr-3 font-semibold">Leads</th>
                <th className="pr-3 font-semibold">Contact rate</th>
                <th className="pr-3 font-semibold">Quote completed</th>
                <th className="pr-3 font-semibold">Checkout completed</th>
                <th className="pr-3 font-semibold">Converted</th>
                <th className="pr-3 font-semibold">Money per lead</th>
                <th className="pr-3 font-semibold">Complaints</th>
                <th className="font-semibold">Opt-outs</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr key={s.intervalMinutes} className="border-t border-border">
                  <td className="pr-3 py-1 font-semibold text-foreground">
                    {s.intervalMinutes} minute{s.intervalMinutes === 1 ? '' : 's'}
                  </td>
                  <td className="pr-3 tabular-nums">{s.leads}</td>
                  <td className="pr-3 tabular-nums">{s.leads ? `${Math.round(s.contactRate * 100)}%` : '—'}</td>
                  <td className="pr-3 tabular-nums">
                    {s.leads ? `${Math.round(s.quoteCompletion * 100)}%` : '—'}
                  </td>
                  <td className="pr-3 tabular-nums">
                    {s.leads ? `${Math.round(s.checkoutCompletion * 100)}%` : '—'}
                  </td>
                  <td className="pr-3 tabular-nums">
                    {s.leads ? `${Math.round(s.conversionRate * 100)}%` : '—'}
                  </td>
                  <td className="pr-3 tabular-nums">
                    {s.leads ? `£${s.revenuePerLead.toFixed(0)}` : '—'}
                  </td>
                  <td className="pr-3 tabular-nums">{s.complaints}</td>
                  <td className="tabular-nums">{s.optOuts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Figures come from the practice leads above, so try a few hundred before drawing a
          conclusion. Nothing here changes a live customer journey.
        </p>
      </Section>

      {notes.length > 0 && (
        <Section
          title="What just happened"
          subtitle="Newest first, for this rehearsal only."
          icon={<Bell className="h-4 w-4 text-primary" />}
        >
          <ul className="space-y-0.5 text-[11px] text-muted-foreground">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
};

export default OrrWebsiteTriggerPracticePanel;
