import React from 'react';
import { Split, RefreshCw, Moon, Sunrise } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

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
  reg: string;
  repeat?: boolean;
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
const REG_LETTERS = 'ABCDEFGHJKLMNOPRSTVWXY';

const rand = (n: number) => Math.floor(Math.random() * n);
const fakeReg = () =>
  `${REG_LETTERS[rand(REG_LETTERS.length)]}${REG_LETTERS[rand(REG_LETTERS.length)]}${10 + rand(65)} ${REG_LETTERS[rand(REG_LETTERS.length)]}${REG_LETTERS[rand(REG_LETTERS.length)]}${REG_LETTERS[rand(REG_LETTERS.length)]}`;

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
    return {
      id: `practice-${i}-${arrived.getTime()}`,
      arrived,
      name: FIRST_NAMES[(i + rand(3)) % FIRST_NAMES.length],
      reg: fakeReg(),
      repeat: i % 7 === 3,
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

export const OrrOvernightSandboxPanel: React.FC = () => {
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
  const [tick, setTick] = React.useState(() => new Date());

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

  const perAgentCount = agents.map(a => ({
    ...a,
    count: leads.filter(l => l.assignedTo === a.id).length,
  }));
  const busiest = Math.max(0, ...perAgentCount.map(a => a.count));
  const quietest = Math.min(...(perAgentCount.length ? perAgentCount.map(a => a.count) : [0]));

  const rows = [...leads].sort((a, b) => b.arrived.getTime() - a.arrived.getTime());

  return (
    <div className="space-y-3">
      {/* ── Main ORR practice card — mirrors the live "one lead each" panel ── */}
      <div className={`rounded-lg border-2 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 ${autoOn ? 'border-violet-500 bg-violet-100' : 'border-violet-300 bg-violet-50'}`}>
        <div className="space-y-1.5 flex-1">
          <h3 className="text-sm font-semibold text-violet-900 flex items-center gap-2">
            <Moon className="h-4 w-4" />
            Open Round Robin — overnight leads, one each
            <span className={`text-[10px] font-bold uppercase rounded px-1.5 py-0.5 ${autoOn ? 'bg-violet-600 text-white' : 'bg-violet-200 text-violet-800'}`}>
              {autoOn ? 'On' : 'Off'}
            </span>
            <span className="text-[10px] font-bold uppercase rounded px-1.5 py-0.5 bg-amber-200 text-amber-900">
              Sandbox
            </span>
          </h3>
          <p className="text-[11px] font-medium text-violet-900 bg-violet-200/70 border border-violet-400/50 rounded px-2 py-1">
            Practice only. These leads arrived overnight (from 6pm yesterday) and are waiting for the morning —
            nothing here is a real customer, no agent is notified and no live allocation changes.
          </p>
          <p className="text-xs text-violet-800">
            <strong>When ON:</strong> one waiting overnight lead is released to the next switched-on Open Round Robin
            agent, in arrow order — one each, no pile-up. Runs every 20 seconds until you turn it off.
          </p>
          <ul className="text-[11px] text-violet-700/90 space-y-0.5 list-disc pl-4">
            <li><strong>Open Round Robin agents</strong> ({onAgents.length}) take their own lead from the pool.</li>
            <li>Round Robin agents are untouched — this rehearsal never sends them anything.</li>
            <li>Only brand-new, never-contacted, unowned leads from the last 7 days would be eligible live.</li>
          </ul>
          <p className="text-[11px] text-violet-700">
            Next agent in line: <strong>{nextAgent ? nextAgent.name.split(' ')[0] : '—'}</strong>
            {lastRun ? ` · last checked ${fmtTime(lastRun)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex flex-col items-center gap-1 text-xs font-semibold text-violet-900 cursor-pointer">
            <Switch checked={autoOn} onCheckedChange={setAutoOn} />
            <span>{autoOn ? 'On' : 'Turn on'}</span>
          </label>
          <div className="flex flex-col items-center gap-1">
            <div className="text-[11px] font-semibold text-violet-800 bg-violet-100 border border-violet-300 rounded-md px-2 py-1">
              {waiting.length} waiting
            </div>
            <button
              type="button"
              onClick={() => handOut('rotate', waiting.length)}
              disabled={!waiting.length || !onAgents.length}
              title="Release every overnight lead now, one each in arrow order."
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-violet-600 bg-white text-violet-800 text-xs font-semibold hover:bg-violet-50 transition-colors disabled:opacity-60"
            >
              <Split className="h-3.5 w-3.5" />
              Hand out waiting leads now
            </button>
            <button
              type="button"
              onClick={() => { setLeads(seedOvernightLeads(14)); setCursor(0); setLastRun(null); }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-xs font-medium hover:bg-muted transition-colors"
            >
              <Sunrise className="h-3.5 w-3.5" />
              Reset overnight batch
            </button>
          </div>
        </div>
      </div>

      {/* ── Per-agent on/off ── */}
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <h4 className="text-xs font-semibold text-foreground">Agents taking leads (practice)</h4>
          <span className="text-[11px] text-muted-foreground">
            Switch an agent off and the rotation skips them — even while the toggle above is On.
          </span>
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
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                {['#', 'Arrived', 'Lead', 'Reg', 'Assigned to', 'Why', 'Interaction', 'Assigned at', 'Lead time'].map(h => (
                  <th key={h} className="text-left font-semibold px-2 py-1.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((l, i) => (
                <tr key={l.id} className="border-t border-border/60">
                  <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{fmtArrived(l.arrived)}</td>
                  <td className="px-2 py-1.5">
                    {l.name}
                    {l.repeat && (
                      <span className="ml-1 text-[9px] font-bold uppercase rounded px-1 bg-amber-100 text-amber-800 border border-amber-300">Repeat</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 font-mono">{l.reg}</td>
                  <td className="px-2 py-1.5">
                    {l.assignedTo
                      ? <span className="font-medium">{nameOf(l.assignedTo)}</span>
                      : <span className="text-muted-foreground">Unassigned</span>}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{l.why}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">No interaction yet</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{l.assignedAt ? fmtTime(l.assignedAt) : '—'}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {l.assignedAt ? fmtWait(l.arrived, l.assignedAt) : fmtWait(l.arrived, tick)}
                  </td>
                </tr>
              ))}
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
