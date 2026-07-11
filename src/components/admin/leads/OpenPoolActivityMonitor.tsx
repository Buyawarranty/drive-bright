import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';
import { formatDistanceToNowStrict } from 'date-fns';

/**
 * Manager-only view of Open Lead Pool activity.
 *
 * For every "taken" event from shark_tank_audit we look at the matching
 * sales_leads_changelog rows (status changed to 'contacted' by the same
 * agent for the same lead) and classify the take as:
 *
 *   green  - agent marked "Spoken to" within the 7-min lock window
 *   amber  - agent marked "Spoken to" AFTER the lock expired (flag for
 *            recording spot-check — they claim contact but dropped the lead)
 *   red    - lock expired with NO status change (lead dropped, no work)
 *
 * We also flag agents with 3+ consecutive takes without "Spoken to" as a
 * pattern red — likely lying about contact or gaming the queue.
 */

const LOCK_MINUTES = 7;

type Take = {
  lead_id: string;
  actor_id: string;
  taken_at: string;
  lead_name?: string | null;
  lead_phone?: string | null;
  vehicle_reg?: string | null;
  lead_source?: string | null;
  spoken_at?: string | null;      // when status became 'contacted' by same agent
  classification: 'green' | 'amber' | 'red';
};

type AgentSummary = {
  agent_id: string;
  taken: number;
  green: number;
  amber: number;
  red: number;
  streakRed: boolean;   // 3+ consecutive takes with no Spoken to
};

type WindowKey = 'today' | '7d' | '30d';

const WINDOWS: Record<WindowKey, { label: string; hours: number }> = {
  today: { label: 'Today',        hours: 24 },
  '7d':  { label: 'Last 7 days',  hours: 24 * 7 },
  '30d': { label: 'Last 30 days', hours: 24 * 30 },
};

