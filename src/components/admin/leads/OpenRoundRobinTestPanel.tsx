import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlaskConical, Plus, FastForward, Play, Trash2, RefreshCw, Clock, User, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const TEAM_BLUE_ID = '14f567b3-4ba3-4baa-acef-8d0de8e24b2d';
const TEST_SOURCE = 'other' as const;
const TEST_MARKER = 'TEST';

interface TestLead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  status: string | null;
  assigned_to: string | null;
  orr_first_call_deadline: string | null;
  orr_attempt_count?: number | null;
  vehicle_reg?: string | null;
  phone?: string | null;
  created_at: string;
}

/**
 * Open Round Robin — Test Mode.
 * Managers can spawn synthetic Team Blue leads (lead_source = ORR_TEST) to watch
 * the real 2-minute → reclaim → retry → dormant flow without touching real leads.
 * All test leads are tagged in notes with [ORR_TEST] and cleaned up in one click.
 */
export const OpenRoundRobinTestPanel: React.FC = () => {
  const { toast } = useToast();
  const [leads, setLeads] = useState<TestLead[]>([]);
  const [agentMap, setAgentMap] = useState<Record<string, { name: string; team?: string | null }>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('sales_leads')
      .select('id, first_name, last_name, status, assigned_to, orr_first_call_deadline, orr_attempt_count, vehicle_reg, phone, created_at')
      .eq('first_name', TEST_MARKER).eq('vehicle_reg', 'TEST123')
      .order('created_at', { ascending: false })
      .limit(50);
    const rows = (data as TestLead[]) || [];
    setLeads(rows);
    const ids = Array.from(new Set(rows.map(r => r.assigned_to).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: users } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email')
        .in('id', ids);
      const map: Record<string, { name: string }> = {};
      (users || []).forEach((u: any) => {
        map[u.id] = { name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || u.id.slice(0, 8) };
      });
      setAgentMap(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 5_000);
    const clock = setInterval(() => setTick(t => t + 1), 1000);
    return () => { clearInterval(poll); clearInterval(clock); };
  }, [load]);

  const createTestLead = async () => {
    setBusy('create');
    try {
      const stamp = new Date().toISOString().slice(11, 19);
      const { error } = await supabase.from('sales_leads').insert({
        first_name: 'TEST',
        last_name: `Lead ${stamp}`,
        email: `orr-test-${Date.now()}@buyawarranty.test`,
        phone: '00000000000',
        vehicle_reg: 'TEST123',
        lead_source: TEST_SOURCE,
        status: 'new',
        // team affiliation is per-agent (via lead_team_members) — sales_leads has no team_id column
        notes: '[ORR_TEST] Synthetic lead — do not contact. Managers use this to test the Open Round Robin flow.',
      } as any);
      if (error) throw error;
      toast({ title: 'Test lead created', description: 'Watch the distribution + 2-min window fire.' });
      load();
    } catch (e: any) {
      toast({ title: 'Create failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const fastForward = async (id: string) => {
    setBusy(id);
    try {
      const pastIso = new Date(Date.now() - 60_000).toISOString();
      const { error } = await supabase
        .from('sales_leads')
        .update({ orr_first_call_deadline: pastIso } as any)
        .eq('id', id);
      if (error) throw error;
      toast({ title: 'Window expired', description: 'Run sweep to trigger reassignment.' });
      load();
    } catch (e: any) {
      toast({ title: 'Fast-forward failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const runSweep = async () => {
    setBusy('sweep');
    try {
      const { data, error } = await supabase.rpc('sweep_open_round_robin' as any);
      if (error) throw error;
      const d = (data ?? {}) as { reclaimed?: number; dormant?: number };
      toast({ title: 'Sweep complete', description: `Reclaimed ${d.reclaimed ?? 0} · Dormant ${d.dormant ?? 0}` });
      load();
    } catch (e: any) {
      toast({ title: 'Sweep failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const cleanup = async () => {
    if (!confirm('Delete ALL test leads (lead_source = ORR_TEST)?')) return;
    setBusy('cleanup');
    try {
      const { error } = await supabase.from('sales_leads').delete().eq('first_name', TEST_MARKER).eq('vehicle_reg', 'TEST123');
      if (error) throw error;
      toast({ title: 'Test leads deleted' });
      load();
    } catch (e: any) {
      toast({ title: 'Cleanup failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

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
              ORR test lab — Team Blue
              <Badge variant="outline" className="text-[10px] border-rose-400 text-rose-800">Managers only</Badge>
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Spawn a synthetic Team Blue lead to watch the real 2-min window, retry, and dormant
              logic. Test leads are marked <code>lead_source = ORR_TEST</code> with a <code>[ORR_TEST]</code>
              note so agents know not to call them. Clean up in one click when done.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" onClick={createTestLead} disabled={busy === 'create'}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Create test lead
          </Button>
          <Button size="sm" variant="secondary" onClick={runSweep} disabled={busy === 'sweep'}>
            <Play className="h-3.5 w-3.5 mr-1.5" /> Run sweep
          </Button>
          <Button size="sm" variant="destructive" onClick={cleanup} disabled={busy === 'cleanup' || leads.length === 0}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete all test leads
          </Button>
        </div>
      </div>

      <div className="px-5 py-3 text-xs text-rose-900 bg-rose-100/70 border-b border-rose-300">
        <strong>Where to watch these leads flow:</strong> once created, the synthetic lead appears in{' '}
        <em>Queue &amp; Capacity Dashboard</em> above, in the <em>New Leads</em> tab (filter Team = Blue or search
        "TEST123"), and fires the assigned agent's <em>new lead pop-up + beep</em>. Steps: 1) <em>Create test lead</em>{' '}
        — real distribution engine assigns to next Blue agent with a 2-min deadline. 2) <em>Expire window</em> to
        fast-forward. 3) <em>Run sweep</em> to trigger reclaim — watch <em>assigned_to</em> change. 4){' '}
        <em>Delete all test leads</em> when finished.
      </div>

      {/* Live "Synthetic New Leads" lookalike — mirrors the New Leads page row layout */}
      <div className="px-5 py-4 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5">
              Live · Dry Run
            </span>
            <h4 className="text-sm font-semibold text-foreground">Synthetic New Leads — Team Blue</h4>
            <Badge variant="outline" className="text-[10px]">Look &amp; feel matches New Leads tab</Badge>
          </div>
          <span className="text-[11px] text-muted-foreground">Auto-refresh 5s · countdown 1s</span>
        </div>

        {leads.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center border border-dashed border-rose-300 rounded-md bg-rose-50/40">
            No test leads yet. Click <strong>Create test lead</strong> — a row will appear here in the same style as the New Leads page.
          </div>
        ) : (
          <ul className="space-y-2">
            {leads.map((l) => {
              const deadline = l.orr_first_call_deadline ? new Date(l.orr_first_call_deadline) : null;
              const now = Date.now();
              void tick; // re-render on tick
              const remainingMs = deadline ? deadline.getTime() - now : null;
              const remaining = remainingMs !== null ? Math.max(0, Math.round(remainingMs / 1000)) : null;
              const expired = remainingMs !== null && remainingMs <= 0;
              const ageSec = Math.round((now - new Date(l.created_at).getTime()) / 1000);
              const agent = l.assigned_to ? agentMap[l.assigned_to]?.name : null;
              const mm = remaining !== null ? Math.floor(remaining / 60) : 0;
              const ss = remaining !== null ? String(remaining % 60).padStart(2, '0') : '00';

              return (
                <li
                  key={l.id}
                  className={`rounded-md border p-3 flex flex-wrap items-center gap-3 bg-white ${
                    expired ? 'border-rose-400 bg-rose-50' : 'border-blue-200'
                  }`}
                >
                  {/* Left: identity, same order as New Leads row */}
                  <div className="flex items-center gap-2 min-w-[220px]">
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-600 text-white text-[10px] font-bold uppercase px-2 py-0.5">
                      Blue
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 text-white text-[10px] font-bold uppercase px-2 py-0.5">
                      TEST
                    </span>
                    <div className="text-sm font-semibold text-foreground">
                      {l.first_name} {l.last_name}
                    </div>
                  </div>

                  {/* Reg + phone (mirrors New Leads) */}
                  <div className="text-xs text-muted-foreground flex items-center gap-3 min-w-[200px]">
                    <span className="font-mono px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-900 border border-yellow-300">
                      {l.vehicle_reg ?? 'TEST123'}
                    </span>
                    <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone ?? '—'}</span>
                  </div>

                  {/* Assigned agent */}
                  <div className="text-xs flex items-center gap-1 min-w-[160px]">
                    <User className="h-3 w-3 text-muted-foreground" />
                    {agent ? (
                      <span className="font-medium text-foreground">{agent}</span>
                    ) : l.assigned_to ? (
                      <span className="font-mono">{l.assigned_to.slice(0, 8)}</span>
                    ) : (
                      <span className="text-muted-foreground">unassigned</span>
                    )}
                  </div>

                  {/* 2-min countdown pill — same style as production ORR badge */}
                  <div className="flex items-center gap-2">
                    {remaining === null ? (
                      <Badge variant="outline">no ORR window</Badge>
                    ) : expired ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-600 text-white text-xs font-semibold px-2 py-1">
                        <Clock className="h-3 w-3" /> Expired · sweep to reassign
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1 rounded-md text-xs font-semibold px-2 py-1 ${
                          remaining <= 30 ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-blue-100 text-blue-800 border border-blue-300'
                        }`}
                      >
                        <Clock className="h-3 w-3" /> {mm}:{ss} left
                      </span>
                    )}
                    <Badge variant="outline" className="text-[10px]">A{l.orr_attempt_count ?? 0}</Badge>
                    <Badge variant="outline" className="text-[10px]">{l.status ?? 'new'}</Badge>
                    <span className="text-[11px] text-muted-foreground">Age {ageSec}s</span>
                  </div>

                  {/* Right: action */}
                  <div className="ml-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fastForward(l.id)}
                      disabled={busy === l.id || expired}
                    >
                      <FastForward className="h-3.5 w-3.5 mr-1.5" /> Expire window
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-[11px] text-muted-foreground mt-3">
          This is a mirror of what the assigned Blue agent sees on the <em>New Leads</em> tab — same badges,
          same 2-minute countdown, same reassignment behaviour. Watch <em>Assigned to</em> change after{' '}
          <em>Run sweep</em>.
        </p>
      </div>
    </section>
  );
};

export default OpenRoundRobinTestPanel;
