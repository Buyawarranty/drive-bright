import React, { useCallback, useState } from 'react';
import {
  Bell,
  Check,
  ChevronDown,
  Copy,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  Split,
  RefreshCw,
  Moon,
  Sunrise,
  Hand as HandGrab,
  StickyNote,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useSandboxLiveLeads, type SandboxLiveLead } from '@/hooks/useSandboxLiveLeads';
import { cn } from '@/lib/utils';
import type { LeadStatus } from '@/hooks/useLeads';


/**
 * Open Round Robin — overnight / morning practice sandbox.
 *
 * A self-contained rehearsal of the "Round robin — one lead each" panel, but for
 * Open Round Robin: leads that arrived overnight sit in the Open Pool and agents
 * take their own. Everything here is made up and lives in local state only —
 * no Supabase reads or writes, no real lead moves, nobody's figures change.
 */

type PracticeAgent = { id: string; name: string; ext: string; on: boolean };

type PracticeLead = {
  id: string;
  arrived: Date;
  name: string;
  surname: string;
  phone: string;
  email: string;
  reg: string;
  repeat?: boolean;
  status: string;
  payment: string;
  paidDate: Date | null;
  assignedTo: string | null; // agent id
  why: string;
  calls: number;
  notes: number;
  assignedAt: Date | null;
};


const FIRST_NAMES = [
  'Nathan', 'Priya', 'Callum', 'Beverley', 'Omar', 'Sian', 'Dermot', 'Aisha',
  'Gordon', 'Leanne', 'Rhys', 'Marta', 'Duncan', 'Yvonne', 'Kofi', 'Tomasz',
];
const SURNAMES = ['Whitfield', 'Ainsley', 'Doherty', 'Kelsall', 'Mensah', 'Okoro', 'Brannigan', 'Halstead'];
const STATUSES = ['New', 'Contacted', 'Follow up', 'Quote sent'];
const REG_LETTERS = 'ABCDEFGHJKLMNOPRSTVWXY';

const rand = (n: number) => Math.floor(Math.random() * n);
const fakeReg = () =>
  `${REG_LETTERS[rand(REG_LETTERS.length)]}${REG_LETTERS[rand(REG_LETTERS.length)]}${10 + rand(65)} ${REG_LETTERS[rand(REG_LETTERS.length)]}${REG_LETTERS[rand(REG_LETTERS.length)]}${REG_LETTERS[rand(REG_LETTERS.length)]}`;
const fakePhone = () => `07${rand(9)}00 ${100000 + rand(899999)}`.slice(0, 13);

/** Overnight window: 6pm yesterday → 8am today, in arrival order. */
const seedOvernightLeads = (count: number): PracticeLead[] => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  start.setHours(18, 0, 0, 0);
  const end = new Date(now);
  end.setHours(8, 0, 0, 0);
  const span = Math.max(end.getTime() - start.getTime(), 60 * 60 * 1000);

  return Array.from({ length: count }, (_, i) => {
    const arrived = new Date(start.getTime() + Math.round((span * (i + 0.5)) / count) + rand(9 * 60 * 1000));
    const name = FIRST_NAMES[(i + rand(3)) % FIRST_NAMES.length];
    const surname = SURNAMES[i % SURNAMES.length];
    return {
      id: `practice-${i}-${arrived.getTime()}`,
      arrived,
      name,
      surname,
      phone: fakePhone(),
      email: `${name.toLowerCase()}.${surname.toLowerCase()}@practice.test`,
      reg: fakeReg(),
      repeat: i % 7 === 3,
      status: STATUSES[i % STATUSES.length],
      payment: 'Not paid',
      paidDate: null,
      assignedTo: null,
      why: 'Waiting in Open Pool',
      calls: 0,
      notes: 0,
      assignedAt: null,
    };
  }).sort((a, b) => a.arrived.getTime() - b.arrived.getTime());
};

const fmtTime = (d: Date) =>
  d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtArrived = (d: Date) =>
  `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${fmtTime(d)}`;
const fmtWait = (from: Date, to: Date) => {
  const mins = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

/** Same colours and labels as the live New Leads table so practice matches production. */
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
  'new', 'contacted', 'follow_up', 'quote_sent', 'negotiating', 'converted', 'lost',
  'not_interested', 'fake_lead', 'urgent_callback', 'no_answer', 'left_voicemail',
  'wrong_number', 'callback_booked', 'bought_elsewhere', 'vehicle_sold', 'do_not_contact',
  'not_eligible',
];

