import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UserMinus, Loader2, ArrowRightLeft, Info, ShieldCheck, History, Undo2, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  const [targetId, setTargetId] = useState<string>('');
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
  const targetAgent = useMemo(() => agents.find(a => a.id === targetId) ?? null, [agents, targetId]);

  const loadCounts = useCallback(async (agentId: string) => {
    setLoadingCounts(true);
    setCounts(null);
    try {
      const [total, open, paid, notes, quick, reminders] = await Promise.all([
        (supabase.from('sales_leads') as any).select('id', { count: 'exact', head: true }).eq('assigned_to', agentId),
        (supabase.from('sales_leads') as any).select('id', { count: 'exact', head: true }).eq('assigned_to', agentId).eq('is_paid', false).not('status', 'in', '(lost,fake_lead,converted,not_interested,dormant,archived)'),
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
    if (!sourceId || !targetId || sourceId === targetId) {
      toast.error('Pick a different agent to receive the leads');
      return;
    }
    setWorking(true);
    try {
      // Atomic: snapshot every lead + notes + reminders + changelog + call logs,
      // then reassign — all in one server-side transaction so nothing can be lost.
      const { data, error } = await (supabase as any).rpc('create_agent_offboarding_backup', {
        _source_admin_user_id: sourceId,
        _target_admin_user_id: targetId,
        _reset_to_new: resetToNew,
        _also_deactivate: alsoDeactivate,
        _notes: null,
      });
      if (error) throw error;

      const moved = (data as any)?.lead_count ?? 0;
      toast.success(
        `Backed up & moved ${moved} lead${moved === 1 ? '' : 's'} to ${targetAgent?.name}. Full history preserved.`,
      );
      setConfirmOpen(false);
      await loadCounts(sourceId);
    } catch (e: any) {
      console.error('[AgentOffboarding]', e);
      toast.error(e?.message || 'Handover failed');
    } finally {
      setWorking(false);
    }
  }, [sourceId, targetId, resetToNew, alsoDeactivate, targetAgent, loadCounts]);

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
              <h3 className="text-base font-semibold text-foreground">Offboard an agent (safe handover)</h3>
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
            <label className="text-xs font-medium text-muted-foreground">Hand everything to</label>
            <Select value={targetId} onValueChange={setTargetId} disabled={!sourceId}>
              <SelectTrigger><SelectValue placeholder="Pick the receiving agent" /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {agents.filter(a => a.id !== sourceId && a.is_active).map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name} — {a.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            onClick={() => setConfirmOpen(true)}
            disabled={!sourceId || !targetId || sourceId === targetId || working || (counts?.totalLeads ?? 0) === 0}
          >
            {working ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
            Back up & hand over {counts?.totalLeads ?? 0} lead{counts?.totalLeads === 1 ? '' : 's'} to {targetAgent?.name || 'agent'}
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
              Back up & hand {counts?.totalLeads ?? 0} lead{counts?.totalLeads === 1 ? '' : 's'} from {sourceAgent?.name} to {targetAgent?.name}?
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
    </Card>
  );
};

export default AgentOffboardingPanel;
