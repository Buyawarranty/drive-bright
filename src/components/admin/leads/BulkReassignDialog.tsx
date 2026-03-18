import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ArrowRight, RefreshCw, UserRoundCog } from 'lucide-react';
import { AdminUser } from '@/hooks/useLeads';
import { AgentSelector, getDisplayName } from './bulk-reassign/AgentSelector';
import { ConfirmationStep } from './bulk-reassign/ConfirmationStep';
import { ModeSelector, ReassignMode } from './bulk-reassign/ModeSelector';
import { LeadPickerList } from './bulk-reassign/LeadPickerList';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface BulkReassignDialogProps {
  salesUsers: AdminUser[];
  onComplete: () => void;
}

export const BulkReassignDialog: React.FC<BulkReassignDialogProps> = ({
  salesUsers,
  onComplete,
}) => {
  const [open, setOpen] = useState(false);
  const [fromAgent, setFromAgent] = useState<string | null>(null);
  const [toAgent, setToAgent] = useState<string | null>(null);
  const [toAgentIds, setToAgentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [allAgents, setAllAgents] = useState<AdminUser[]>([]);
  const [mode, setMode] = useState<ReassignMode>('all');
  const [percentage, setPercentage] = useState(50);
  const [moveCount, setMoveCount] = useState(10);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    const fetchAll = async () => {
      const { data } = await supabase
        .from('admin_users')
        .select('id, user_id, first_name, last_name, email, is_active, role')
        .in('role', ['sales', 'sales_lead', 'admin', 'super_admin'])
        .order('first_name');
      setAllAgents((data as AdminUser[]) || []);
    };
    fetchAll();
  }, [open]);

  const fromUser = useMemo(() => allAgents.find(u => u.id === fromAgent), [allAgents, fromAgent]);
  const toUser = useMemo(() => salesUsers.find(u => u.id === toAgent), [salesUsers, toAgent]);
  const toAgentsList = useMemo(() => salesUsers.filter(u => u.id !== fromAgent), [salesUsers, fromAgent]);

  // For cherry_pick multi-select: resolved user objects
  const selectedToUsers = useMemo(() => salesUsers.filter(u => toAgentIds.has(u.id)), [salesUsers, toAgentIds]);

  // Effective "to" users depending on mode
  const effectiveToUsers = useMemo(() => {
    if (mode === 'cherry_pick') return selectedToUsers;
    return toUser ? [toUser] : [];
  }, [mode, selectedToUsers, toUser]);

  const isCherryPick = mode === 'cherry_pick';

  const toggleToAgent = useCallback((id: string) => {
    setToAgentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCheckCount = async () => {
    if (!fromAgent) return;
    setLoading(true);
    try {
      if (mode === 'all') {
        const [leadsResult, customersResult] = await Promise.all([
          supabase.from('sales_leads').select('*', { count: 'exact', head: true }).eq('assigned_to', fromAgent),
          supabase.from('customers').select('*', { count: 'exact', head: true }).eq('assigned_to', fromAgent).eq('is_deleted', false),
        ]);
        if (leadsResult.error) throw leadsResult.error;
        if (customersResult.error) throw customersResult.error;
        setLeadCount((leadsResult.count || 0) + (customersResult.count || 0));
      } else if (mode === 'cherry_pick') {
        setLeadCount(selectedLeadIds.size);
      } else {
        let query = supabase.from('sales_leads').select('*', { count: 'exact', head: true }).eq('assigned_to', fromAgent);
        if (dateFrom) query = query.gte('created_at', new Date(dateFrom).toISOString());
        if (dateTo) {
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          query = query.lte('created_at', endDate.toISOString());
        }
        const { count, error } = await query;
        if (error) throw error;
        setLeadCount(count || 0);
      }
      setStep('confirm');
    } catch (err) {
      console.error('Error checking lead count:', err);
      toast.error('Failed to check lead count');
    } finally {
      setLoading(false);
    }
  };

  const actualMoveCount = useMemo(() => {
    if (leadCount === null) return 0;
    if (mode === 'all' || mode === 'cherry_pick') return leadCount;
    if (mode === 'percentage') return Math.ceil((leadCount * percentage) / 100);
    return Math.min(moveCount, leadCount);
  }, [leadCount, mode, percentage, moveCount]);

  const handleReassign = async () => {
    if (!fromAgent || effectiveToUsers.length === 0) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();

      if (mode === 'all') {
        const target = effectiveToUsers[0].id;
        const [leadsResult, customersResult] = await Promise.all([
          supabase.from('sales_leads').update({ assigned_to: target, assigned_at: now, updated_at: now }).eq('assigned_to', fromAgent),
          supabase.from('customers').update({ assigned_to: target, updated_at: now }).eq('assigned_to', fromAgent),
        ]);
        if (leadsResult.error) throw leadsResult.error;
        if (customersResult.error) throw customersResult.error;
      } else if (mode === 'cherry_pick') {
        const ids = Array.from(selectedLeadIds);
        const agents = effectiveToUsers.map(u => u.id);

        // Distribute round-robin across selected agents
        const batches: Record<string, string[]> = {};
        agents.forEach(a => { batches[a] = []; });
        ids.forEach((id, i) => {
          const agentId = agents[i % agents.length];
          batches[agentId].push(id);
        });

        const updates = Object.entries(batches)
          .filter(([, leadIds]) => leadIds.length > 0)
          .map(([agentId, leadIds]) =>
            supabase.from('sales_leads')
              .update({ assigned_to: agentId, assigned_at: now, updated_at: now })
              .in('id', leadIds)
          );
        const results = await Promise.all(updates);
        for (const r of results) {
          if (r.error) throw r.error;
        }
      } else {
        const target = effectiveToUsers[0].id;
        let query = supabase.from('sales_leads').select('id').eq('assigned_to', fromAgent).order('created_at', { ascending: false });
        if (dateFrom) query = query.gte('created_at', new Date(dateFrom).toISOString());
        if (dateTo) {
          const endDate = new Date(dateTo);
          endDate.setHours(23, 59, 59, 999);
          query = query.lte('created_at', endDate.toISOString());
        }
        query = query.limit(actualMoveCount);
        const { data: leadIds, error: fetchErr } = await query;
        if (fetchErr) throw fetchErr;
        if (leadIds && leadIds.length > 0) {
          const ids = leadIds.map(l => l.id);
          const { error: updateErr } = await supabase
            .from('sales_leads')
            .update({ assigned_to: target, assigned_at: now, updated_at: now })
            .in('id', ids);
          if (updateErr) throw updateErr;
        }
      }

      const toNames = effectiveToUsers.map(u => getDisplayName(u)).join(', ');
      toast.success(`Successfully reassigned ${actualMoveCount} record${actualMoveCount !== 1 ? 's' : ''} from ${getDisplayName(fromUser!)} to ${toNames}`);
      setOpen(false);
      resetState();
      onComplete();
    } catch (err) {
      console.error('Error reassigning leads:', err);
      toast.error('Failed to reassign leads');
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setFromAgent(null);
    setToAgent(null);
    setToAgentIds(new Set());
    setLeadCount(null);
    setStep('select');
    setMode('all');
    setPercentage(50);
    setMoveCount(10);
    setDateFrom('');
    setDateTo('');
    setSelectedLeadIds(new Set());
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) resetState();
  };

  const canContinue = useMemo(() => {
    if (!fromAgent || loading) return false;
    if (mode === 'cherry_pick') return selectedLeadIds.size > 0 && toAgentIds.size > 0;
    if (!toAgent) return false;
    if (mode !== 'all' && (!dateFrom || !dateTo)) return false;
    return true;
  }, [fromAgent, toAgent, loading, mode, dateFrom, dateTo, selectedLeadIds, toAgentIds]);

  const getInitials = (user: AdminUser) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
    }
    return user.email[0].toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <UserRoundCog className="h-3.5 w-3.5" />
          Reassign
        </Button>
      </DialogTrigger>
      <DialogContent className={isCherryPick ? 'sm:max-w-2xl' : 'sm:max-w-md'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundCog className="h-5 w-5" />
            Bulk Reassign Leads
          </DialogTitle>
          <DialogDescription>
            Transfer leads from one agent to another. Choose a mode below.
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4 py-2">
            <ModeSelector mode={mode} onSelect={(m) => { setMode(m); setLeadCount(null); setSelectedLeadIds(new Set()); setToAgentIds(new Set()); }} />

            <AgentSelector
              label="From agent"
              agents={allAgents}
              selectedId={fromAgent}
              onSelect={(id) => { setFromAgent(id); setToAgent(null); setToAgentIds(new Set()); setLeadCount(null); setSelectedLeadIds(new Set()); }}
            />

            {/* Cherry-pick: show lead list + multi-agent selector */}
            {isCherryPick && fromAgent && (
              <>
                <LeadPickerList
                  fromAgentId={fromAgent}
                  selectedIds={selectedLeadIds}
                  onToggle={(id) => {
                    setSelectedLeadIds(prev => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    });
                  }}
                  onSelectAll={(ids) => setSelectedLeadIds(new Set(ids))}
                  onDeselectAll={() => setSelectedLeadIds(new Set())}
                />

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Assign to <span className="text-xs">(select one or more)</span>
                  </label>
                  <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                    {toAgentsList.map((user) => (
                      <label
                        key={user.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-colors ${
                          toAgentIds.has(user.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
                        }`}
                      >
                        <Checkbox
                          checked={toAgentIds.has(user.id)}
                          onCheckedChange={() => toggleToAgent(user.id)}
                        />
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(user)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">{getDisplayName(user)}</span>
                      </label>
                    ))}
                  </div>
                  {toAgentIds.size > 1 && (
                    <p className="text-xs text-muted-foreground">
                      Leads will be split evenly (round-robin) across {toAgentIds.size} agents
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Single "To" agent for non-cherry-pick modes */}
            {!isCherryPick && fromAgent && (
              <AgentSelector
                label="To agent"
                agents={toAgentsList}
                selectedId={toAgent}
                onSelect={setToAgent}
              />
            )}

            {/* Date range filter for percentage/count modes — required */}
            {(mode === 'percentage' || mode === 'count') && fromAgent && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Date range <span className="text-destructive">*</span></label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">From</Label>
                    <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">To</Label>
                    <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
                {(!dateFrom || !dateTo) && (
                  <p className="text-xs text-destructive">Both dates are required</p>
                )}
              </div>
            )}

            {/* Percentage slider */}
            {mode === 'percentage' && fromAgent && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-muted-foreground">Percentage to move</label>
                  <span className="text-sm font-bold text-primary">{percentage}%</span>
                </div>
                <Slider
                  value={[percentage]}
                  onValueChange={([v]) => setPercentage(v)}
                  min={10}
                  max={90}
                  step={5}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">Newest leads will be moved first</p>
              </div>
            )}

            {/* Count input */}
            {mode === 'count' && fromAgent && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Number of leads to move</label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={moveCount}
                  onChange={e => setMoveCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-8 text-sm"
                />
                <p className="text-xs text-muted-foreground">Newest leads will be moved first</p>
              </div>
            )}
          </div>
        )}

        {step === 'confirm' && fromUser && effectiveToUsers.length > 0 && leadCount !== null && (
          <ConfirmationStep
            fromUser={fromUser}
            toUsers={effectiveToUsers}
            leadCount={leadCount}
            mode={mode}
            percentage={percentage}
            moveCount={moveCount}
          />
        )}

        <DialogFooter>
          {step === 'select' && (
            <Button
              onClick={handleCheckCount}
              disabled={!canContinue}
              className="w-full gap-2"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Continue
            </Button>
          )}
          {step === 'confirm' && (
            <div className="flex gap-2 w-full">
              <Button variant="outline" onClick={() => setStep('select')} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleReassign}
                disabled={loading || actualMoveCount === 0}
                className="flex-1 bg-primary hover:bg-primary/90 gap-2"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                Reassign {actualMoveCount} Lead{actualMoveCount !== 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