export function OpenPoolActivityMonitor() {
  const adminMap = useAllAdminUsersMap();
  const [win, setWin] = useState<WindowKey>('today');
  const [rows, setRows] = useState<Take[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - WINDOWS[win].hours * 3600_000).toISOString();

    // 1. All "taken" events in window
    const { data: audits } = await supabase
      .from('shark_tank_audit')
      .select('lead_id, actor_id, created_at')
      .eq('action', 'taken')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500);

    const takes = (audits ?? []).filter(a => a.actor_id) as Array<{
      lead_id: string; actor_id: string; created_at: string;
    }>;

    if (takes.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    const leadIds = Array.from(new Set(takes.map(t => t.lead_id)));

    // 2. Lead details
    const { data: leads } = await supabase
      .from('sales_leads')
      .select('id, first_name, last_name, phone, vehicle_reg, lead_source')
      .in('id', leadIds);
    const leadMap = new Map((leads ?? []).map(l => [l.id, l]));

    // 3. Status→contacted change events for those leads in window
    const { data: changes } = await supabase
      .from('sales_leads_changelog')
      .select('lead_id, changed_by, changed_at, new_status, old_status')
      .in('lead_id', leadIds)
      .eq('new_status', 'contacted')
      .gte('changed_at', since)
      .order('changed_at', { ascending: true });

    // Build a map: `${lead_id}|${actor_id}` -> earliest spoken timestamp AFTER a take
    const spokenLookup = new Map<string, string[]>();
    for (const c of changes ?? []) {
      if (!c.changed_by) continue;
      const key = `${c.lead_id}|${c.changed_by}`;
      const arr = spokenLookup.get(key) ?? [];
      arr.push(c.changed_at);
      spokenLookup.set(key, arr);
    }

    const enriched: Take[] = takes.map(t => {
      const lead = leadMap.get(t.lead_id);
      const key = `${t.lead_id}|${t.actor_id}`;
      const candidates = spokenLookup.get(key) ?? [];
      // First "contacted" change AFTER this take
      const spoken = candidates.find(ts => new Date(ts) >= new Date(t.created_at));
      const lockEnd = new Date(new Date(t.created_at).getTime() + LOCK_MINUTES * 60_000);
      let classification: Take['classification'];
      if (spoken) {
        classification = new Date(spoken) <= lockEnd ? 'green' : 'amber';
      } else {
        classification = 'red';
      }
      return {
        lead_id: t.lead_id,
        actor_id: t.actor_id,
        taken_at: t.created_at,
        lead_name: lead ? [lead.first_name, lead.last_name].filter(Boolean).join(' ') || null : null,
        lead_phone: lead?.phone ?? null,
        vehicle_reg: lead?.vehicle_reg ?? null,
        lead_source: lead?.lead_source ?? null,
        spoken_at: spoken ?? null,
        classification,
      };
    });

    setRows(enriched);
    setLoading(false);
  }, [win]);

  useEffect(() => { load(); }, [load]);

  // Per-agent summary + streak flag
  const summary: AgentSummary[] = useMemo(() => {
    const byAgent = new Map<string, Take[]>();
    for (const r of rows) {
      const arr = byAgent.get(r.actor_id) ?? [];
      arr.push(r);
      byAgent.set(r.actor_id, arr);
    }
    const out: AgentSummary[] = [];
    for (const [agent_id, takes] of byAgent.entries()) {
      // takes are already DESC (most recent first)
      let green = 0, amber = 0, red = 0;
      for (const t of takes) {
        if (t.classification === 'green') green++;
        else if (t.classification === 'amber') amber++;
        else red++;
      }
      // Streak: 3+ most-recent consecutive with NO spoken (red)
      let streak = 0;
      for (const t of takes) {
        if (!t.spoken_at) streak++;
        else break;
      }
      out.push({
        agent_id,
        taken: takes.length,
        green, amber, red,
        streakRed: streak >= 3,
      });
    }
    return out.sort((a, b) => b.taken - a.taken);
  }, [rows]);

  const agentName = (id: string) => {
    const a = adminMap.get(id);
    if (!a) return 'Unknown agent';
    return [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || 'Agent';
  };

  const takesFor = (id: string) => rows.filter(r => r.actor_id === id);

  const totals = useMemo(() => {
    return {
      taken: rows.length,
      green: rows.filter(r => r.classification === 'green').length,
      amber: rows.filter(r => r.classification === 'amber').length,
      red: rows.filter(r => r.classification === 'red').length,
    };
  }, [rows]);

  return (
    <Card className="border-2 border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Open Pool — Agent Activity Monitor
            <Badge variant="outline" className="text-[10px]">Managers only</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-input overflow-hidden">
              {(Object.keys(WINDOWS) as WindowKey[]).map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setWin(k)}
                  className={`px-3 h-8 text-xs font-medium transition-colors ${
                    win === k
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  {WINDOWS[k].label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Every time an agent clicks <strong>Take Next Lead</strong> they get a 7-minute lock.
          This monitor cross-checks whether they actually marked the lead as <strong>Spoken to</strong>
          — the amber and red rows are where you should spot-check call recordings.
        </p>
      </CardHeader>
      <CardContent>
        {/* Totals strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <StatTile label="Leads taken" value={totals.taken} tone="neutral" />
          <StatTile label="Spoken (in lock)" value={totals.green} tone="green" />
          <StatTile label="Spoken (late)" value={totals.amber} tone="amber" />
          <StatTile label="No contact logged" value={totals.red} tone="red" />
        </div>

        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No pool takes in this window.
          </p>
        )}

        {rows.length > 0 && (
          <div className="space-y-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                    <th className="py-2 pr-3">Agent</th>
                    <th className="py-2 pr-3 text-right">Taken</th>
                    <th className="py-2 pr-3 text-right">Spoken in lock</th>
                    <th className="py-2 pr-3 text-right">Spoken late</th>
                    <th className="py-2 pr-3 text-right">No contact</th>
                    <th className="py-2 pr-3">Flags</th>
                    <th className="py-2 pr-3 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map(s => {
                    const isOpen = !!expanded[s.agent_id];
                    return (
                      <>
                        <tr
                          key={s.agent_id}
                          className={`border-b last:border-0 cursor-pointer hover:bg-muted/40 ${
                            s.streakRed ? 'bg-red-50/50' : ''
                          }`}
                          onClick={() => setExpanded(e => ({ ...e, [s.agent_id]: !e[s.agent_id] }))}
                        >
                          <td className="py-2 pr-3 font-medium">{agentName(s.agent_id)}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{s.taken}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-green-700">{s.green}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-amber-700">{s.amber}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-red-700">{s.red}</td>
                          <td className="py-2 pr-3">
                            {s.streakRed && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium bg-red-100 text-red-900 border-red-300">
                                <AlertTriangle className="h-3 w-3" />
                                3+ in a row with no contact
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground">
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={`${s.agent_id}-detail`} className="bg-muted/20">
                            <td colSpan={7} className="p-3">
                              <TakeDetail takes={takesFor(s.agent_id)} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'green' | 'amber' | 'red' }) {
  const toneClass = {
    neutral: 'bg-muted/50 text-foreground',
    green:   'bg-green-50 text-green-900 border-green-200',
    amber:   'bg-amber-50 text-amber-900 border-amber-200',
    red:     'bg-red-50 text-red-900 border-red-200',
  }[tone];
  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <div className="text-[11px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function TakeDetail({ takes }: { takes: Take[] }) {
  const badge = (c: Take['classification']) => {
    const map = {
      green: { text: 'Spoken in lock',  cls: 'bg-green-100 text-green-900 border-green-300' },
      amber: { text: 'Spoken late',     cls: 'bg-amber-100 text-amber-900 border-amber-300' },
      red:   { text: 'No contact',      cls: 'bg-red-100 text-red-900 border-red-300' },
    }[c];
    return (
      <span className={`inline-block px-2 py-0.5 rounded border text-[11px] font-medium ${map.cls}`}>
        {map.text}
      </span>
    );
  };
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left uppercase text-muted-foreground">
          <th className="py-1 pr-3">Taken</th>
          <th className="py-1 pr-3">Status</th>
          <th className="py-1 pr-3">Lead</th>
          <th className="py-1 pr-3">Reg</th>
          <th className="py-1 pr-3">Source</th>
          <th className="py-1 pr-3">Spoken at</th>
        </tr>
      </thead>
      <tbody>
        {takes.map((t, i) => (
          <tr key={`${t.lead_id}-${t.taken_at}-${i}`} className="border-t border-border/60">
            <td className="py-1 pr-3 text-muted-foreground">
              {formatDistanceToNowStrict(new Date(t.taken_at), { addSuffix: true })}
            </td>
            <td className="py-1 pr-3">{badge(t.classification)}</td>
            <td className="py-1 pr-3">
              <div className="font-medium">{t.lead_name || '—'}</div>
              {t.lead_phone && <div className="text-muted-foreground">{t.lead_phone}</div>}
            </td>
            <td className="py-1 pr-3 uppercase">{t.vehicle_reg || '—'}</td>
            <td className="py-1 pr-3 uppercase text-muted-foreground">{t.lead_source || '—'}</td>
            <td className="py-1 pr-3 text-muted-foreground">
              {t.spoken_at
                ? formatDistanceToNowStrict(new Date(t.spoken_at), { addSuffix: true })
                : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
