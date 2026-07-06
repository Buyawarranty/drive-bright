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
import { getDisplayName } from './bulk-reassign/AgentSelector';
import { ConfirmationStep } from './bulk-reassign/ConfirmationStep';
import { ModeSelector, ReassignMode } from './bulk-reassign/ModeSelector';
import { LeadPickerList } from './bulk-reassign/LeadPickerList';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface BulkReassignDialogProps {
  salesUsers: AdminUser[];
  onComplete: () => void;
}

interface AgentMultiPickerProps {
  label: string;
  hint?: string;
  users: AdminUser[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  tone: 'from' | 'to';
}

const AgentMultiPicker: React.FC<AgentMultiPickerProps> = ({ label, hint, users, selectedIds, onToggle, tone }) => {
  const getInitials = (user: AdminUser) => {
    if (user.first_name || user.last_name) {
      return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();
    }
    return user.email[0].toUpperCase();
  };
  const activeCls = tone === 'from'
    ? 'border-destructive bg-destructive/5'
    : 'border-primary bg-primary/5';
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-muted-foreground">
          {label} <span className="text-xs">(select one or more)</span>
        </label>
        {selectedIds.size > 0 && (
          <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground -mt-1">{hint}</p>}
      <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
        {users.map((user) => (
          <label
            key={user.id}
            className={`flex items-center gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-colors ${
              selectedIds.has(user.id)
                ? activeCls
                : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
            }`}
          >
            <Checkbox
              checked={selectedIds.has(user.id)}
              onCheckedChange={() => onToggle(user.id)}
            />
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {getInitials(user)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{getDisplayName(user)}</div>
              <div className="text-[11px] text-muted-foreground truncate">{user.role}</div>
            </div>
          </label>
        ))}
        {users.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">No agents available.</p>
        )}
      </div>
    </div>
  );
};

const UNASSIGNED_ID = '00000000-0000-0000-0000-000000000000';
// Terminal statuses never resurrect into Live Leads, so don't reassign them
// from the Unassigned bucket — the target agent would never see them.
const TERMINAL_STATUSES = ['lost', 'converted', 'fake_lead', 'cancelled'];
const UNASSIGNED_USER: AdminUser = {
  id: UNASSIGNED_ID,
  user_id: '',
  first_name: 'Unassigned',
  last_name: '',
  email: '(leads with no owner)',
  is_active: true,
  role: 'unassigned',
} as unknown as AdminUser;

export const BulkReassignDialog: React.FC<BulkReassignDialogProps> = ({
  salesUsers,
  onComplete,
}) => {
  const [open, setOpen] = useState(false);
  const [fromAgentIds, setFromAgentIds] = useState<Set<string>>(new Set());
  const [toAgentIds, setToAgentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [perAgentCounts, setPerAgentCounts] = useState<Record<string, { leads: number; customers: number }>>({});
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

  const realPool = useMemo(
    () => (allAgents.length ? allAgents : salesUsers).filter(u => u.is_active !== false),
    [allAgents, salesUsers],
  );

  // From picker includes an "Unassigned" pseudo-agent so leads orphaned by a
  // deleted user can be redistributed. The To picker never shows it.
  const fromPool = useMemo(() => [UNASSIGNED_USER, ...realPool], [realPool]);

  const fromUsers = useMemo(() => fromPool.filter(u => fromAgentIds.has(u.id)), [fromPool, fromAgentIds]);
  const toUsers = useMemo(() => realPool.filter(u => toAgentIds.has(u.id)), [realPool, toAgentIds]);

  // Prevent picking the same agent as both source and destination
  const toAgentsList = useMemo(() => realPool.filter(u => !fromAgentIds.has(u.id)), [realPool, fromAgentIds]);

  const isCherryPick = mode === 'cherry_pick';

  const toggleFromAgent = useCallback((id: string) => {
    setFromAgentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setToAgentIds(prev => {
      // if newly-added source was also a destination, drop it from destinations
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setLeadCount(null);
    setSelectedLeadIds(new Set());
  }, []);

  const toggleToAgent = useCallback((id: string) => {
    setToAgentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleCheckCount = async () => {
    if (fromAgentIds.size === 0) return;
    setLoading(true);
    try {
      const sourceIds = Array.from(fromAgentIds);

      if (mode === 'all') {
        // Count per source so we can split evenly across destinations
        const perAgent: Record<string, { leads: number; customers: number }> = {};
        let totalLeads = 0;
        let totalCustomers = 0;
        const fromIso = dateFrom ? new Date(dateFrom).toISOString() : null;
        let toIso: string | null = null;
        if (dateTo) {
          const d = new Date(dateTo);
          d.setHours(23, 59, 59, 999);
          toIso = d.toISOString();
        }
        await Promise.all(sourceIds.map(async (aid) => {
          const isUnassigned = aid === UNASSIGNED_ID;
          let lq = supabase.from('sales_leads').select('*', { count: 'exact', head: true });
          let cq = supabase.from('customers').select('*', { count: 'exact', head: true }).eq('is_deleted', false);
          lq = isUnassigned ? lq.is('assigned_to', null).not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`) : lq.eq('assigned_to', aid);
          cq = isUnassigned ? cq.is('assigned_to', null) : cq.eq('assigned_to', aid);
          if (fromIso) { lq = lq.gte('created_at', fromIso); cq = cq.gte('created_at', fromIso); }
          if (toIso) { lq = lq.lte('created_at', toIso); cq = cq.lte('created_at', toIso); }
          const [l, c] = await Promise.all([lq, cq]);
          if (l.error) throw l.error;
          if (c.error) throw c.error;
          perAgent[aid] = { leads: l.count || 0, customers: c.count || 0 };
          totalLeads += l.count || 0;
          totalCustomers += c.count || 0;
        }));
        setPerAgentCounts(perAgent);
        setLeadCount(totalLeads);
        setCustomerCount(totalCustomers);
      } else if (mode === 'cherry_pick') {
        setLeadCount(selectedLeadIds.size);
        setCustomerCount(0);
        setPerAgentCounts({});
      } else {
        // percentage / count — sum leads across sources within the date range
        const perAgent: Record<string, { leads: number; customers: number }> = {};
        let totalLeads = 0;
        await Promise.all(sourceIds.map(async (aid) => {
          const isUnassigned = aid === UNASSIGNED_ID;
          let query = supabase.from('sales_leads').select('*', { count: 'exact', head: true });
          query = isUnassigned ? query.is('assigned_to', null).not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`) : query.eq('assigned_to', aid);
          if (dateFrom) query = query.gte('created_at', new Date(dateFrom).toISOString());
          if (dateTo) {
            const endDate = new Date(dateTo);
            endDate.setHours(23, 59, 59, 999);
            query = query.lte('created_at', endDate.toISOString());
          }
          const { count, error } = await query;
          if (error) throw error;
          perAgent[aid] = { leads: count || 0, customers: 0 };
          totalLeads += count || 0;
        }));
        setPerAgentCounts(perAgent);
        setLeadCount(totalLeads);
        setCustomerCount(0);
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
    if (mode === 'all' || mode === 'cherry_pick') return leadCount + (mode === 'all' ? customerCount : 0);
    if (mode === 'percentage') return Math.ceil((leadCount * percentage) / 100);
    return Math.min(moveCount, leadCount);
  }, [leadCount, customerCount, mode, percentage, moveCount]);

  const callBulkRpc = async (
    fromAgentId: string,
    toAgentId: string,
    leadIds: string[] | null,
    includeCustomers: boolean,
    dateRange: { from?: string; to?: string } = {},
    limit?: number,
  ) => {
    const { data, error } = await supabase.rpc('bulk_reassign_leads_to_agent', {
      p_from_agent: fromAgentId,
      p_to_agent: toAgentId,
      p_lead_ids: leadIds,
      p_date_from: dateRange.from ? new Date(dateRange.from).toISOString() : null,
      p_date_to: dateRange.to ? (() => { const d = new Date(dateRange.to!); d.setHours(23,59,59,999); return d.toISOString(); })() : null,
      p_limit: limit ?? null,
      p_include_customers: includeCustomers,
    });
    if (error) throw error;
    const r = data as { success: boolean; error?: string; moved?: number; customers_moved?: number };
    if (!r.success) throw new Error(r.error || 'Reassign failed');
    return r;
  };

  // Fetch unassigned lead ids matching the date range (newest first).
  const fetchUnassignedLeadIds = async (
    dateRange: { from?: string; to?: string } = {},
    limit?: number,
  ): Promise<string[]> => {
    let q = supabase.from('sales_leads').select('id').is('assigned_to', null).not('status', 'in', `(${TERMINAL_STATUSES.join(',')})`).order('created_at', { ascending: false });
    if (dateRange.from) q = q.gte('created_at', new Date(dateRange.from).toISOString());
    if (dateRange.to) {
      const d = new Date(dateRange.to); d.setHours(23,59,59,999);
      q = q.lte('created_at', d.toISOString());
    }
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((r: any) => r.id as string);
  };

  // Move unassigned customers (assigned_to IS NULL) to the given target agent.
  const reassignUnassignedCustomers = async (
    targetId: string,
    dateRange: { from?: string; to?: string } = {},
  ): Promise<number> => {
    let sel = supabase.from('customers').select('id').is('assigned_to', null).eq('is_deleted', false);
    if (dateRange.from) sel = sel.gte('created_at', new Date(dateRange.from).toISOString());
    if (dateRange.to) {
      const d = new Date(dateRange.to); d.setHours(23,59,59,999);
      sel = sel.lte('created_at', d.toISOString());
    }
    const { data, error } = await sel;
    if (error) throw error;
    const ids = (data || []).map((r: any) => r.id as string);
    if (!ids.length) return 0;
    const { error: upErr } = await supabase
      .from('customers')
      .update({ assigned_to: targetId, updated_at: new Date().toISOString() })
      .in('id', ids);
    if (upErr) throw upErr;
    return ids.length;
  };

  const handleReassign = async () => {
    if (fromAgentIds.size === 0 || toAgentIds.size === 0) return;
    setLoading(true);
    try {
      const sources = Array.from(fromAgentIds);
      const targets = Array.from(toAgentIds);
      let totalMoved = 0;
      // Global round-robin pointer so distribution is even across ALL sources combined
      let rrPointer = 0;

      if (mode === 'cherry_pick') {
        // Fetch lead → owner mapping for the selected leads so we call the RPC with the correct source
        const ids = Array.from(selectedLeadIds);
        const { data: rows, error } = await supabase
          .from('sales_leads')
          .select('id, assigned_to')
          .in('id', ids);
        if (error) throw error;
        // Group by (source, target). Null owner counts as UNASSIGNED_ID.
        const buckets: Record<string, Record<string, string[]>> = {};
        (rows || []).forEach((row: any) => {
          const src: string = row.assigned_to ?? UNASSIGNED_ID;
          if (!sources.includes(src)) return;
          const tgt = targets[rrPointer % targets.length];
          rrPointer++;
          buckets[src] = buckets[src] || {};
          buckets[src][tgt] = buckets[src][tgt] || [];
          buckets[src][tgt].push(row.id);
        });
        for (const [src, byTarget] of Object.entries(buckets)) {
          for (const [tgt, leadIds] of Object.entries(byTarget)) {
            if (!leadIds.length) continue;
            // For unassigned rows p_from_agent is unused when p_lead_ids is given.
            const res = await callBulkRpc(src === UNASSIGNED_ID ? tgt : src, tgt, leadIds, false);
            totalMoved += res.moved || 0;
          }
        }
      } else if (mode === 'all') {
        // For each source, split its own leads+customers evenly across all targets.
        for (const src of sources) {
          const counts = perAgentCounts[src] || { leads: 0, customers: 0 };
          const totalForSrc = counts.leads + counts.customers;
          if (totalForSrc === 0) continue;
          const isUnassignedSrc = src === UNASSIGNED_ID;

          // Pre-fetch ids for the unassigned source since the RPC filters by assigned_to = p_from_agent
          const unassignedIds = isUnassignedSrc
            ? await fetchUnassignedLeadIds({ from: dateFrom, to: dateTo })
            : [];

          if (targets.length === 1) {
            if (isUnassignedSrc) {
              if (unassignedIds.length) {
                const res = await callBulkRpc(targets[0], targets[0], unassignedIds, false);
                totalMoved += res.moved || 0;
              }
              totalMoved += await reassignUnassignedCustomers(targets[0], { from: dateFrom, to: dateTo });
            } else {
              const res = await callBulkRpc(src, targets[0], null, true, { from: dateFrom, to: dateTo });
              totalMoved += (res.moved || 0) + (res.customers_moved || 0);
            }
          } else {
            // Split source's leads evenly across targets. For non-unassigned sources use p_limit;
            // for unassigned we already have the id list and slice it manually.
            const base = Math.floor(counts.leads / targets.length);
            const rem = counts.leads - base * targets.length;
            let cursor = 0;
            for (let i = 0; i < targets.length; i++) {
              const slice = base + (i < rem ? 1 : 0);
              if (slice === 0) continue;
              const tgt = targets[(rrPointer + i) % targets.length];
              if (isUnassignedSrc) {
                const chunk = unassignedIds.slice(cursor, cursor + slice);
                cursor += slice;
                if (chunk.length) {
                  const res = await callBulkRpc(tgt, tgt, chunk, false);
                  totalMoved += res.moved || 0;
                }
              } else {
                const includeCustomersForThisCall = i === 0; // give customers to one target to avoid double-moving
                const res = await callBulkRpc(src, tgt, null, includeCustomersForThisCall, { from: dateFrom, to: dateTo }, slice);
                totalMoved += (res.moved || 0) + (res.customers_moved || 0);
              }
            }
            if (isUnassignedSrc) {
              // Give unassigned customers to the first target (matches non-unassigned behaviour)
              const firstTgt = targets[rrPointer % targets.length];
              totalMoved += await reassignUnassignedCustomers(firstTgt, { from: dateFrom, to: dateTo });
            }
            rrPointer += targets.length;
          }
        }
      } else {
        // percentage / count — compute per-source slice, then split each source across targets
        for (const src of sources) {
          const srcCount = perAgentCounts[src]?.leads || 0;
          if (srcCount === 0) continue;
          const srcMove = mode === 'percentage'
            ? Math.ceil((srcCount * percentage) / 100)
            : Math.min(moveCount, srcCount);
          if (srcMove === 0) continue;
          const isUnassignedSrc = src === UNASSIGNED_ID;
          const unassignedIds = isUnassignedSrc
            ? await fetchUnassignedLeadIds({ from: dateFrom, to: dateTo }, srcMove)
            : [];
          const base = Math.floor(srcMove / targets.length);
          const rem = srcMove - base * targets.length;
          let cursor = 0;
          for (let i = 0; i < targets.length; i++) {
            const slice = base + (i < rem ? 1 : 0);
            if (slice === 0) continue;
            const tgt = targets[(rrPointer + i) % targets.length];
            if (isUnassignedSrc) {
              const chunk = unassignedIds.slice(cursor, cursor + slice);
              cursor += slice;
              if (chunk.length) {
                const res = await callBulkRpc(tgt, tgt, chunk, false);
                totalMoved += res.moved || 0;
              }
            } else {
              const res = await callBulkRpc(src, tgt, null, false, { from: dateFrom, to: dateTo }, slice);
              totalMoved += res.moved || 0;
            }
          }
          rrPointer += targets.length;
        }
      }



      toast.success(
        `Reassigned ${totalMoved} record${totalMoved !== 1 ? 's' : ''} from ${sources.length} agent${sources.length !== 1 ? 's' : ''} to ${targets.length} agent${targets.length !== 1 ? 's' : ''}`,
      );
      setOpen(false);
      resetState();
      onComplete();
    } catch (err: any) {
      console.error('Error reassigning leads:', err);
      toast.error(err?.message || 'Failed to reassign leads');
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setFromAgentIds(new Set());
    setToAgentIds(new Set());
    setLeadCount(null);
    setCustomerCount(0);
    setPerAgentCounts({});
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
    if (fromAgentIds.size === 0 || toAgentIds.size === 0 || loading) return false;
    if (mode === 'cherry_pick') return selectedLeadIds.size > 0;
    if (mode !== 'all' && (!dateFrom || !dateTo)) return false;
    return true;
  }, [fromAgentIds, toAgentIds, loading, mode, dateFrom, dateTo, selectedLeadIds]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="default"
          className="h-10 gap-2 bg-orange-500 text-white hover:bg-orange-600 border-0 font-semibold text-sm px-5 shadow-sm"
        >
          <UserRoundCog className="h-4 w-4" />
          Reassign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <UserRoundCog className="h-5 w-5" />
            Bulk Reassign Leads
          </DialogTitle>
          <DialogDescription>
            Transfer leads from one or more agents to one or more agents to rebalance workloads.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2 min-h-0">
        {step === 'select' && (
          <div className="space-y-4 py-2">
            <ModeSelector
              mode={mode}
              onSelect={(m) => { setMode(m); setLeadCount(null); setSelectedLeadIds(new Set()); }}
            />

            <AgentMultiPicker
              label="From agents"
              hint="Leads will be pulled from every agent you tick here."
              users={fromPool}
              selectedIds={fromAgentIds}
              onToggle={toggleFromAgent}
              tone="from"
            />

            {isCherryPick && fromAgentIds.size > 0 && (
              <LeadPickerList
                fromAgentIds={Array.from(fromAgentIds)}
                agents={realPool}
                selectedIds={selectedLeadIds}
                onToggle={(id) => {
                  setSelectedLeadIds(prev => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id); else next.add(id);
                    return next;
                  });
                }}
                onSelectAll={(ids) => setSelectedLeadIds(new Set(ids))}
                onDeselectAll={() => setSelectedLeadIds(new Set())}
              />
            )}

            {fromAgentIds.size > 0 && (
              <AgentMultiPicker
                label="To agents"
                hint={toAgentIds.size > 1 ? 'Leads will be split evenly (round-robin) across the selected agents.' : undefined}
                users={toAgentsList}
                selectedIds={toAgentIds}
                onToggle={toggleToAgent}
                tone="to"
              />
            )}

            {/* Date range — optional for "all", required for percentage/count */}
            {(mode === 'all' || mode === 'percentage' || mode === 'count') && fromAgentIds.size > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Date range {mode === 'all' ? <span className="text-xs">(optional — leave blank to reassign all)</span> : <span className="text-destructive">*</span>}
                </label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">From</Label>
                    <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setLeadCount(null); }} className="h-8 text-xs" />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">To</Label>
                    <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setLeadCount(null); }} className="h-8 text-xs" />
                  </div>
                </div>
                {mode !== 'all' && (!dateFrom || !dateTo) && (
                  <p className="text-xs text-destructive">Both dates are required</p>
                )}
              </div>
            )}

            {mode === 'percentage' && fromAgentIds.size > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-muted-foreground">Percentage to move per source</label>
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

            {mode === 'count' && fromAgentIds.size > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Leads to move per source</label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={moveCount}
                  onChange={e => setMoveCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="h-8 text-sm"
                />
                <p className="text-xs text-muted-foreground">Applied to each source agent, newest first</p>
              </div>
            )}
          </div>
        )}

        {step === 'confirm' && fromUsers.length > 0 && toUsers.length > 0 && leadCount !== null && (
          <ConfirmationStep
            fromUsers={fromUsers}
            toUsers={toUsers}
            leadCount={leadCount + (mode === 'all' ? customerCount : 0)}
            mode={mode}
            percentage={percentage}
            moveCount={moveCount * fromAgentIds.size}
          />
        )}
        </div>

        <DialogFooter className="px-6 pb-6 pt-2 border-t shrink-0">
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
            <div className="flex flex-col gap-3 w-full">
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
                  Reassign {actualMoveCount} Record{actualMoveCount !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
