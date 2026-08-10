import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UserMinus, Loader2, ArrowRightLeft, Info, ShieldCheck, History, Undo2, Database, Eye, ChevronsUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

type Agent = { id: string; name: string; email: string | null; role: string; is_active: boolean };
type Counts = {
  totalLeads: number;
  openLeads: number;
  paidLeads: number;
  notes: number;
  quickNotes: number;
  reminders: number;
};

type OffboardingEvent = {
  id: string;
  source_admin_user_id: string;
  target_admin_user_id: string;
  source_name: string | null;
  source_email: string | null;
  target_name: string | null;
  target_email: string | null;
  executed_by_name: string | null;
  lead_count: number;
  paid_lead_count: number;
  reminder_count: number;
  also_deactivated: boolean;
  reset_to_new: boolean;
  restored_at: string | null;
  restored_lead_count: number | null;
  created_at: string;
};

/**
 * Agent Offboarding — one-click safe handover of a departing agent's
 * entire workload. Every handover writes a FULL BACKUP snapshot of every
 * lead + notes + reminders + call logs + changelog into
 * agent_offboarding_events / agent_offboarding_lead_snapshots BEFORE the
 * reassignment happens, so any offboarding can be reversed with one click.
 */
export const AgentOffboardingPanel: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sourceId, setSourceId] = useState<string>('');
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [working, setWorking] = useState(false);
  const [resetToNew, setResetToNew] = useState(false);
  const [alsoDeactivate, setAlsoDeactivate] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);


  const [backupsOpen, setBackupsOpen] = useState(false);
  const [events, setEvents] = useState<OffboardingEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const [dryRunOpen, setDryRunOpen] = useState(false);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRun, setDryRun] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from('admin_users') as any)
        .select('id, first_name, last_name, email, role, is_active')
        .in('role', ['sales', 'sales_lead'])
        .order('first_name');
      setAgents((data ?? []).map((a: any) => ({
        id: a.id,
        name: [a.first_name, a.last_name].filter(Boolean).join(' ').trim() || a.email || 'Agent',
        email: a.email,
        role: a.role,
        is_active: !!a.is_active,
      })));
    })();
  }, []);

  const sourceAgent = useMemo(() => agents.find(a => a.id === sourceId) ?? null, [agents, sourceId]);
  const targetAgents = useMemo(
    () => targetIds.map(id => agents.find(a => a.id === id)).filter(Boolean) as Agent[],
    [agents, targetIds],
  );
  const targetLabel = targetAgents.length === 0
    ? 'agent'
    : targetAgents.length === 1
      ? targetAgents[0].name
      : `${targetAgents.length} agents`;
  const canRun = !!sourceId && targetIds.length > 0 && !targetIds.includes(sourceId);

  /** Round-robin split of the source's lead count across the chosen receivers. */
  const splitPlan = useMemo(() => {
    const total = counts?.totalLeads ?? 0;
    return targetAgents.map((a, i) => ({
      agent: a,
      count: Math.floor(total / targetAgents.length) + (i < total % targetAgents.length ? 1 : 0),
    }));
  }, [counts, targetAgents]);


  const loadCounts = useCallback(async (agentId: string) => {
    setLoadingCounts(true);
    setCounts(null);
    try {
      const [total, open, paid, notes, quick, reminders] = await Promise.all([
        (supabase.from('sales_leads') as any).select('id', { count: 'exact', head: true }).eq('assigned_to', agentId),
        (supabase.from('sales_leads') as any).select('id', { count: 'exact', head: true }).eq('assigned_to', agentId).eq('is_paid', false).not('status', 'in', '(lost,fake_lead,converted,not_interested,dormant,archived,not_eligible)'),
        (supabase.from('sales_leads') as any).select('id', { count: 'exact', head: true }).eq('assigned_to', agentId).eq('is_paid', true),
        (supabase.from('sales_leads_changelog') as any).select('id', { count: 'exact', head: true }).eq('changed_by', agentId),
        (supabase.from('lead_quick_notes') as any).select('id', { count: 'exact', head: true }).eq('created_by', agentId),
        (supabase.from('lead_reminders') as any).select('id', { count: 'exact', head: true }).eq('assigned_to', agentId),
      ]);
      setCounts({
        totalLeads: total.count ?? 0,
        openLeads: open.count ?? 0,
        paidLeads: paid.count ?? 0,
        notes: notes.count ?? 0,
        quickNotes: quick.count ?? 0,
        reminders: reminders.count ?? 0,
      });
    } catch (e: any) {
      toast.error(e?.message || 'Could not load counts');
    } finally {
      setLoadingCounts(false);
    }
  }, []);

  useEffect(() => { if (sourceId) loadCounts(sourceId); else setCounts(null); }, [sourceId, loadCounts]);

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const { data, error } = await (supabase.from('agent_offboarding_events') as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setEvents((data ?? []) as OffboardingEvent[]);
    } catch (e: any) {
      toast.error(e?.message || 'Could not load offboarding backups');
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  useEffect(() => { if (backupsOpen) loadEvents(); }, [backupsOpen, loadEvents]);

  const runHandover = useCallback(async () => {
    if (!canRun) {
      toast.error('Pick at least one different agent to receive the leads');
      return;
    }
    setWorking(true);
    try {
      // Capture the lead ids BEFORE the handover so a multi-agent split can
      // spread exactly this batch afterwards.
      const { data: leadRows } = await (supabase.from('sales_leads') as any)
        .select('id')
        .eq('assigned_to', sourceId)
        .order('created_at', { ascending: false });
      const leadIds: string[] = (leadRows ?? []).map((r: any) => r.id);

      // Atomic: snapshot every lead + notes + reminders + changelog + call logs,
      // then reassign — all in one server-side transaction so nothing can be lost.
      const { data, error } = await (supabase as any).rpc('create_agent_offboarding_backup', {
        _source_admin_user_id: sourceId,
        _target_admin_user_id: targetIds[0],
        _reset_to_new: resetToNew,
        _also_deactivate: alsoDeactivate,
        _notes: null,
      });
      if (error) throw error;

      const moved = (data as any)?.lead_count ?? 0;

      // Multi-agent split: the backup already covers every lead, so we now
      // spread the same batch round-robin across the remaining receivers.
      if (targetIds.length > 1 && leadIds.length > 0) {
        const buckets: Record<string, string[]> = {};
        leadIds.forEach((id, i) => {
          const agentId = targetIds[i % targetIds.length];
          (buckets[agentId] ||= []).push(id);
        });
        for (const [agentId, ids] of Object.entries(buckets)) {
          if (agentId === targetIds[0]) continue; // already assigned by the RPC
          for (let i = 0; i < ids.length; i += 200) {
            const chunk = ids.slice(i, i + 200);
            const { error: upErr } = await (supabase.from('sales_leads') as any)
              .update({ assigned_to: agentId })
              .in('id', chunk);
            if (upErr) throw upErr;
          }
        }
      }

      toast.success(
        `Backed up & moved ${moved} lead${moved === 1 ? '' : 's'} to ${targetLabel}. Full history preserved.`,
      );
      setConfirmOpen(false);
      await loadCounts(sourceId);
    } catch (e: any) {
      console.error('[AgentOffboarding]', e);
      toast.error(e?.message || 'Handover failed');
    } finally {
      setWorking(false);
    }
  }, [canRun, sourceId, targetIds, resetToNew, alsoDeactivate, targetLabel, loadCounts]);

  const runDryRun = useCallback(async () => {
    if (!canRun) {
      toast.error('Pick at least one different agent to receive the leads');
      return;
    }
    setDryRunOpen(true);
    setDryRunLoading(true);
    setDryRun(null);
    try {
      const { data, error } = await (supabase as any).rpc('preview_agent_offboarding_backup', {
        _source_admin_user_id: sourceId,
        _target_admin_user_id: targetIds[0],
        _reset_to_new: resetToNew,
        _also_deactivate: alsoDeactivate,
      });
      if (error) throw error;
      setDryRun(data);
    } catch (e: any) {
      toast.error(e?.message || 'Dry run failed');
      setDryRunOpen(false);
    } finally {
      setDryRunLoading(false);
    }
  }, [canRun, sourceId, targetIds, resetToNew, alsoDeactivate]);


  const restoreEvent = useCallback(async (eventId: string) => {
    if (!confirm('Restore every lead in this backup to its original owner? Notes and history are already intact.')) return;
    setRestoringId(eventId);
    try {
      const { data, error } = await (supabase as any).rpc('restore_agent_offboarding_backup', {
        _event_id: eventId,
        _restore_to_admin_user_id: null,
      });
      if (error) throw error;
      toast.success(`Restored ${(data as any)?.restored ?? 0} leads to their original owner.`);
      await loadEvents();
      if (sourceId) await loadCounts(sourceId);
    } catch (e: any) {
      toast.error(e?.message || 'Restore failed');
    } finally {
      setRestoringId(null);
    }
  }, [loadEvents, loadCounts, sourceId]);

  return (
    <Card className="border-amber-200 dark:border-amber-900/40">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-2">
          <UserMinus className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Offboard an agent (safe handover)</h3>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1">
                <Database className="h-3 w-3" /> Full backup on every handover
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Every lead a departing agent owns is snapshotted (lead + notes + call logs + changelog + reminders)
              BEFORE the reassignment. If anything looks off later, one click restores everything to the original owner.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setBackupsOpen(true)}>
            <History className="h-4 w-4 mr-2" /> View backups
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Departing agent</label>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger><SelectValue placeholder="Pick who is leaving" /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}{!a.is_active && ' (inactive)'} — {a.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Hand everything to (one or more agents)</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" disabled={!sourceId} className="w-full justify-between font-normal">
                  <span className="truncate">
                    {targetAgents.length === 0
                      ? 'Pick the receiving agent(s)'
                      : targetAgents.map(a => a.name).join(', ')}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2 bg-popover z-50" align="start">
                <div className="max-h-64 overflow-auto space-y-1">
                  {agents.filter(a => a.id !== sourceId && a.is_active).map(a => (
                    <label key={a.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted cursor-pointer">
                      <Checkbox
                        checked={targetIds.includes(a.id)}
                        onCheckedChange={(v) =>
                          setTargetIds(prev => v ? [...prev, a.id] : prev.filter(id => id !== a.id))
                        }
                      />
                      <span className="truncate">{a.name}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {targetAgents.length > 1 && (counts?.totalLeads ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {splitPlan.map(p => (
                  <Badge key={p.agent.id} variant="outline" className="text-[11px]">
                    {p.agent.name}: {p.count}
                  </Badge>
                ))}
              </div>
            )}
          </div>

        </div>

        {sourceId && (
          <div className="rounded-md border border-border bg-muted/30 p-3">
            {loadingCounts || !counts ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Counting {sourceAgent?.name}'s workload…
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground mr-1">{sourceAgent?.name} currently owns:</span>
                <Badge variant="outline">{counts.totalLeads} total leads</Badge>
                <Badge className="bg-blue-100 text-blue-800 border-blue-200">{counts.openLeads} open</Badge>
                <Badge className="bg-green-100 text-green-800 border-green-200">{counts.paidLeads} paid / converted</Badge>
                <Badge variant="outline">{counts.notes} note events</Badge>
                <Badge variant="outline">{counts.quickNotes} quick notes</Badge>
                <Badge variant="outline">{counts.reminders} reminders</Badge>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <Checkbox checked={resetToNew} onCheckedChange={(v) => setResetToNew(!!v)} />
            Reset unpaid leads to "new" so the new owner works them fresh
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <Checkbox checked={alsoDeactivate} onCheckedChange={(v) => setAlsoDeactivate(!!v)} />
            Also deactivate the departing agent's login
          </label>
        </div>

        <div className="flex items-start gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-3 text-xs text-emerald-900 dark:text-emerald-200">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <strong>Nothing is lost.</strong> A full JSON snapshot of every lead — with its notes, call logs, changelog
            and reminders — is written to <code>agent_offboarding_lead_snapshots</code> before the handover runs.
            You can restore any offboarding from <em>View backups</em> above. Live notes stay on the lead too, so the
            new owner sees everything immediately.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={runDryRun}
            disabled={!canRun || (counts?.totalLeads ?? 0) === 0}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview handover (dry run)
          </Button>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!canRun || working || (counts?.totalLeads ?? 0) === 0}
          >
            {working ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
            Back up & hand over {counts?.totalLeads ?? 0} lead{counts?.totalLeads === 1 ? '' : 's'} to {targetLabel}

          </Button>
        </div>

        <div className="flex items-start gap-2 rounded-md bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            Use this <em>before</em> removing the agent from User Permissions. Every handover appears in
            <em> View backups</em> with a one-click restore, so we never lose track of where a departing agent's
            leads went.
          </div>
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Back up & hand {counts?.totalLeads ?? 0} lead{counts?.totalLeads === 1 ? '' : 's'} from {sourceAgent?.name} to {targetLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A full snapshot of every lead (with notes, call logs, changelog and reminders) is saved first, so this
              can be reversed from <strong>View backups</strong>.
              {counts?.paidLeads ? <> {counts.paidLeads} paid / converted lead{counts.paidLeads === 1 ? '' : 's'} will keep their status.</> : null}
              {alsoDeactivate && <> The departing agent's login will also be deactivated (reactivated automatically on restore).</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); runHandover(); }} disabled={working}>
              {working ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Yes, back up & hand over
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={backupsOpen} onOpenChange={setBackupsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" /> Agent offboarding backups
            </DialogTitle>
            <DialogDescription>
              Every handover is snapshotted here with the full lead history. Click <em>Restore</em> to move every lead
              in that backup back to its original owner.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-auto space-y-2">
            {loadingEvents ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading backups…
              </div>
            ) : events.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4">No offboarding backups yet.</div>
            ) : (
              events.map(ev => (
                <div key={ev.id} className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{ev.source_name}</span>
                    <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{ev.target_name}</span>
                    <Badge variant="outline">{ev.lead_count} leads</Badge>
                    {ev.paid_lead_count > 0 && <Badge className="bg-green-100 text-green-800 border-green-200">{ev.paid_lead_count} paid</Badge>}
                    {ev.reminder_count > 0 && <Badge variant="outline">{ev.reminder_count} reminders</Badge>}
                    {ev.also_deactivated && <Badge className="bg-amber-100 text-amber-800 border-amber-200">Login frozen</Badge>}
                    {ev.restored_at && <Badge className="bg-blue-100 text-blue-800 border-blue-200">Restored</Badge>}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {new Date(ev.created_at).toLocaleString('en-GB')}
                      {ev.executed_by_name && <> · by {ev.executed_by_name}</>}
                      {ev.restored_at && <> · restored {new Date(ev.restored_at).toLocaleString('en-GB')} ({ev.restored_lead_count ?? 0} leads)</>}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!ev.restored_at || restoringId === ev.id}
                      onClick={() => restoreEvent(ev.id)}
                    >
                      {restoringId === ev.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5 mr-1.5" />}
                      {ev.restored_at ? 'Restored' : 'Restore'}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBackupsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={dryRunOpen} onOpenChange={setDryRunOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" /> Dry run — nothing will change
            </DialogTitle>
            <DialogDescription>
              Exactly what would move if you ran the handover with these settings. No data is written.
            </DialogDescription>
          </DialogHeader>

          {dryRunLoading || !dryRun ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Simulating handover…
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{dryRun.source?.name}</span>
                <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{dryRun.target?.name}</span>
                {dryRun.options?.reset_to_new && <Badge className="bg-blue-100 text-blue-800 border-blue-200">Reset unpaid → new</Badge>}
                {dryRun.options?.also_deactivate && <Badge className="bg-amber-100 text-amber-800 border-amber-200">Would freeze login</Badge>}
              </div>

              <div className="flex flex-wrap gap-2 text-sm rounded-md border border-border bg-muted/30 p-3">
                <Badge variant="outline">{dryRun.totals?.leads ?? 0} leads move</Badge>
                <Badge className="bg-blue-100 text-blue-800 border-blue-200">{dryRun.totals?.open_leads ?? 0} open</Badge>
                <Badge className="bg-green-100 text-green-800 border-green-200">{dryRun.totals?.paid_leads ?? 0} paid</Badge>
                {dryRun.options?.reset_to_new && (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">{dryRun.totals?.leads_reset_to_new ?? 0} reset to "new"</Badge>
                )}
                <Badge variant="outline">{dryRun.totals?.reminders_moved ?? 0} open reminders reassigned</Badge>
                <Badge variant="outline">{dryRun.totals?.quick_notes_preserved ?? 0} quick notes preserved</Badge>
                <Badge variant="outline">{dryRun.totals?.changelog_preserved ?? 0} changelog entries preserved</Badge>
                <Badge variant="outline">{dryRun.totals?.call_logs_preserved ?? 0} call logs preserved</Badge>
              </div>

              <div className="max-h-[50vh] overflow-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground sticky top-0">
                    <tr className="text-left">
                      <th className="p-2">Lead</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Paid</th>
                      <th className="p-2 text-right">Quick notes</th>
                      <th className="p-2 text-right">Changelog</th>
                      <th className="p-2 text-right">Open reminders</th>
                      <th className="p-2 text-right">Calls</th>
                      <th className="p-2">Last activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dryRun.leads ?? []).map((l: any) => (
                      <tr key={l.lead_id} className="border-t border-border">
                        <td className="p-2 font-medium truncate max-w-[220px]">{l.label}</td>
                        <td className="p-2">
                          {l.will_reset_to_new ? (
                            <span><span className="line-through text-muted-foreground">{l.status}</span> → <span className="font-medium">new</span></span>
                          ) : (
                            l.status
                          )}
                        </td>
                        <td className="p-2">{l.is_paid ? 'Yes' : '—'}</td>
                        <td className="p-2 text-right">{l.quick_notes}</td>
                        <td className="p-2 text-right">{l.changelog}</td>
                        <td className="p-2 text-right">{l.reminders_open}</td>
                        <td className="p-2 text-right">{l.calls}</td>
                        <td className="p-2 text-muted-foreground">
                          {l.last_activity_date ? new Date(l.last_activity_date).toLocaleString('en-GB') : '—'}
                        </td>
                      </tr>
                    ))}
                    {(!dryRun.leads || dryRun.leads.length === 0) && (
                      <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">No leads owned by {dryRun.source?.name}.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-start gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-3 text-xs text-emerald-900 dark:text-emerald-200">
                <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                <div>This is a preview only — nothing has been written. Close this dialog and click <em>Back up &amp; hand over</em> to run it for real.</div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDryRunOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AgentOffboardingPanel;
