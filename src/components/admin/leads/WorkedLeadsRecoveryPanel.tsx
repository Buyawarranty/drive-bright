import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { History, Loader2, Search, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

type Agent = { id: string; name: string; email: string | null };

type WorkedLead = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  vehicle_reg: string | null;
  status: string | null;
  created_at: string;
  last_contacted_at: string | null;
  assigned_to: string | null;
};

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
] as const;

type PeriodKey = typeof PERIODS[number]['key'];

function periodRange(period: PeriodKey): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  if (period === 'today') {
    from.setHours(0, 0, 0, 0);
  } else if (period === 'yesterday') {
    from.setDate(from.getDate() - 1);
    from.setHours(0, 0, 0, 0);
    to.setDate(to.getDate() - 1);
    to.setHours(23, 59, 59, 999);
  } else if (period === '7d') {
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
  } else {
    from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);
  }
  return { from, to };
}

/**
 * Recover leads — manager view.
 *
 * Answers "where did the leads my agent worked today go?". New Leads filters on
 * the date a lead was *created*, so recontact and renewal work done today on
 * older leads is invisible under "Today". This panel lists every lead an agent
 * actually contacted inside the chosen window, and flags any that now sit with
 * a different agent so a reassignment is never mistaken for lost work.
 */
export const WorkedLeadsRecoveryPanel: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState<string>('');
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [rows, setRows] = useState<WorkedLead[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role, is_active')
        .in('role', ['sales', 'sales_lead', 'sales_manager'])
        .order('first_name');
      if (cancelled) return;
      type AgentRow = {
        id: string; first_name: string | null; last_name: string | null;
        email: string | null; is_active?: boolean | null;
      };
      const list = ((data ?? []) as unknown as AgentRow[])
        .filter(a => a.is_active !== false)
        .map(a => ({
          id: a.id,
          name: [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || 'Unnamed agent',
          email: a.email,
        }));
      setAgents(list);
    })();
    return () => { cancelled = true; };
  }, []);

  const agentName = useCallback(
    (id: string | null) => (id ? agents.find(a => a.id === id)?.name ?? 'Another agent' : 'Unassigned'),
    [agents],
  );

  const runScan = useCallback(async () => {
    if (!agentId) {
      toast.error('Pick an agent first');
      return;
    }
    setLoading(true);
    try {
      const { from, to } = periodRange(period);
      // Who contacted a lead lives in the call log, not on the lead row — so find
      // the agent's calls in the window first, then load those leads.
      const { data: calls, error: callErr } = await supabase
        .from('lead_call_logs')
        .select('lead_id, created_at')
        .eq('agent_id', agentId)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .order('created_at', { ascending: false })
        .limit(2000);
      if (callErr) throw callErr;

      const ids = Array.from(new Set((calls ?? []).map(c => c.lead_id).filter(Boolean))) as string[];
      if (ids.length === 0) {
        setRows([]);
        return;
      }

      const { data, error } = await supabase
        .from('sales_leads')
        .select('id, first_name, last_name, email, phone, vehicle_reg, status, created_at, last_contacted_at, assigned_to')
        .in('id', ids)
        .limit(1000);
      if (error) throw error;

      const order = new Map(ids.map((id, i) => [id, i]));
      const sorted = ((data ?? []) as unknown as WorkedLead[])
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      setRows(sorted);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error(`Could not load worked leads: ${message}`);
      setRows([]);
    } finally {
      setLoading(false);
    }

  }, [agentId, period]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      [r.first_name, r.last_name, r.email, r.phone, r.vehicle_reg]
        .some(v => (v ?? '').toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const stillOwned = filtered.filter(r => r.assigned_to === agentId).length;
  const movedOn = filtered.length - stillOwned;

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-2">
          <History className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">Recover leads</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              New Leads filters on the day a lead came in, so recontact and renewal calls made today on
              older leads don&apos;t appear under &ldquo;Today&rdquo;. Pick an agent and a period to see every
              lead they actually contacted. Leads since moved to another agent are flagged, so a
              reassignment is never mistaken for missing work.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <label className="text-xs font-medium text-muted-foreground">Agent</label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="h-9 mt-1">
                <SelectValue placeholder="Choose an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[160px]">
            <label className="text-xs font-medium text-muted-foreground">Period</label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="h-9 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map(p => (
                  <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={runScan} disabled={loading || !agentId} className="h-9">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Find worked leads
          </Button>

          {rows && rows.length > 0 && (
            <div className="min-w-[200px] flex-1">
              <label className="text-xs font-medium text-muted-foreground">Search results</label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, phone, email or reg"
                className="h-9 mt-1"
              />
            </div>
          )}
        </div>

        {rows && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary">{filtered.length} contacted in period</Badge>
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{stillOwned} still theirs</Badge>
              {movedOn > 0 && (
                <Badge className="bg-amber-500 text-white hover:bg-amber-500">{movedOn} now with another agent</Badge>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground border border-dashed border-border rounded-md p-4">
                No leads were contacted by this agent in the selected period.
              </div>
            ) : (
              <div className="overflow-x-auto border border-border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-medium">Customer</th>
                      <th className="px-3 py-2 font-medium">Reg</th>
                      <th className="px-3 py-2 font-medium">Phone</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Lead came in</th>
                      <th className="px-3 py-2 font-medium">Contacted</th>
                      <th className="px-3 py-2 font-medium">Owner now</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => {
                      const moved = r.assigned_to !== agentId;
                      return (
                        <tr key={r.id} className="border-t border-border">
                          <td className="px-3 py-2">
                            <div className="font-medium text-foreground">
                              {[r.first_name, r.last_name].filter(Boolean).join(' ') || 'No name'}
                            </div>
                            <div className="text-xs text-muted-foreground">{r.email || '—'}</div>
                          </td>
                          <td className="px-3 py-2 uppercase">{r.vehicle_reg || '—'}</td>
                          <td className="px-3 py-2">
                            {r.phone ? (
                              <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                                <Phone className="h-3 w-3" />{r.phone}
                              </a>
                            ) : '—'}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-xs">{r.status || 'new'}</Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {format(new Date(r.created_at), 'd MMM yyyy')}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {r.last_contacted_at ? format(new Date(r.last_contacted_at), 'd MMM HH:mm') : '—'}
                          </td>
                          <td className="px-3 py-2">
                            {moved ? (
                              <Badge className="bg-amber-500 text-white hover:bg-amber-500 text-xs">
                                {agentName(r.assigned_to)}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Unchanged</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkedLeadsRecoveryPanel;
