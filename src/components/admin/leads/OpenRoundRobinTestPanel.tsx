import React, { useCallback, useEffect, useState } from 'react';
import { FlaskConical, Plus, FastForward, Play, Trash2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const TEAM_BLUE_ID = '14f567b3-4ba3-4baa-acef-8d0de8e24b2d';
const TEST_SOURCE = 'ORR_TEST';

interface TestLead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  status: string | null;
  assigned_to: string | null;
  orr_first_call_deadline: string | null;
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
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('sales_leads')
      .select('id, first_name, last_name, status, assigned_to, orr_first_call_deadline, created_at')
      .eq('lead_source', TEST_SOURCE)
      .order('created_at', { ascending: false })
      .limit(50);
    setLeads((data as TestLead[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
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
        team_id: TEAM_BLUE_ID,
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
      const { error } = await supabase.from('sales_leads').delete().eq('lead_source', TEST_SOURCE);
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
    <section className="rounded-lg border border-amber-300 bg-amber-50/50 shadow-sm">
      <div className="px-5 py-4 border-b border-amber-200 flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-2">
          <FlaskConical className="h-4 w-4 text-amber-700 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Test Open Round Robin — Team Blue
              <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-800">Managers only</Badge>
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

      <div className="px-5 py-3 text-xs text-amber-900 bg-amber-100/60 border-b border-amber-200">
        <strong>How to test:</strong> 1) Click <em>Create test lead</em> — it flows through the real
        distribution engine and gets assigned to the next Team Blue agent with a 2-min deadline.
        2) Click <em>Expire window</em> on the row to fast-forward past the 2 minutes.
        3) Click <em>Run sweep</em> to force the reclaim job. Watch <em>assigned_to</em> change.
        4) Repeat, then <em>Delete all test leads</em> when finished.
      </div>

      <div className="px-5 py-3">
        {leads.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No test leads yet. Click <strong>Create test lead</strong> to start.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b">
                  <th className="py-2 pr-3">Test lead</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Assigned to</th>
                  <th className="py-2 pr-3">2-min deadline</th>
                  <th className="py-2 pr-3">Age</th>
                  <th className="py-2 pr-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => {
                  const deadline = l.orr_first_call_deadline ? new Date(l.orr_first_call_deadline) : null;
                  const now = Date.now();
                  const remaining = deadline ? Math.round((deadline.getTime() - now) / 1000) : null;
                  const expired = remaining !== null && remaining <= 0;
                  const ageSec = Math.round((now - new Date(l.created_at).getTime()) / 1000);
                  return (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{l.first_name} {l.last_name}</td>
                      <td className="py-2 pr-3"><Badge variant="outline">{l.status ?? '—'}</Badge></td>
                      <td className="py-2 pr-3 text-xs font-mono">
                        {l.assigned_to ? l.assigned_to.slice(0, 8) : <span className="text-muted-foreground">unassigned</span>}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {remaining === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : expired ? (
                          <span className="text-rose-700 font-semibold">expired</span>
                        ) : (
                          <span className="text-blue-700">{remaining}s left</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{ageSec}s</td>
                      <td className="py-2 pr-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => fastForward(l.id)}
                          disabled={busy === l.id || expired}
                        >
                          <FastForward className="h-3.5 w-3.5 mr-1.5" /> Expire window
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default OpenRoundRobinTestPanel;
