import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Target, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { AgentScore } from '@/hooks/useScoreboardData';

interface Props {
  agents: AgentScore[];
  onTargetSaved: () => void;
}

export const ScoreboardTargetManager: React.FC<Props> = ({ agents, onTargetSaved }) => {
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [existingTargets, setExistingTargets] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  useEffect(() => {
    const fetchTargets = async () => {
      const agentIds = agents.map(a => a.id);
      if (!agentIds.length) return;

      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from('sales_targets')
        .select('id, admin_user_id, target_amount, start_date, end_date')
        .in('admin_user_id', agentIds)
        .eq('target_period', 'monthly')
        .lte('start_date', nowIso)
        .gte('end_date', nowIso);

      const tMap: Record<string, number> = {};
      const eMap: Record<string, string> = {};
      (data || []).forEach(t => {
        tMap[t.admin_user_id] = t.target_amount;
        eMap[t.admin_user_id] = t.id;
      });
      setTargets(tMap);
      setExistingTargets(eMap);
    };
    fetchTargets();
  }, [agents]);

  const handleSave = async (agentId: string) => {
    const target = targets[agentId];
    if (target === undefined || target < 0) {
      toast.error('Please enter a valid target');
      return;
    }

    setSavingId(agentId);
    try {
      const existingId = existingTargets[agentId];
      if (existingId) {
        const { data, error } = await supabase
          .from('sales_targets')
          .update({ target_amount: target, updated_at: new Date().toISOString() })
          .eq('id', existingId)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No permission to update this target');
      } else {
        const { data, error } = await supabase
          .from('sales_targets')
          .insert({
            admin_user_id: agentId,
            target_amount: target,
            target_period: 'monthly',
            start_date: monthStart.toISOString(),
            end_date: monthEnd.toISOString(),
          })
          .select('id')
          .single();
        if (error) throw error;
        if (data?.id) setExistingTargets(prev => ({ ...prev, [agentId]: data.id }));
      }

      toast.success('Target saved');
      onTargetSaved();
    } catch (error: any) {
      console.error('Error saving target:', error);
      toast.error(error?.message || 'Failed to save target');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-primary" />
          Monthly targets — {format(monthStart, 'MMMM yyyy')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Set each agent's deals target for the month. Progress shows in the Target column of the leaderboard.
        </p>
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
                  {agent.salesCount} deals so far
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  className="w-20 text-center"
                  value={targets[agent.id] ?? ''}
                  onChange={e => setTargets(prev => ({ ...prev, [agent.id]: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                />
                <span className="text-sm text-muted-foreground">deals</span>
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
