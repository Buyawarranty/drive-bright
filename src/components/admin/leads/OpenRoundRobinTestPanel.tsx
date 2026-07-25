import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Copy,
  FastForward,
  FlaskConical,
  Phone,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

type DummyLeadStatus = 'queued' | 'new' | 'reassigned' | 'dormant';

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
  assignedTo: string | null;
  deadlineAt: number;
  attemptCount: number;
  vehicleReg: string;
  phone: string;
  createdAt: number;
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
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
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
    lead.assignedTo = agent.id;
    lead.attemptCount = attempt;
    lead.deadlineAt = now + CLAIM_WINDOW_MS;
    lead.history = [...lead.history, `Attempt ${attempt} assigned to ${agent.name}`];
    reassigned += 1;
  }

  return { leads, index, reassigned, dormant };
};

/**
 * Open Round Robin — frontend-only dummy test mode.
 * This intentionally does not call Supabase, RPCs, edge functions, or live lead tables.
 */
export const OpenRoundRobinTestPanel: React.FC = () => {
  const { toast } = useToast();
  const [leads, setLeads] = useState<DummyLead[]>([]);
  const nextAgentIndexRef = useRef(0);
  const [simulatedAgentId, setSimulatedAgentId] = useState(DUMMY_AGENTS[0].id);
  const [tick, setTick] = useState(0);

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
    setLeads((current) => {
      const leadNumber = current.length + 1;
      const draft: DummyLead = {
        id: `dummy-orr-${now}`,
        firstName: 'TEST',
        lastName: `Lead ${String(leadNumber).padStart(2, '0')}`,
        status: 'queued',
        assignedTo: null,
        deadlineAt: now,
        attemptCount: 0,
        vehicleReg: 'TEST123',
        phone: '07902222222',
        createdAt: now,
        history: ['Created — entering open pool'],
      };

      const result = advance([draft, ...current], nextAgentIndexRef.current, now);
      nextAgentIndexRef.current = result.index;
      const placed = result.leads.find((lead) => lead.id === draft.id);
      if (placed?.assignedTo) {
        const target = placed.assignedTo;
        window.setTimeout(() => setSimulatedAgentId(target), 0);
      }
      return result.leads;
    });

    toast({
      title: 'Dummy lead created',
      description: 'One lead per agent — if everyone is busy it waits in the queue. No Supabase data was changed.',
    });
  }, [toast]);

  const fastForward = (id: string) => {
    setLeads((current) =>
      current.map((lead) =>
        lead.id === id
          ? {
              ...lead,
              deadlineAt: Date.now() - 1000,
              history: [...lead.history, '2-minute call window manually expired'],
            }
          : lead,
      ),
    );
    toast({ title: 'Window expired', description: 'It will roll to the next free agent within a second.' });
  };

  const runSweep = () => {
    const now = Date.now();
    setLeads((current) => {
      const result = advance(current, nextAgentIndexRef.current, now);
      nextAgentIndexRef.current = result.index;
      window.setTimeout(
        () =>
          toast({
            title: 'Dummy sweep complete',
            description: `Reassigned ${result.reassigned} · Dormant ${result.dormant}. No live leads were changed.`,
          }),
        0,
      );
      return result.leads;
    });
  };

  const cleanup = () => {
    setLeads([]);
    nextAgentIndexRef.current = 0;
    toast({ title: 'Dummy leads cleared', description: 'The test page has been reset.' });
  };

  const copyPhone = async (phone: string) => {
    await navigator.clipboard.writeText(phone);
    toast({ title: 'Phone number copied', description: phone });
  };

  void tick;

  return (
    <section className="rounded-lg border-2 border-rose-500 bg-rose-50/60 shadow-sm">
      <div className="px-5 py-4 border-b border-rose-300 flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-2">
          <FlaskConical className="h-4 w-4 text-rose-700 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5">
                Dry Run
              </span>
              ORR dummy test lab — Team Blue
              <Badge variant="outline" className="text-[10px] border-rose-400 text-rose-800">Managers only</Badge>
              <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-700">No Supabase</Badge>
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              This is made-up data only. Use it to test the 2-minute countdown, reassignment sweep,
              dormant state, agent view, phone column, click-to-dial, and copy button before pushing
              the live ORR flow to real sales agents.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setTick((current) => current + 1)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
          <Button size="sm" onClick={createTestLead}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Create dummy lead
          </Button>
          <Button size="sm" variant="secondary" onClick={runSweep} disabled={leads.length === 0}>
            <Play className="h-3.5 w-3.5 mr-1.5" /> Run dummy sweep
          </Button>
          <Button size="sm" variant="destructive" onClick={cleanup} disabled={leads.length === 0}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear test panel
          </Button>
        </div>
      </div>

      <div className="px-5 py-3 text-xs text-rose-900 bg-rose-100/70 border-b border-rose-300 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <strong>Where to see it:</strong> open the admin dashboard and choose <strong>ORR Test Lab</strong> in the
          sidebar, or use <strong>Lead Allocation</strong> and scroll to <strong>Test Open Round Robin safely</strong>.
          This dummy version stays on this page only and will not appear in real New Leads, real Queue &amp; Capacity,
          scoreboards, reports, or Supabase.
        </div>
      </div>

      <div className="px-5 py-4 bg-white border-b border-rose-200">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-foreground">View as dummy sales agent</div>
            <div className="text-xs text-muted-foreground">Change agent to see the row appear/disappear exactly like a sales agent view.</div>
          </div>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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

      <div className="px-5 py-4 bg-white">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5">
              Live · Dummy
            </span>
            <h4 className="text-sm font-semibold text-foreground">Synthetic New Leads — Team Blue</h4>
            <Badge variant="outline" className="text-[10px]">Look &amp; feel matches New Leads tab</Badge>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Countdown 1s · claim window 120s · one live lead per agent · auto-sweep on
          </span>
        </div>

        {queuedLeads.length > 0 && (
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <strong>{queuedLeads.length}</strong> dummy lead{queuedLeads.length === 1 ? '' : 's'} waiting in the open pool queue —
            every agent already holds a live lead. They release automatically as windows free up.
          </div>
        )}


        {visibleLeads.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center border border-dashed border-rose-300 rounded-md bg-rose-50/40">
            No dummy leads for {getAgent(simulatedAgentId).name}. Click <strong>Create dummy lead</strong> or switch agent views.
          </div>
        ) : (
          <ul className="space-y-2">
            {visibleLeads.map((lead) => {
              const now = Date.now();
              const remainingMs = lead.deadlineAt - now;
              const remaining = Math.max(0, Math.round(remainingMs / 1000));
              const expired = remainingMs <= 0;
              const ageSec = Math.round((now - lead.createdAt) / 1000);
              const agent = getAgent(lead.assignedTo);

              return (
                <li
                  key={lead.id}
                  className={`rounded-md border p-3 flex flex-wrap items-center gap-3 bg-white ${
                    expired ? 'border-rose-400 bg-rose-50' : 'border-blue-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-[220px]">
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-600 text-white text-[10px] font-bold uppercase px-2 py-0.5">
                      Blue
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 text-white text-[10px] font-bold uppercase px-2 py-0.5">
                      TEST
                    </span>
                    <div className="text-sm font-semibold text-foreground">
                      {lead.firstName} {lead.lastName}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-3 min-w-[260px]">
                    <span className="font-mono px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-900 border border-yellow-300">
                      {lead.vehicleReg}
                    </span>
                    <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline">
                      <Phone className="h-3 w-3" /> {lead.phone}
                    </a>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => copyPhone(lead.phone)}>
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                  </div>

                  <div className="text-xs flex items-center gap-1 min-w-[160px]">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium text-foreground">{agent.name}</span>
                    <span className="text-muted-foreground">ext {agent.extension}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {expired ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 text-white text-xs font-semibold px-2 py-1">
                        <Clock className="h-3 w-3" /> Expired · sweep to reassign
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 rounded-md text-xs font-semibold px-2 py-1 ${
                          remaining <= 30 ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-blue-100 text-blue-800 border border-blue-300'
                        }`}
                      >
                        <Clock className="h-3 w-3" /> {formatClock(remaining)} left
                      </span>
                    )}
                    <Badge variant="outline" className="text-[10px]">A{lead.attemptCount}</Badge>
                    <Badge variant="outline" className="text-[10px]">{lead.status}</Badge>
                    <span className="text-[11px] text-muted-foreground">Age {ageSec}s</span>
                  </div>

                  <div className="ml-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fastForward(lead.id)}
                      disabled={expired}
                    >
                      <FastForward className="h-3.5 w-3.5 mr-1.5" /> Expire window
                    </Button>
                  </div>

                  <div className="basis-full text-[11px] text-muted-foreground border-t border-border pt-2">
                    {lead.history[lead.history.length - 1]}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-[11px] text-muted-foreground mt-3">
          This page is only a front-end simulator: create, expire, sweep, reassign, and delete actions are held in browser memory.
        </p>
      </div>
    </section>
  );
};

export default OpenRoundRobinTestPanel;