import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UserMinus, Loader2, ArrowRightLeft, Info, ShieldCheck } from 'lucide-react';
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

/**
 * Agent Offboarding — one-click safe handover of a departing agent's
 * entire workload (leads + notes + reminders stay intact, only the
 * assigned_to changes) to another agent, before deactivating them
 * in User Permissions.
 *
 * Notes and call history live on the lead itself (sales_leads_changelog,
 * lead_quick_notes, lead_call_logs), so simply moving assigned_to
 * preserves the full history for the new owner.
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

  const runHandover = useCallback(async () => {
    if (!sourceId || !targetId || sourceId === targetId) {
      toast.error('Pick a different agent to receive the leads');
      return;
    }
    setWorking(true);
    try {
      const now = new Date().toISOString();

      // 1. Move ALL leads (paid keep their status; unpaid can optionally reset to 'new')
      const { data: leadRows, error: leadErr } = await (supabase.from('sales_leads') as any)
        .update({ assigned_to: targetId, assigned_at: now, last_activity_date: now })
        .eq('assigned_to', sourceId)
        .select('id, is_paid');
      if (leadErr) throw leadErr;

      const unpaidIds = (leadRows ?? []).filter((r: any) => !r.is_paid).map((r: any) => r.id);
      if (resetToNew && unpaidIds.length) {
        await (supabase.from('sales_leads') as any)
          .update({ status: 'new' })
          .in('id', unpaidIds);
      }

      // 2. Move outstanding reminders
      await (supabase.from('lead_reminders') as any)
        .update({ assigned_to: targetId })
        .eq('assigned_to', sourceId)
        .eq('is_completed', false);

      // 3. Optional: freeze the departing agent
      if (alsoDeactivate) {
        await (supabase.from('admin_users') as any)
          .update({ is_active: false })
          .eq('id', sourceId);
      }

      toast.success(
        `Moved ${leadRows?.length ?? 0} leads to ${targetAgent?.name}. All notes & history preserved on the leads.`,
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

  return (
    <Card className="border-amber-200 dark:border-amber-900/40">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-2">
          <UserMinus className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">Offboard an agent (safe handover)</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Move every lead a departing agent owns to another agent in one click. Notes, call history, quick
              notes and reminders stay attached to the lead — nothing is lost.
            </p>
          </div>
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
            Notes, call logs, changelog history, quick notes and version snapshots all live on the lead
            (not the agent), so they follow the lead automatically. The departing agent's sales record in
            Customer Management is preserved even if you deactivate their login.
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!sourceId || !targetId || sourceId === targetId || working || (counts?.totalLeads ?? 0) === 0}
          >
            {working ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
            Hand over {counts?.totalLeads ?? 0} lead{counts?.totalLeads === 1 ? '' : 's'} to {targetAgent?.name || 'agent'}
          </Button>
        </div>

        <div className="flex items-start gap-2 rounded-md bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            Tip: use this <em>before</em> removing the agent from User Permissions. It's the same as the manual
            Bulk Reassign flow, just scoped to every lead the agent still owns.
          </div>
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Hand {counts?.totalLeads ?? 0} lead{counts?.totalLeads === 1 ? '' : 's'} from {sourceAgent?.name} to {targetAgent?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              All notes, call history and reminders stay with each lead — only the assigned owner changes.
              {counts?.paidLeads ? <> {counts.paidLeads} paid / converted lead{counts.paidLeads === 1 ? '' : 's'} will keep their status.</> : null}
              {alsoDeactivate && <> The departing agent's login will also be deactivated.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); runHandover(); }} disabled={working}>
              {working ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Yes, hand over
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default AgentOffboardingPanel;
