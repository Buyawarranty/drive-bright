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