const practiceStatusToLeadStatus = (status: string): LeadStatus => {
  const s = status.toLowerCase();
  if (s === 'new') return 'new';
  if (s === 'contacted') return 'contacted';
  if (s.includes('follow')) return 'follow_up';
  if (s.includes('quote')) return 'quote_sent';
  return 'new';
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
 * Map READ-ONLY live leads into practice rows. The copy lives in local state
 * only — taking, dialling or restatusing a row here never writes to the
 * database and never touches the live New Leads pipeline.
 */
const liveLeadsToPracticeLeads = (live: SandboxLiveLead[]): PracticeLead[] =>
  live
    .map((l) => ({
      id: `live-${l.id}`,
      arrived: l.createdAt,
      name: l.firstName || 'Customer',
      surname: l.lastName || '',
      phone: l.phone,
      email: l.email,
      reg: l.reg,
      repeat: false,
      status: statusLabels[(l.status as LeadStatus)] ?? 'New',
      payment: 'Not paid',
      paidDate: null,
      assignedTo: null,
      why: 'Waiting in Open Pool (practice copy of a live lead)',
      calls: l.callCount,
      notes: 0,
      assignedAt: null,
    }))
    .sort((a, b) => a.arrived.getTime() - b.arrived.getTime());

export const OrrOvernightSandboxPanel: React.FC = () => {
  // 'practice' = made-up names. 'live' = a read-only copy of the leads we really
  // received. Live mode NEVER writes: New Leads and agent figures stay untouched.
  const [dataSource, setDataSource] = React.useState<'practice' | 'live'>('practice');
  const {
    leads: liveLeads,
    loading: liveLoading,
    error: liveError,
    refresh: refreshLive,
  } = useSandboxLiveLeads(dataSource === 'live', { window: 'overnight', limit: 40 });
  const [agents, setAgents] = React.useState<PracticeAgent[]>([
    { id: 'a1', name: 'Freddie Howard', ext: '202', on: true },
    { id: 'a2', name: 'James Reed', ext: '201', on: true },
    { id: 'a3', name: 'Thomas Clark', ext: '203', on: true },
  ]);
  const [leads, setLeads] = React.useState<PracticeLead[]>(() => seedOvernightLeads(14));
  const [autoOn, setAutoOn] = React.useState(false);
  const [cursor, setCursor] = React.useState(0);
  const [lastRun, setLastRun] = React.useState<Date | null>(null);
  const [catchUpAgent, setCatchUpAgent] = React.useState('');
  const [catchUpN, setCatchUpN] = React.useState(5);
  const [previewAgentId, setPreviewAgentId] = React.useState('a1');
  const [morningRun, setMorningRun] = React.useState<Date | null>(null);
  const [tick, setTick] = React.useState(() => new Date());


  // Reseed the practice pool whenever the data source or the live batch changes.
  React.useEffect(() => {
    if (dataSource === 'live') {
      setLeads(liveLeadsToPracticeLeads(liveLeads));
    } else {
      setLeads(seedOvernightLeads(14));
    }
    setCursor(0);
    setLastRun(null);
    setMorningRun(null);
  }, [dataSource, liveLeads]);

  const onAgents = agents.filter(a => a.on);
  const waiting = leads.filter(l => !l.assignedTo);
  const nextAgent = onAgents.length ? onAgents[cursor % onAgents.length] : null;
  const nameOf = (id: string | null) => agents.find(a => a.id === id)?.name ?? 'Open Pool';

  React.useEffect(() => {
    const t = window.setInterval(() => setTick(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  /** Take the oldest N waiting leads for the given agent(s). */
  const handOut = React.useCallback((mode: 'rotate' | 'single', count: number, agentId?: string) => {
    setLeads(prev => {
      const pending = prev.filter(l => !l.assignedTo).sort((a, b) => a.arrived.getTime() - b.arrived.getTime());
      if (!pending.length) return prev;
      const targets = mode === 'single'
        ? (agentId ? [agentId] : [])
        : onAgents.map(a => a.id);
      if (!targets.length) return prev;
      const now = new Date();
      const picked = pending.slice(0, count);
      const map = new Map<string, { agentId: string; why: string }>();
      picked.forEach((lead, i) => {
        const target = mode === 'single' ? targets[0] : targets[(cursor + i) % targets.length];
        map.set(lead.id, {
          agentId: target,
          why: mode === 'single' ? 'Catch-up (manager push)' : 'Taken from Open Pool',
        });
      });
      if (mode === 'rotate') setCursor(c => c + picked.length);
      setLastRun(now);
      return prev.map(l => {
        const hit = map.get(l.id);
        return hit ? { ...l, assignedTo: hit.agentId, why: hit.why, assignedAt: now } : l;
      });
    });
  }, [onAgents, cursor]);

  // Auto drip — one lead to the next switched-on agent every 20 seconds.
  React.useEffect(() => {
    if (!autoOn) return;
    const run = () => handOut('rotate', 1);
    run();
    const t = window.setInterval(run, 20000);
    return () => window.clearInterval(t);
  }, [autoOn, handOut]);

  /** ORR self-claim — the agent takes the oldest waiting lead themselves. */
  const takeNextLead = React.useCallback((agentId: string) => {
    setLeads(prev => {
      const oldest = prev
        .filter(l => !l.assignedTo)
        .sort((a, b) => a.arrived.getTime() - b.arrived.getTime())[0];
      if (!oldest) return prev;
      const now = new Date();
      return prev.map(l =>
        l.id === oldest.id
          ? { ...l, assignedTo: agentId, why: 'Agent took it from the Open Pool', assignedAt: now }
          : l,
      );
    });
  }, []);

  /** Practice-only local status update so the Status dropdown matches New Leads. */
  const updateStatus = React.useCallback((leadId: string, status: LeadStatus) => {
    const label = statusLabels[status] ?? status;
    setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, status: label } : l)));
  }, []);

  /** Practice-only local call counter so the Calls column matches New Leads. */
  const adjustCalls = React.useCallback((leadId: string, delta: number) => {
    setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, calls: Math.max(0, l.calls + delta) } : l)));
  }, []);

  /** Morning distribution — release the whole parked overnight batch, one each. */
  const runMorningRelease = React.useCallback(() => {
    setMorningRun(new Date());
    handOut('rotate', leads.filter(l => !l.assignedTo).length);
  }, [handOut, leads]);

  const perAgentCount = agents.map(a => ({

    ...a,
    count: leads.filter(l => l.assignedTo === a.id).length,
  }));
  const busiest = Math.max(0, ...perAgentCount.map(a => a.count));
  const quietest = Math.min(...(perAgentCount.length ? perAgentCount.map(a => a.count) : [0]));

  const rows = [...leads].sort((a, b) => b.arrived.getTime() - a.arrived.getTime());

  return (
    <div className="space-y-4">
      {/* ── Header card — matches the Open Round Robin practice panel layout ── */}
      <section className="rounded-xl border border-border bg-card shadow-sm p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 bg-violet-50 border border-violet-100">
              <Moon className="h-5 w-5 text-violet-600" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                  Open Round Robin practice — overnight leads, one each
                </h3>
                <span className="rounded-full bg-violet-50 text-violet-700 border border-violet-100 text-[11px] font-medium px-2.5 py-0.5">
                  Practice mode
                </span>
                <span className="rounded-full bg-muted text-muted-foreground text-[11px] font-medium px-2.5 py-0.5">
                  Managers only
                </span>
                <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] font-medium px-2.5 py-0.5">
                  Nothing counts
                </span>
                <span className={`rounded-full text-[11px] font-medium px-2.5 py-0.5 border ${autoOn ? 'bg-violet-600 text-white border-violet-600' : 'bg-background text-muted-foreground border-border'}`}>
                  {autoOn ? 'On' : 'Off'}
                </span>
              </div>
              <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-1 leading-relaxed max-w-2xl">
                <li>Rehearse the overnight batch safely — leads that arrived from 6pm yesterday wait in the Open Pool.</li>
                <li>At 09:00 they are released one each, in rotation order, to switched-on Open Round Robin agents.</li>
                <li>{dataSource === 'live' ? 'These are real overnight leads shown as a read-only copy.' : 'Every name here is made up.'} Nothing is written back and no figures change.</li>
              </ul>
              <p className="text-xs text-muted-foreground">
                Next agent in line: <strong className="text-foreground">{nextAgent ? nextAgent.name.split(' ')[0] : '—'}</strong>
                {lastRun ? ` · last checked ${fmtTime(lastRun)}` : ''} · Round Robin agents are untouched · live
                eligibility is brand-new, never-contacted, unowned leads from the last 7 days.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-border flex items-center gap-2 flex-wrap">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
            <Switch checked={autoOn} onCheckedChange={setAutoOn} />
            <span>{autoOn ? 'Releasing every 20s' : 'Turn on auto-release'}</span>
          </label>
          <button
            type="button"
            onClick={() => handOut('rotate', waiting.length)}
            disabled={!waiting.length || !onAgents.length}
            title="Release every overnight lead now, one each in arrow order."
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-violet-600 bg-white text-violet-800 text-xs font-semibold hover:bg-violet-50 transition-colors disabled:opacity-60"
          >
            <Split className="h-3.5 w-3.5" />
            Hand out waiting leads now
          </button>
          <div className="inline-flex items-center rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setDataSource('practice')}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold transition-colors',
                dataSource === 'practice' ? 'bg-violet-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              Made-up names
            </button>
            <button
              type="button"
              onClick={() => setDataSource('live')}
              title="Rehearse against the real overnight leads. Read-only copy — nothing is written back and New Leads is untouched."
              className={cn(
                'px-3 py-1.5 text-xs font-semibold border-l border-border transition-colors',
                dataSource === 'live' ? 'bg-violet-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted',
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
              <button
                type="button"
                onClick={() => void refreshLive()}
                disabled={liveLoading}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-xs font-medium hover:bg-muted transition-colors disabled:opacity-60"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', liveLoading && 'animate-spin')} />
                Refresh live batch
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              if (dataSource === 'live') { void refreshLive(); } else { setLeads(seedOvernightLeads(14)); }
              setCursor(0); setLastRun(null);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-xs font-medium hover:bg-muted transition-colors"
          >
            <Sunrise className="h-3.5 w-3.5" />
            Reset overnight batch
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {waiting.length} waiting · {onAgents.length} agents on
          </span>
          {dataSource === 'live' && liveError && (
            <span className="text-xs text-destructive">{liveError}</span>
          )}
          {dataSource === 'live' && !liveError && !liveLoading && !leads.length && (
            <span className="text-xs text-muted-foreground">No live leads arrived in the overnight window — try Refresh live batch later.</span>
          )}
        </div>
      </section>


      {/* ── Per-agent on/off ── */}
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h4 className="text-xs font-semibold text-foreground">Agents taking leads (practice)</h4>
          <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
            <li>Switch an agent off and the rotation skips them.</li>
            <li>Auto-release still runs, but only for agents who are switched on.</li>
          </ul>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {perAgentCount.map(a => (
            <div
              key={a.id}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${a.on ? 'border-violet-300 bg-violet-50' : 'border-border bg-muted/30'}`}
            >
              <span className="text-xs font-medium text-foreground">{a.name}</span>
              <span className="text-[10px] font-bold uppercase rounded px-1 py-0.5 bg-violet-200 text-violet-900">ORR</span>
              <span className="text-[10px] text-muted-foreground">ext {a.ext} · {a.count}</span>
              <Switch
                checked={a.on}
                onCheckedChange={v => setAgents(prev => prev.map(x => (x.id === a.id ? { ...x, on: v } : x)))}
              />
              <span className="text-[10px] text-muted-foreground w-6">{a.on ? 'On' : 'Off'}</span>
            </div>
          ))}
        </div>

        {/* Catch-up push */}
        <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Catch-up:</span>
          <select
            value={catchUpAgent}
            onChange={e => setCatchUpAgent(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">Select agent…</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input
            type="number"
            min={1}
            max={20}
            value={catchUpN}
            onChange={e => setCatchUpN(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            className="h-8 w-16 rounded-md border border-border bg-background px-2 text-xs"
          />
          <button
            type="button"
            onClick={() => handOut('single', catchUpN, catchUpAgent)}
            disabled={!catchUpAgent || !waiting.length}
            className="h-8 px-3 rounded-md border border-violet-600 bg-white text-violet-800 text-xs font-semibold hover:bg-violet-50 disabled:opacity-60"
          >
            Allocate next {catchUpN} to agent
          </button>
          <span className="text-[11px] text-muted-foreground">
            Practice pushing the oldest overnight leads straight to one agent, ignoring rotation order.
          </span>
        </div>
      </div>

      {/* ── Take next lead (agent view) ── */}
      <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50/60 p-3 space-y-2">
        <h4 className="text-xs font-semibold text-emerald-900 flex items-center gap-2">
          <HandGrab className="h-4 w-4" />
          Take next lead — agent view (practice)
        </h4>
        <p className="text-[11px] text-emerald-900/90">
          This is the Open Round Robin action itself: the agent takes the oldest waiting lead from the pool
          rather than being sent one. Pick who you are practising as, then press Take next lead.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={previewAgentId}
            onChange={e => setPreviewAgentId(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          >
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name} · ext {a.ext}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => takeNextLead(previewAgentId)}
            disabled={!waiting.length}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
          >
            <HandGrab className="h-3.5 w-3.5" />
            Take next lead
          </button>
          <span className="text-[11px] text-emerald-900/80">
            {waiting.length
              ? `${waiting.length} waiting in the pool · you hold ${leads.filter(l => l.assignedTo === previewAgentId).length}`
              : 'Pool empty — reset the overnight batch to practise again.'}
          </span>
        </div>
      </div>

      {/* ── Morning lead distribution ── */}
      <div className="rounded-lg border-2 border-amber-300 bg-amber-50/70 p-3 space-y-2">
        <h4 className="text-xs font-semibold text-amber-900 flex items-center gap-2">
          <Sunrise className="h-4 w-4" />
          Morning lead distribution — 09:00 release (practice)
        </h4>
        <p className="text-[11px] text-amber-900/90">
          Leads that arrived after 6pm or overnight are parked until 09:00 on the next working day, then
          released one each in rotation to the switched-on agents. Press the button to rehearse that 9am
          release now.
        </p>
        <p className="text-[11px] text-amber-900/90 border-l-2 border-amber-400 pl-2">
          <strong>Late start (e.g. 10am instead of 9am):</strong> the 09:00 overnight batch is shared only
          between agents switched on at 09:00 — a late starter gets <strong>none of that batch, ever</strong>.
          The leads were the pool's, never theirs, so nothing is owed. From the moment they switch on they
          rejoin the <strong>back of the rotation</strong> and take normal turns from leads still waiting plus
          new ones arriving — no catch-up, nobody's allocation is redone. To rehearse it: run the release with
          an agent switched off, then switch them on and watch the next leads go to them in turn.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-semibold text-amber-900 bg-amber-200/70 border border-amber-400/60 rounded px-2 py-1">
            {waiting.length} parked overnight
          </span>
          <button
            type="button"
            onClick={runMorningRelease}
            disabled={!waiting.length || !onAgents.length}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-60"
          >
            <Sunrise className="h-3.5 w-3.5" />
            Run the 09:00 morning release
          </button>
          <span className="text-[11px] text-amber-900/80">
            {morningRun
              ? `Released at ${fmtTime(morningRun)} across ${onAgents.length} agent(s).`
              : 'Not run yet this practice session.'}
          </span>
        </div>
      </div>

      {/* ── Practice lead stream ── */}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-3 py-2 border-b border-border flex flex-wrap items-center gap-2 bg-muted/20">
          <h4 className="text-xs font-semibold text-foreground">Practice lead stream</h4>
          <span className="text-[11px] text-muted-foreground">{leads.length} total · since 6pm yesterday</span>
          <span className="text-[10px] font-bold uppercase rounded px-1.5 py-0.5 bg-amber-200 text-amber-900">Made-up names</span>
          <button
            type="button"
            onClick={() => setTick(new Date())}
            className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" /> updated {fmtTime(tick)}
          </button>
        </div>
        <div className="px-3 py-2 border-b border-border flex flex-wrap gap-3 text-[11px]">
          {perAgentCount.map(a => (
            <span key={a.id} className="text-foreground"><strong>{a.name}</strong> {a.count}</span>
          ))}
          <span className="text-muted-foreground">Unassigned {waiting.length}</span>
          <span className="text-muted-foreground">
            Off by {busiest - quietest} between busiest and quietest
          </span>
        </div>
        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-center w-11">#</th>
                <th className="px-2 py-2 text-left w-9"></th>
                <th className="px-2 py-2 text-left">Agent</th>
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
              {rows.map((l, i) => {
                const displayStatus = practiceStatusToLeadStatus(l.status);
                const agentName = l.assignedTo ? nameOf(l.assignedTo) : 'Unassigned';
                const assigned = !!l.assignedTo;
                return (
                  <tr key={l.id} className="border-t border-border align-middle bg-background">
                    <td className="px-2 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-2 py-2">
                      <input type="checkbox" className="h-4 w-4 rounded border-input" readOnly />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-col items-start gap-1">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 whitespace-nowrap">
                          <span className="h-4 w-4 rounded-full bg-emerald-600 text-white text-[9px] flex items-center justify-center">
                            {agentName.charAt(0)}
                          </span>
                          {agentName}
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        </span>
                        {assigned && (
                          <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 whitespace-nowrap">
                            Reserved
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={displayStatus}
                        onValueChange={(value) => updateStatus(l.id, value as LeadStatus)}
                      >
                        <SelectTrigger
                          className={cn(
                            'h-7 px-2 text-[11px] font-medium whitespace-nowrap border gap-1 w-auto min-w-[120px]',
                            statusColors[displayStatus],
                          )}
                        >
                          <SelectValue>{statusLabels[displayStatus]}</SelectValue>
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
                          onClick={() => adjustCalls(l.id, -1)}
                        >
                          −
                        </button>
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-semibold tabular-nums">{l.calls}</span>
                        <button
                          type="button"
                          className="h-5 w-5 rounded border border-input text-xs leading-none"
                          onClick={() => adjustCalls(l.id, 1)}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => nextAgent && handOut('single', 1, nextAgent.id)}
                          disabled={assigned || !nextAgent}
                          className="inline-flex items-center gap-1 h-6 px-2 rounded border border-violet-600 bg-white text-[10px] font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-50"
                        >
                          <HandGrab className="h-3 w-3" /> Take lead
                        </button>
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="h-7 rounded-md border border-amber-300 px-2 text-xs font-medium text-amber-700 hover:bg-amber-50"
                              >
                                No answer
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              Practice only — couldn&apos;t connect / no answer
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <span className="h-7 w-7 rounded-md border-2 border-orange-500 flex items-center justify-center">
                          <ChevronDown className="h-3.5 w-3.5 text-orange-600" />
                        </span>
                        <a href={`tel:${l.phone}`} className="h-7 w-7 rounded-md flex items-center justify-center text-emerald-600 hover:bg-emerald-50">
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
                      {l.name} {l.surname}
                      {l.repeat && (
                        <span className="ml-1 text-[9px] font-bold uppercase rounded px-1 bg-amber-100 text-amber-800 border border-amber-300">Repeat</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="h-5 w-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">Z</span>
                        <a
                          href={`tel:${l.phone}`}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-900"
                        >
                          <Phone className="h-3 w-3" /> {l.phone}
                        </a>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(l.phone);
                            } catch {
                              // ignore
                            }
                          }}
                          title="Copy number"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      <CopyEmail email={l.email} />
                    </td>
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center rounded bg-yellow-300 px-2 py-1 text-xs font-bold text-yellow-950 font-mono">
                        {l.reg}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground whitespace-nowrap">{l.payment}</td>
                    <td className="px-2 py-2 text-xs text-muted-foreground whitespace-nowrap">{l.paidDate ? fmtArrived(l.paidDate) : '—'}</td>
                    <td className="px-2 py-2 text-xs whitespace-nowrap">
                      {l.calls > 0 ? (
                        <div>
                          <div className="font-medium text-foreground">{l.calls} dial{l.calls === 1 ? '' : 's'} logged</div>
                          <div className="text-[11px] text-muted-foreground">practice · {l.assignedAt ? fmtTime(l.assignedAt) : 'waiting'}</div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-muted-foreground">No agent activity</div>
                          <div className="text-[11px] text-muted-foreground">{l.assignedAt ? fmtTime(l.assignedAt) : 'waiting'}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtArrived(l.arrived)}</td>
                    <td className="px-2 py-2 text-xs whitespace-nowrap">
                      <div className="text-muted-foreground">No customer activity</div>
                    </td>
                    <td className="px-2 py-2 text-xs whitespace-nowrap">
                      {l.assignedAt ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
                          {fmtWait(l.arrived, l.assignedAt)}
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
        <p className="px-3 py-2 text-[10px] text-muted-foreground border-t border-border">
          Newest first. # is the order the lead arrived, so you can read straight down and check the overnight
          batch went out one each, in order. Everything on this panel is practice data held in your browser only —
          it disappears when you reload and never touches live allocation, notifications or agent figures.
        </p>
      </div>
    </div>
  );
};

export default OrrOvernightSandboxPanel;
