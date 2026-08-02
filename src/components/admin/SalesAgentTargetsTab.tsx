import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Target, Save, RotateCcw, PoundSterling } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export const DEFAULT_MONTHLY_REVENUE_TARGET = 35000;

interface AgentRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

const nameOf = (a: AgentRow) =>
  `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email.split('@')[0];

const money = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

/**
 * Sales agent monthly targets.
 *
 * Managers set each agent's monthly revenue target here (default £35,000).
 * Each agent only ever sees their own target on the Sales Scoreboard.
 */
export const SalesAgentTargetsTab: React.FC = () => {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [existing, setExisting] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  const monthStart = useMemo(() => startOfMonth(new Date()), []);
  const monthEnd = useMemo(() => endOfMonth(new Date()), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: staff, error } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role, is_active')
        .in('role', ['sales', 'sales_lead', 'sales_manager'])
        .order('first_name', { ascending: true });
      if (error) throw error;

      const list = (staff || []).filter((s: any) => s.is_active !== false) as AgentRow[];
      setAgents(list);

      const nowIso = new Date().toISOString();
      const { data: targets } = await supabase
        .from('sales_targets')
        .select('id, admin_user_id, revenue_target')
        .in('admin_user_id', list.map(a => a.id))
        .eq('target_period', 'monthly')
        .lte('start_date', nowIso)
        .gte('end_date', nowIso);

      const vMap: Record<string, number> = {};
      const eMap: Record<string, string> = {};
      (targets || []).forEach((t: any) => {
        vMap[t.admin_user_id] = Number(t.revenue_target ?? DEFAULT_MONTHLY_REVENUE_TARGET);
        eMap[t.admin_user_id] = t.id;
      });
      // Anyone without a saved row starts on the default target.
      list.forEach(a => {
        if (vMap[a.id] === undefined) vMap[a.id] = DEFAULT_MONTHLY_REVENUE_TARGET;
      });
      setValues(vMap);
      setExisting(eMap);
    } catch (e: any) {
      console.error('Error loading targets', e);
      toast.error(e?.message || 'Could not load targets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveOne = async (agentId: string) => {
    const amount = values[agentId];
    if (amount === undefined || Number.isNaN(amount) || amount < 0) {
      toast.error('Enter a valid target');
      return false;
    }
    const existingId = existing[agentId];
    if (existingId) {
      const { data, error } = await supabase
        .from('sales_targets')
        .update({ revenue_target: amount, updated_at: new Date().toISOString() })
        .eq('id', existingId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('No permission to update this target');
    } else {
      const { data, error } = await supabase
        .from('sales_targets')
        .insert({
          admin_user_id: agentId,
          revenue_target: amount,
          target_amount: 0,
          target_period: 'monthly',
          start_date: monthStart.toISOString(),
          end_date: monthEnd.toISOString(),
        })
        .select('id')
        .single();
      if (error) throw error;
      if (data?.id) setExisting(prev => ({ ...prev, [agentId]: data.id }));
    }
    return true;
  };

  const handleSaveOne = async (agentId: string) => {
    setSavingId(agentId);
    try {
      if (await saveOne(agentId)) toast.success('Target saved');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save target');
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveAll = async () => {
    setSavingAll(true);
    let ok = 0;
    for (const a of agents) {
      try {
        if (await saveOne(a.id)) ok++;
      } catch (e: any) {
        console.error(e);
      }
    }
    setSavingAll(false);
    toast.success(`Saved ${ok} of ${agents.length} targets`);
  };

  const total = agents.reduce((s, a) => s + (values[a.id] || 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            Sales agent monthly targets — {format(monthStart, 'MMMM yyyy')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Set each agent's monthly revenue target. It shows on the Sales Scoreboard, where each agent
            only sees their own target and progress. New agents start on {money(DEFAULT_MONTHLY_REVENUE_TARGET)}.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setValues(Object.fromEntries(agents.map(a => [a.id, DEFAULT_MONTHLY_REVENUE_TARGET])))}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Set everyone to {money(DEFAULT_MONTHLY_REVENUE_TARGET)}
            </Button>
            <Button size="sm" onClick={handleSaveAll} disabled={savingAll || loading || agents.length === 0}>
              <Save className="h-4 w-4 mr-1" />
              {savingAll ? 'Saving…' : 'Save all targets'}
            </Button>
            <span className="text-sm text-muted-foreground ml-auto">
              Team total: <span className="font-semibold text-foreground">{money(total)}</span>
            </span>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading agents…</p>
          ) : agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active sales agents found.</p>
          ) : (
            <div className="space-y-2">
              {agents.map(a => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{nameOf(a)}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.email} · {a.role}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <PoundSterling className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="number"
                        min={0}
                        step={500}
                        className="w-32 pl-7 text-right"
                        value={values[a.id] ?? ''}
                        onChange={e =>
                          setValues(prev => ({ ...prev, [a.id]: parseInt(e.target.value, 10) || 0 }))
                        }
                        placeholder={String(DEFAULT_MONTHLY_REVENUE_TARGET)}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground hidden sm:inline">per month</span>
                    <Button size="sm" onClick={() => handleSaveOne(a.id)} disabled={savingId === a.id}>
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesAgentTargetsTab;
