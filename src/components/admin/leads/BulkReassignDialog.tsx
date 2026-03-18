import React, { useState, useMemo, useEffect } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [allAgents, setAllAgents] = useState<AdminUser[]>([]);
  const [mode, setMode] = useState<ReassignMode>('all');
  const [percentage, setPercentage] = useState(50);
  const [moveCount, setMoveCount] = useState(10);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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
  const toAgents = useMemo(() => salesUsers.filter(u => u.id !== fromAgent), [salesUsers, fromAgent]);

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
      } else {
        // For percentage/count modes, count only sales_leads with optional date filter
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
    if (mode === 'all') return leadCount;
    if (mode === 'percentage') return Math.ceil((leadCount * percentage) / 100);
    return Math.min(moveCount, leadCount);
  }, [leadCount, mode, percentage, moveCount]);

  const handleReassign = async () => {
    if (!fromAgent || !toAgent) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();

      if (mode === 'all') {
        const [leadsResult, customersResult] = await Promise.all([
          supabase.from('sales_leads').update({ assigned_to: toAgent, assigned_at: now, updated_at: now }).eq('assigned_to', fromAgent),
          supabase.from('customers').update({ assigned_to: toAgent, updated_at: now }).eq('assigned_to', fromAgent),
        ]);
        if (leadsResult.error) throw leadsResult.error;
        if (customersResult.error) throw customersResult.error;
      } else {
        // Fetch IDs of leads to move (newest first), with optional date filter
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
            .update({ assigned_to: toAgent, assigned_at: now, updated_at: now })
            .in('id', ids);
          if (updateErr) throw updateErr;
        }
      }

      toast.success(`Successfully reassigned ${actualMoveCount} record${actualMoveCount !== 1 ? 's' : ''} from ${getDisplayName(fromUser!)} to ${getDisplayName(toUser!)}`);
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
    setLeadCount(null);
    setStep('select');
    setMode('all');
    setPercentage(50);
    setMoveCount(10);
    setDateFrom('');
    setDateTo('');
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) resetState();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <UserRoundCog className="h-3.5 w-3.5" />
          Reassign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
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
            <ModeSelector mode={mode} onSelect={(m) => { setMode(m); setLeadCount(null); }} />

            <AgentSelector
              label="From agent"
              agents={allAgents}
              selectedId={fromAgent}
              onSelect={(id) => { setFromAgent(id); setToAgent(null); setLeadCount(null); }}
            />

            {fromAgent && (
              <AgentSelector
                label="To agent"
                agents={toAgents}
                selectedId={toAgent}
                onSelect={setToAgent}
              />
            )}

            {/* Date range filter for percentage/count modes */}
            {mode !== 'all' && fromAgent && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Date range (optional)</label>
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

        {step === 'confirm' && fromUser && toUser && leadCount !== null && (
          <ConfirmationStep
            fromUser={fromUser}
            toUser={toUser}
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
              disabled={!fromAgent || !toAgent || loading}
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
