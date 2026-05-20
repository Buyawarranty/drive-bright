import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Target, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { AgentScore } from '@/hooks/useScoreboardData';

interface Props {
  agents: AgentScore[];
  onTargetSaved: () => void;
}

interface LeadsEntry {
  days: number;
  perDay: number;
}

export const ScoreboardTargetManager: React.FC<Props> = ({ agents, onTargetSaved }) => {
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [leadsInputs, setLeadsInputs] = useState<Record<string, LeadsEntry>>({});
  const [existingTargets, setExistingTargets] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  useEffect(() => {
    const fetchTargets = async () => {
      const agentIds = agents.map(a => a.id);
      if (!agentIds.length) return;

      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from('sales_targets')
        .select('id, admin_user_id, target_amount, manual_leads_count, start_date, end_date')
        .in('admin_user_id', agentIds)
        .eq('target_period', 'monthly')
        .lte('start_date', nowIso)
        .gte('end_date', nowIso);

      const tMap: Record<string, number> = {};
      const eMap: Record<string, string> = {};
      const lMap: Record<string, LeadsEntry> = {};
      (data || []).forEach(t => {
        tMap[t.admin_user_id] = t.target_amount;
        eMap[t.admin_user_id] = t.id;
        if (t.manual_leads_count != null) {
          // Default to representing the saved total as days=total, perDay=1 so it's editable as a total
          lMap[t.admin_user_id] = { days: t.manual_leads_count, perDay: 1 };
        }
      });
      setTargets(tMap);
      setExistingTargets(eMap);
      setLeadsInputs(lMap);
    };
    fetchTargets();
  }, [agents]);

  const computeLeads = (agentId: string) => {
    const entry = leadsInputs[agentId];
    if (!entry) return 0;
    return Math.max(0, Math.round((entry.days || 0) * (entry.perDay || 0)));
  };

  const handleSave = async (agentId: string) => {
    const target = targets[agentId];
    if (target === undefined || target < 0) {
      toast.error('Please enter a valid target');
      return;
    }
    const manualLeads = computeLeads(agentId);

    setSaving(true);
    try {
      const existingId = existingTargets[agentId];
      if (existingId) {
        const { data, error } = await supabase
          .from('sales_targets')
          .update({
            target_amount: target,
            manual_leads_count: manualLeads || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingId)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('No permission to update this target');
        }
      } else {
        const { data, error } = await supabase
          .from('sales_targets')
          .insert({
            admin_user_id: agentId,
            target_amount: target,
            manual_leads_count: manualLeads || null,
            target_period: 'monthly',
            start_date: monthStart.toISOString(),
            end_date: monthEnd.toISOString(),
          })
          .select('id')
          .single();
        if (error) throw error;
        if (data?.id) {
          setExistingTargets(prev => ({ ...prev, [agentId]: data.id }));
        }
      }

      toast.success('Target saved');
      onTargetSaved();
    } catch (error: any) {
      console.error('Error saving target:', error);
      toast.error(error?.message || 'Failed to save target');
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
          Set the deals target and the manual monthly leads count (days worked × leads per day) for each agent.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {agents.map(agent => {
            const entry = leadsInputs[agent.id] || { days: 0, perDay: 0 };
            const totalLeads = computeLeads(agent.id);
            return (
              <div key={agent.id} className="p-3 rounded-lg border bg-muted/30 space-y-3">
                <div className="flex items-center justify-between gap-4">
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
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end pt-2 border-t">
                  <div>
                    <Label className="text-xs">Days worked</Label>
                    <Input
                      type="number"
                      min={0}
                      value={entry.days || ''}
                      onChange={e =>
                        setLeadsInputs(prev => ({
                          ...prev,
                          [agent.id]: { ...entry, days: parseInt(e.target.value) || 0 },
                        }))
                      }
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Leads / day</Label>
                    <Input
                      type="number"
                      min={0}
                      value={entry.perDay || ''}
                      onChange={e =>
                        setLeadsInputs(prev => ({
                          ...prev,
                          [agent.id]: { ...entry, perDay: parseInt(e.target.value) || 0 },
                        }))
                      }
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Total leads (month)</Label>
                    <div className="h-10 flex items-center px-3 rounded-md border bg-background font-medium">
                      {totalLeads}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSave(agent.id)}
                    disabled={saving}
                    className="w-full"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>
            );
          })}

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
