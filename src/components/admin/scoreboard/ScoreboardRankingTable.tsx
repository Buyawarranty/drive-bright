import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Trophy, Medal, Crown, Star, Flame, Pencil, Save, Loader2 } from 'lucide-react';
import { AgentScore, TimePeriod } from '@/hooks/useScoreboardData';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

interface Props {
  agents: AgentScore[];
  currentAdminUserId: string | null;
  period: TimePeriod;
  currentUserRole?: string | null;
  onTargetSaved?: () => void;
}

const PERIOD_LABELS: Record<TimePeriod, string> = {
  today: "Today's",
  week: "This Week's",
  month: "This Month's",
  all: 'All-Time',
  custom: 'Custom Period',
};

const getRankStyle = (rank: number) => {
  switch (rank) {
    case 1: return { bg: 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-400', icon: <Crown className="h-6 w-6 text-yellow-500 drop-shadow" />, label: 'bg-yellow-500 text-white', ring: 'ring-2 ring-yellow-400/50' };
    case 2: return { bg: 'bg-gradient-to-r from-gray-50 to-slate-100 border-gray-300', icon: <Medal className="h-5 w-5 text-gray-400" />, label: 'bg-gray-400 text-white', ring: '' };
    case 3: return { bg: 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-300', icon: <Medal className="h-5 w-5 text-orange-600" />, label: 'bg-orange-600 text-white', ring: '' };
    default: return { bg: 'border-border', icon: null, label: 'bg-muted text-muted-foreground', ring: '' };
  }
};




export const ScoreboardRankingTable: React.FC<Props> = ({ agents, currentAdminUserId, period, currentUserRole, onTargetSaved }) => {
  const canEditTargets = currentUserRole === 'super_admin' || currentUserRole === 'admin' || currentUserRole === 'sales_lead';
  const prevFirstRef = useRef<string | null>(null);

  useEffect(() => {
    if (agents.length > 0) {
      const firstId = agents[0].id;
      if (prevFirstRef.current && prevFirstRef.current !== firstId) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.3 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#00CED1', '#7B68EE'],
        });
      }
      prevFirstRef.current = firstId;
    }
  }, [agents]);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
        <CardTitle className="flex items-center gap-3 text-xl">
          <Trophy className="h-6 w-6 text-yellow-500" />
          {PERIOD_LABELS[period]} Leaderboard
          <Flame className="h-5 w-5 text-orange-500 animate-pulse" />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {agents.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No sales data for this period yet.</div>
        ) : (
          <>
            {/* Column headers (desktop only) */}
            <div className="hidden md:flex items-center gap-4 px-4 md:px-6 py-2 border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <div className="flex-shrink-0 w-12 text-center">Rank</div>
              <div className="flex-1 min-w-0">Agent</div>
              <div className="flex items-center gap-6">
                <div className="w-24 text-center">Sales</div>
                <div className="w-24 text-center">Revenue</div>
                <div className="w-16 text-center">Leads</div>
                <div className="w-16 text-center">Conv.</div>
                <div className="w-20 text-center">AOV</div>
                {agents.some(a => a.cancelledCount > 0) && (
                  <div className="w-16 text-center">Refunds</div>
                )}
                {canEditTargets && <div className="w-20 text-center">Target</div>}
              </div>

            </div>
          <div className="divide-y">
            {agents.map((agent) => {
              const style = getRankStyle(agent.rank);
              const isMe = agent.id === currentAdminUserId;
              

              return (
                <div
                  key={agent.id}
                  className={`flex items-center gap-4 px-4 py-4 md:px-6 transition-all hover:bg-muted/30 ${style.bg} ${style.ring} ${isMe ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-12 text-center">
                    {style.icon ? (
                      <div className="flex items-center justify-center">{style.icon}</div>
                    ) : (
                      <span className="text-lg font-bold text-muted-foreground">#{agent.rank}</span>
                    )}
                  </div>

                  {/* Avatar & Name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${agent.rank === 1 ? 'bg-yellow-500 text-white' : agent.rank === 2 ? 'bg-gray-400 text-white' : agent.rank === 3 ? 'bg-orange-600 text-white' : 'bg-primary text-primary-foreground'}`}>
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate flex items-center gap-2">
                          {agent.name}
                          {isMe && <Badge variant="outline" className="text-xs px-1.5 py-0 border-primary text-primary">You</Badge>}
                          {agent.rank === 1 && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{agent.email}</div>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden md:flex items-center gap-6 text-sm">
                    <div className="w-24 text-center">

                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                        Sales{agent.monthlyTarget ? ` (${Math.min(100, Math.round((agent.salesCount / agent.monthlyTarget) * 100))}%)` : ''}
                      </div>
                      <div className="font-bold text-lg">
                        {agent.salesCount}
                        {agent.monthlyTarget ? (
                          <span className="text-sm font-medium text-muted-foreground"> / {agent.monthlyTarget}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="w-24 text-center">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Revenue</div>
                      <div className="font-bold text-lg text-emerald-600">£{agent.revenue.toLocaleString()}</div>
                    </div>
                    <div className="w-16 text-center">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Leads</div>
                      <div className="font-bold text-lg text-blue-600">{agent.leadsAssigned}</div>
                    </div>
                    <div className="w-16 text-center">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Conv.</div>
                      <div className="font-bold">{agent.conversionRate.toFixed(0)}%</div>
                    </div>
                    <div className="w-20 text-center">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">AOV</div>
                      <div className="font-bold">£{agent.avgOrderValue.toFixed(0)}</div>
                    </div>
                    {agent.cancelledCount > 0 && (
                      <div className="w-16 text-center">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-red-500 mb-0.5">Refunds</div>
                        <div className="font-bold text-red-600">{agent.cancelledCount}</div>
                      </div>
                    )}
                  </div>

                  {/* Mobile stats */}
                  <div className="md:hidden text-right">
                    <div className="font-bold text-emerald-600">£{agent.revenue.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{agent.salesCount} sales{agent.cancelledCount > 0 ? ` · ${agent.cancelledCount} refunds` : ''}</div>
                  </div>

                  {isSuperAdmin && (
                    <EditTargetButton
                      agentId={agent.id}
                      currentTarget={agent.monthlyTarget}
                      currentLeads={agent.manualLeadsCount}
                      onSaved={onTargetSaved}
                    />
                  )}

                </div>
              );
            })}
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

interface EditTargetButtonProps {
  agentId: string;
  currentTarget: number | null;
  currentLeads: number | null;
  onSaved?: () => void;
}

const EditTargetButton: React.FC<EditTargetButtonProps> = ({ agentId, currentTarget, currentLeads, onSaved }) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(currentTarget?.toString() ?? '');
  const [leadsValue, setLeadsValue] = useState<string>(currentLeads?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(currentTarget?.toString() ?? '');
    setLeadsValue(currentLeads?.toString() ?? '');
  }, [currentTarget, currentLeads, open]);

  const handleSave = async () => {
    const target = parseInt(value);
    if (isNaN(target) || target < 0) {
      toast.error('Enter a valid target');
      return;
    }
    const leadsTrimmed = leadsValue.trim();
    let manualLeads: number | null = null;
    if (leadsTrimmed !== '') {
      const parsed = parseInt(leadsTrimmed);
      if (isNaN(parsed) || parsed < 0) {
        toast.error('Enter a valid leads number (or leave blank)');
        return;
      }
      manualLeads = parsed;
    }

    setSaving(true);
    try {
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());
      const nowIso = new Date().toISOString();

      const { data: existing } = await supabase
        .from('sales_targets')
        .select('id')
        .eq('admin_user_id', agentId)
        .eq('target_period', 'monthly')
        .lte('start_date', nowIso)
        .gte('end_date', nowIso)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('sales_targets')
          .update({ target_amount: target, manual_leads_count: manualLeads })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sales_targets')
          .insert({
            admin_user_id: agentId,
            target_amount: target,
            manual_leads_count: manualLeads,
            target_period: 'monthly',
            start_date: monthStart.toISOString(),
            end_date: monthEnd.toISOString(),
          });
        if (error) throw error;
      }
      toast.success('Saved');
      setOpen(false);
      onSaved?.();
    } catch (e: any) {
      console.error('Save target error', e);
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 gap-1"
          title="Edit monthly target & leads"
        >
          <Pencil className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-xs">Edit</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div>
            <div className="text-sm font-semibold">Monthly target</div>
            <div className="text-xs text-muted-foreground">Number of deals for this month</div>
          </div>
          <Input
            type="number"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            autoFocus
          />
          <div className="pt-2 border-t">
            <div className="text-sm font-semibold">Leads this month</div>
            <div className="text-xs text-muted-foreground">Manual override (leave blank to use auto count)</div>
          </div>
          <Input
            type="number"
            min={0}
            value={leadsValue}
            onChange={(e) => setLeadsValue(e.target.value)}
            placeholder="Auto"
          />
          <Button onClick={handleSave} disabled={saving} className="w-full" size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" /> Save</>}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
