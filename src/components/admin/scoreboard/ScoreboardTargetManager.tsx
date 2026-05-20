import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { AgentScore } from '@/hooks/useScoreboardData';

interface Props {
  agents: AgentScore[];
  onTargetSaved: () => void;
}

type WorkWeek = 'mon-fri' | 'mon-sat' | 'mon-sun';
type Mode = 'month' | 'weekly';

interface WeekEntry { days: number; perDay: number; }
interface LeadsEntry {
  mode: Mode;
  workWeek: WorkWeek;
  month: WeekEntry;
  weeks: [WeekEntry, WeekEntry, WeekEntry, WeekEntry];
}

const WORK_WEEK_DAYS: Record<WorkWeek, number> = {
  'mon-fri': 5,
  'mon-sat': 6,
  'mon-sun': 7,
};

const emptyWeek = (): WeekEntry => ({ days: 0, perDay: 0 });
const emptyEntry = (): LeadsEntry => ({
  mode: 'month',
  workWeek: 'mon-fri',
  month: emptyWeek(),
  weeks: [emptyWeek(), emptyWeek(), emptyWeek(), emptyWeek()],
});

const computeTotal = (entry: LeadsEntry): number => {
  if (entry.mode === 'month') {
    return Math.max(0, Math.round((entry.month.days || 0) * (entry.month.perDay || 0)));
  }
  return entry.weeks.reduce(
    (sum, w) => sum + Math.max(0, Math.round((w.days || 0) * (w.perDay || 0))),
    0
  );
};

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
        const e = emptyEntry();
        if (t.manual_leads_count != null) {
          // Show saved total as month-mode (days=total, perDay=1) so it remains editable.
          e.month = { days: t.manual_leads_count, perDay: 1 };
        }
        lMap[t.admin_user_id] = e;
      });
      setTargets(tMap);
      setExistingTargets(eMap);
      setLeadsInputs(lMap);
    };
    fetchTargets();
  }, [agents]);

  const getEntry = (agentId: string): LeadsEntry => leadsInputs[agentId] || emptyEntry();

  const updateEntry = (agentId: string, updater: (e: LeadsEntry) => LeadsEntry) => {
    setLeadsInputs(prev => ({ ...prev, [agentId]: updater(prev[agentId] || emptyEntry()) }));
  };

  const setMode = (agentId: string, mode: Mode) =>
    updateEntry(agentId, e => ({ ...e, mode }));

  const setWorkWeek = (agentId: string, workWeek: WorkWeek) =>
    updateEntry(agentId, e => {
      const perWeekDays = WORK_WEEK_DAYS[workWeek];
      // Auto-fill weekly days to match the working pattern (only when value is empty/legacy).
      const weeks = e.weeks.map(w => ({ ...w, days: w.days || perWeekDays })) as LeadsEntry['weeks'];
      return { ...e, workWeek, weeks };
    });

  const setMonthField = (agentId: string, field: keyof WeekEntry, value: number) =>
    updateEntry(agentId, e => ({ ...e, month: { ...e.month, [field]: value } }));

  const setWeekField = (agentId: string, weekIdx: number, field: keyof WeekEntry, value: number) =>
    updateEntry(agentId, e => {
      const weeks = e.weeks.map((w, i) => (i === weekIdx ? { ...w, [field]: value } : w)) as LeadsEntry['weeks'];
      return { ...e, weeks };
    });

  const handleSave = async (agentId: string) => {
    const target = targets[agentId];
    if (target === undefined || target < 0) {
      toast.error('Please enter a valid target');
      return;
    }
    const manualLeads = computeTotal(getEntry(agentId));

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
          Set the deals target and manual leads per agent. Enter the full month, or break it down by week.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {agents.map(agent => {
            const entry = getEntry(agent.id);
            const totalLeads = computeTotal(entry);
            return (
              <div key={agent.id} className="p-3 rounded-lg border bg-muted/30 space-y-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
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

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
                  <div className="flex items-center gap-1.5 rounded-md border bg-background p-0.5">
                    <Button
                      size="sm"
                      variant={entry.mode === 'month' ? 'default' : 'ghost'}
                      className="h-7 px-2 text-xs"
                      onClick={() => setMode(agent.id, 'month')}
                    >
                      Full month
                    </Button>
                    <Button
                      size="sm"
                      variant={entry.mode === 'weekly' ? 'default' : 'ghost'}
                      className="h-7 px-2 text-xs"
                      onClick={() => setMode(agent.id, 'weekly')}
                    >
                      Weekly
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Working week</Label>
                    <Select value={entry.workWeek} onValueChange={(v) => setWorkWeek(agent.id, v as WorkWeek)}>
                      <SelectTrigger className="h-8 w-[140px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mon-fri">Mon – Fri (5)</SelectItem>
                        <SelectItem value="mon-sat">Mon – Sat (6)</SelectItem>
                        <SelectItem value="mon-sun">Mon – Sun (7)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Total leads (month)</span>
                    <div className="h-8 min-w-[60px] flex items-center justify-center px-3 rounded-md border bg-background font-semibold">
                      {totalLeads}
                    </div>
                    <Button size="sm" onClick={() => handleSave(agent.id)} disabled={saving}>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                </div>

                {entry.mode === 'month' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                    <div>
                      <Label className="text-xs">Days worked</Label>
                      <Input
                        type="number"
                        min={0}
                        value={entry.month.days || ''}
                        onChange={e => setMonthField(agent.id, 'days', parseInt(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Leads / day</Label>
                      <Input
                        type="number"
                        min={0}
                        value={entry.month.perDay || ''}
                        onChange={e => setMonthField(agent.id, 'perDay', parseInt(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {entry.weeks.map((w, i) => {
                      const weekTotal = Math.max(0, Math.round((w.days || 0) * (w.perDay || 0)));
                      return (
                        <div key={i} className="p-2 rounded-md border bg-background space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">Week {i + 1}</span>
                            <span className="text-xs text-muted-foreground">= {weekTotal}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Days</Label>
                              <Input
                                type="number"
                                min={0}
                                max={7}
                                className="h-8 text-sm"
                                value={w.days || ''}
                                onChange={e => setWeekField(agent.id, i, 'days', parseInt(e.target.value) || 0)}
                                placeholder={String(WORK_WEEK_DAYS[entry.workWeek])}
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Leads / day</Label>
                              <Input
                                type="number"
                                min={0}
                                className="h-8 text-sm"
                                value={w.perDay || ''}
                                onChange={e => setWeekField(agent.id, i, 'perDay', parseInt(e.target.value) || 0)}
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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

