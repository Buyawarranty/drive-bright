import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Target, Save, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import type { AdminUser } from '@/hooks/useLeads';

interface SetTargetsPanelProps {
  salesUsers: AdminUser[];
  currentUserId: string | null;
}

interface DailyTarget {
  id: string;
  agent_id: string;
  target_date: string;
  target_leads: number;
  target_sales: number;
  actual_leads: number;
  actual_sales: number;
  notes: string | null;
}

export const SetTargetsPanel: React.FC<SetTargetsPanelProps> = ({ salesUsers, currentUserId }) => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [targets, setTargets] = useState<Record<string, { target_leads: number; target_sales: number; notes: string }>>({});
  const [existingTargets, setExistingTargets] = useState<DailyTarget[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const agents = salesUsers.filter(u => u.role !== 'admin' && u.role !== 'super_admin');

  useEffect(() => {
    fetchTargets();
  }, [selectedDate]);

  const fetchTargets = async () => {
    const { data, error } = await supabase
      .from('agent_daily_targets')
      .select('*')
      .eq('target_date', selectedDate);
    
    if (data) {
      setExistingTargets(data);
      const targetMap: Record<string, { target_leads: number; target_sales: number; notes: string }> = {};
      data.forEach(t => {
        targetMap[t.agent_id] = {
          target_leads: t.target_leads,
          target_sales: t.target_sales,
          notes: t.notes || '',
        };
      });
      setTargets(targetMap);
    }
  };

  const updateTarget = (agentId: string, field: string, value: number | string) => {
    setTargets(prev => ({
      ...prev,
      [agentId]: {
        target_leads: prev[agentId]?.target_leads || 0,
        target_sales: prev[agentId]?.target_sales || 0,
        notes: prev[agentId]?.notes || '',
        [field]: value,
      },
    }));
  };

  const saveTargets = async () => {
    if (!currentUserId) return;
    setSaving(true);

    try {
      for (const agent of agents) {
        const target = targets[agent.id];
        if (!target) continue;

        const existing = existingTargets.find(t => t.agent_id === agent.id);

        if (existing) {
          await supabase
            .from('agent_daily_targets')
            .update({
              target_leads: target.target_leads,
              target_sales: target.target_sales,
              notes: target.notes || null,
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('agent_daily_targets')
            .insert({
              agent_id: agent.id,
              set_by: currentUserId,
              target_date: selectedDate,
              target_leads: target.target_leads,
              target_sales: target.target_sales,
              notes: target.notes || null,
            });
        }
      }

      toast({ title: 'Targets saved', description: `Daily targets for ${format(new Date(selectedDate), 'dd MMM yyyy')} saved.` });
      fetchTargets();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Set Daily Targets
        </CardTitle>
        <CardDescription>Set lead and sales targets for each agent per day</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Picker */}
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-48"
          />
        </div>

        {/* Agent Targets */}
        <div className="space-y-4">
          {agents.map(agent => {
            const target = targets[agent.id];
            const existing = existingTargets.find(t => t.agent_id === agent.id);

            return (
              <div key={agent.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{agent.first_name} {agent.last_name}</p>
                    <p className="text-xs text-muted-foreground">{agent.email}</p>
                  </div>
                  {existing && (
                    <div className="flex gap-2">
                      <Badge variant="outline">
                        {existing.actual_leads}/{existing.target_leads} leads
                      </Badge>
                      <Badge variant="outline" className="bg-green-50">
                        {existing.actual_sales}/{existing.target_sales} sales
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Lead Target</Label>
                    <Input
                      type="number"
                      min={0}
                      value={target?.target_leads || 0}
                      onChange={(e) => updateTarget(agent.id, 'target_leads', parseInt(e.target.value) || 0)}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Sales Target</Label>
                    <Input
                      type="number"
                      min={0}
                      value={target?.target_sales || 0}
                      onChange={(e) => updateTarget(agent.id, 'target_sales', parseInt(e.target.value) || 0)}
                      className="h-9"
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <Label className="text-xs">Notes</Label>
                    <Input
                      value={target?.notes || ''}
                      onChange={(e) => updateTarget(agent.id, 'notes', e.target.value)}
                      placeholder="Optional notes"
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Button onClick={saveTargets} disabled={saving} className="w-full">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save All Targets'}
        </Button>
      </CardContent>
    </Card>
  );
};
