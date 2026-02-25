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

interface TargetEntry {
  agentId: string;
  target: number;
  existing: boolean;
}

export const ScoreboardTargetManager: React.FC<Props> = ({ agents, onTargetSaved }) => {
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [existingTargets, setExistingTargets] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  useEffect(() => {
    const fetchTargets = async () => {
      const agentIds = agents.map(a => a.id);
      if (!agentIds.length) return;

      const { data } = await supabase
        .from('sales_targets')
        .select('id, admin_user_id, target_amount')
        .in('admin_user_id', agentIds)
        .eq('target_period', 'monthly')
        .gte('start_date', monthStart.toISOString().split('T')[0])
        .lte('start_date', monthEnd.toISOString().split('T')[0]);

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

    setSaving(true);
    try {
      const existingId = existingTargets[agentId];
      if (existingId) {
        const { error } = await supabase
          .from('sales_targets')
          .update({ target_amount: target })
          .eq('id', existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sales_targets')
          .insert({
            admin_user_id: agentId,
            target_amount: target,
            target_period: 'monthly',
            start_date: monthStart.toISOString().split('T')[0],
            end_date: monthEnd.toISOString().split('T')[0],
          });
        if (error) throw error;
      }

      toast.success('Target saved');
      onTargetSaved();
    } catch (error) {
      console.error('Error saving target:', error);
      toast.error('Failed to save target');
    } finally {
      setSaving(false);
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
          Set the number of deals each agent should achieve this month
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {agents.map(agent => (
            <div key={agent.id} className="flex items-center gap-4 p-3 rounded-lg border bg-muted/30">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{agent.name}</p>
                <p className="text-xs text-muted-foreground truncate">{agent.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Current: {agent.salesCount} deals · £{agent.revenue.toLocaleString()}
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
                  variant="outline"
                  onClick={() => handleSave(agent.id)}
                  disabled={saving}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {agents.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              No sales agents found
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
