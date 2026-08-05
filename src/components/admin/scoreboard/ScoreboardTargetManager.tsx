import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Target, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { AgentScore } from '@/hooks/useScoreboardData';

const DEFAULT_REVENUE_TARGET = 35000;

interface Props {
  agents: AgentScore[];
  onTargetSaved: () => void;
}

export const ScoreboardTargetManager: React.FC<Props> = ({ agents, onTargetSaved }) => {
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [existingIds, setExistingIds] = useState<Record<string, string>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  const fetchTargets = React.useCallback(async () => {
      const agentIds = agents.map(a => a.id);
      if (!agentIds.length) return;

      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('sales_targets')
        .select('id, admin_user_id, revenue_target, target_amount, start_date, end_date')
        .in('admin_user_id', agentIds)
        .eq('target_period', 'monthly')
        .lte('start_date', nowIso)
        .gte('end_date', nowIso);

      const tMap: Record<string, number> = {};
      const eMap: Record<string, string> = {};
      (data || []).forEach(t => {
        // Prefer revenue_target; fall back to target_amount only if revenue_target is unset.
        const amt = t.revenue_target != null ? Number(t.revenue_target) : (t.target_amount != null ? Number(t.target_amount) : DEFAULT_REVENUE_TARGET);
        tMap[t.admin_user_id] = amt || DEFAULT_REVENUE_TARGET;
        eMap[t.admin_user_id] = t.id;
      });
      // Default any agent without a row to £35,000.
      agents.forEach(a => {
        if (tMap[a.id] === undefined) tMap[a.id] = DEFAULT_REVENUE_TARGET;
      });
      if (error) {
        console.error('Error loading revenue targets:', error);
        toast.error('Could not load targets — you may not have permission');
      }
      setTargets(tMap);
      setExistingIds(eMap);
  }, [agents]);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);

  const persist = async (agentId: string, amount: number): Promise<boolean> => {
    const existingId = existingIds[agentId];
    if (existingId) {
      const { data, error } = await supabase
        .from('sales_targets')
        .update({ revenue_target: amount, target_amount: amount, updated_at: new Date().toISOString() })
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
          target_amount: amount,
          target_period: 'monthly',
          start_date: monthStart.toISOString(),
          end_date: monthEnd.toISOString(),
        })
        .select('id')
        .single();
      if (error) throw error;
      if (data?.id) setExistingIds(prev => ({ ...prev, [agentId]: data.id }));
    }
    return true;
  };

  const handleSave = async (agentId: string) => {
    const amount = targets[agentId];
    if (amount === undefined || amount < 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    setSavingId(agentId);
    try {
      await persist(agentId, amount);
      toast.success('Revenue target saved');
      await fetchTargets();
      onTargetSaved();
    } catch (error: any) {
      console.error('Error saving revenue target:', error);
      toast.error(error?.message || 'Failed to save');
    } finally {
      setSavingId(null);
    }
  };

  const setAllToDefault = () => {
    setTargets(prev => {
      const next = { ...prev };
      agents.forEach(a => { next[a.id] = DEFAULT_REVENUE_TARGET; });
      return next;
    });
  };

  const handleSaveAll = async () => {
    setSavingAll(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const a of agents) {
        const amount = targets[a.id];
        if (amount === undefined || amount < 0) { fail++; continue; }
        try {
          await persist(a.id, amount);
          ok++;
        } catch {
          fail++;
        }
      }
      if (ok) toast.success(`${ok} target${ok === 1 ? '' : 's'} saved`);
      if (fail) toast.error(`${fail} failed to save`);
      await fetchTargets();
      onTargetSaved();
    } finally {
      setSavingAll(false);
    }
  };

  const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-primary" />
          Monthly revenue targets — {format(monthStart, 'MMMM yyyy')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Set each agent's revenue target (£) for the month. Default is £35,000. Progress shows in the Target column of the leaderboard.
        </p>
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" onClick={setAllToDefault}>
            Set everyone to £35,000
          </Button>
          <Button size="sm" onClick={handleSaveAll} disabled={savingAll}>
            {savingAll ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save all
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {agents.map(agent => (
            <div
              key={agent.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{agent.name}</p>
                <p className="text-xs text-muted-foreground">
                  {gbp(agent.revenue)} revenue so far · {agent.salesCount} sales
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">£</span>
                <Input
                  type="number"
                  min={0}
                  step={500}
                  className="w-28 text-center"
                  value={targets[agent.id] ?? ''}
                  onChange={e => setTargets(prev => ({ ...prev, [agent.id]: parseInt(e.target.value) || 0 }))}
                  placeholder="35000"
                />
                <Button
                  size="sm"
                  onClick={() => handleSave(agent.id)}
                  disabled={savingId === agent.id}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
