import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  ChevronDown,
  Clock,
  Copy,
  FileText,
  FlaskConical,
  Mail,
  MessageSquare,
  Phone,
  Lock,
  Play,
  Plus,
  RefreshCw,
  StickyNote,
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
  dials: number;
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
        dials: 0,
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
      title: 'Practice lead added',
      description: 'One lead per agent — if everyone is busy it waits in the queue. Nothing real was changed.',
    });

  }, [toast]);

  const adjustDials = (id: string, delta: number) => {
    setLeads((current) =>
      current.map((lead) =>
        lead.id === id
          ? {
              ...lead,
              dials: Math.max(0, lead.dials + delta),
              history: [...lead.history, `Manual dial counter ${delta > 0 ? '+1' : '-1'}`],
            }
          : lead,
      ),
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
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FlaskConical className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                  Open Round Robin practice — Team Blue
                </h3>
                <span className="rounded-full bg-primary/10 text-primary text-[11px] font-medium px-2.5 py-0.5">
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
            <Plus className="h-3.5 w-3.5 mr-1.5" /> I'll take the next lead
          </Button>
          <Button size="sm" variant="outline" onClick={() => setTick((current) => current + 1)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={runSweep} disabled={leads.length === 0}>
            <Play className="h-3.5 w-3.5 mr-1.5" /> Pass on now
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
      <section className="rounded-xl border-l-4 border-l-primary border-y border-r border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-foreground">New Leads — Team Blue</h4>
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
            No practice leads for {getAgent(simulatedAgentId).name}. Click <strong>Add practice lead</strong> or switch the agent preview.

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
                        <div className="min-w-[160px] rounded-md border border-teal-100 bg-teal-50/40 px-2.5 py-2">
                          {expired ? (
                            <div className="text-xs font-medium text-muted-foreground inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Offered to another agent
                            </div>
                          ) : (
                            <>
                              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800 whitespace-nowrap">
                                <Lock className="h-3 w-3 text-teal-600" /> Held for you
                              </div>
                              <div className="text-sm font-semibold text-teal-900 tabular-nums">
                                {formatClock(remaining)} left to call
                              </div>
                            </>
                          )}
                          <div className="text-[11px] text-muted-foreground">
                            Lead arrived {formatClock(ageSec)} ago · Attempt {lead.attemptCount}
                          </div>

                          <div className="mt-1.5 h-1.5 w-full rounded-full bg-teal-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-teal-500 transition-all"
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
                      </td>
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1 text-xs text-emerald-800 whitespace-nowrap">
                          Not spoken to <ChevronDown className="h-3 w-3" />
                        </span>
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