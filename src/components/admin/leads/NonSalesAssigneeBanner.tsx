import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

type SalesAgent = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type MisassignedLead = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  assigned_to: string | null;
  assignee_email: string | null;
  assignee_role: string | null;
};

interface Props {
  /** Sales agents eligible to receive recontact leads (from LeadRecoveryTab). */
  agents: SalesAgent[];
  /** Role of the currently signed-in admin. Banner only renders for management. */
  currentRole: string | null;
  /** Called after a bulk reassign / unassign so the parent can refresh its list. */
  onReassigned?: () => void;
}

/**
 * Red warning banner shown at the top of the Recontact Leads tab whenever any
 * recontact-eligible lead is currently assigned to a non-sales account (e.g.
 * info@ / support@ / claims@ / a super_admin who isn't actually selling). This
 * situation used to silently break agents (e.g. Freddie couldn't see leads
 * that had been assigned to info@ in his name) — now a manager can spot and
 * fix them in one click.
 *
 * Only rendered for management (admin, super_admin, sales_manager, sales_lead).
 */
export const NonSalesAssigneeBanner: React.FC<Props> = ({ agents, currentRole, onReassigned }) => {
  const [count, setCount] = useState<number>(0);
  const [sample, setSample] = useState<MisassignedLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetAgentId, setTargetAgentId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const canSee =
    currentRole === 'admin' ||
    currentRole === 'super_admin' ||
    currentRole === 'sales_manager' ||
    currentRole === 'sales_lead';

  const scan = useCallback(async () => {
    if (!canSee) return;
    setLoading(true);
    try {
      // Pull every admin_user that ISN'T a sales seat. Anything assigned to
      // one of these ids on the Recontact list is invisible to the intended
      // sales agent — that's the bug we're surfacing.
      const { data: nonSales, error: err1 } = await (supabase.from('admin_users') as any)
        .select('id, email, role')
        .not('role', 'in', '(sales,sales_lead)');
      if (err1) throw err1;
      const nonSalesIds = ((nonSales as any[]) || []).map((r) => r.id);
      const idToInfo = new Map<string, { email: string | null; role: string | null }>(
        ((nonSales as any[]) || []).map((r) => [r.id, { email: r.email, role: r.role }]),
      );
      if (nonSalesIds.length === 0) {
        setCount(0);
        setSample([]);
        return;
      }

      // Same eligibility filter as the Recontact list (30d+, step 2 done,
      // not paid, not new/converted/fake/archived). We only want to flag
      // leads that a sales agent SHOULD be seeing on this tab.
      const d30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const base = (supabase.from('sales_leads') as any)
        .not('step_two_completed_at', 'is', null)
        .not('status', 'in', '(new,converted,fake_lead,archived)')
        .or('is_paid.is.null,is_paid.eq.false')
        .lt('created_at', d30)
        .in('assigned_to', nonSalesIds);

      const [{ count: total }, { data: rows }] = await Promise.all([
        base.select('id', { count: 'exact', head: true }),
        (supabase.from('sales_leads') as any)
          .select('id, first_name, last_name, email, assigned_to')
          .not('step_two_completed_at', 'is', null)
          .not('status', 'in', '(new,converted,fake_lead,archived)')
          .or('is_paid.is.null,is_paid.eq.false')
          .lt('created_at', d30)
          .in('assigned_to', nonSalesIds)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      setCount(total || 0);
      setSample(
        ((rows as any[]) || []).map((r) => ({
          ...r,
          assignee_email: idToInfo.get(r.assigned_to)?.email ?? null,
          assignee_role: idToInfo.get(r.assigned_to)?.role ?? null,
        })),
      );
    } catch (e: any) {
      // Silent — the banner is a nice-to-have, don't spam toasts on scan.
      console.warn('[NonSalesAssigneeBanner] scan failed', e);
    } finally {
      setLoading(false);
    }
  }, [canSee]);

  useEffect(() => { scan(); }, [scan]);

  const targetAgent = useMemo(
    () => agents.find((a) => a.id === targetAgentId),
    [agents, targetAgentId],
  );

  const runBulkUpdate = useCallback(async (mode: 'unassign' | 'reassign') => {
    if (mode === 'reassign' && !targetAgentId) {
      toast.error('Pick a sales agent first');
      return;
    }
    setSaving(true);
    try {
      const { data: nonSales } = await (supabase.from('admin_users') as any)
        .select('id')
        .not('role', 'in', '(sales,sales_lead)');
      const nonSalesIds = ((nonSales as any[]) || []).map((r) => r.id);
      if (nonSalesIds.length === 0) {
        toast.info('Nothing to fix — no non-sales assignees found');
        setDialogOpen(false);
        return;
      }

      const d30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const payload =
        mode === 'unassign'
          ? { assigned_to: null, assigned_at: null }
          : { assigned_to: targetAgentId, assigned_at: new Date().toISOString() };

      const { error, count: updated } = await (supabase.from('sales_leads') as any)
        .update(payload, { count: 'exact' })
        .not('step_two_completed_at', 'is', null)
        .not('status', 'in', '(new,converted,fake_lead,archived)')
        .or('is_paid.is.null,is_paid.eq.false')
        .lt('created_at', d30)
        .in('assigned_to', nonSalesIds);

      if (error) throw error;
      toast.success(
        mode === 'unassign'
          ? `Unassigned ${updated ?? count} lead${(updated ?? count) === 1 ? '' : 's'} — they're back in the pool`
          : `Assigned ${updated ?? count} lead${(updated ?? count) === 1 ? '' : 's'} to ${
              [targetAgent?.first_name, targetAgent?.last_name].filter(Boolean).join(' ').trim() ||
              targetAgent?.email ||
              'agent'
            }`,
      );
      setDialogOpen(false);
      setTargetAgentId('');
      await scan();
      onReassigned?.();
    } catch (e: any) {
      toast.error(e?.message || 'Bulk reassignment failed');
    } finally {
      setSaving(false);
    }
  }, [targetAgentId, targetAgent, count, scan, onReassigned]);

  if (!canSee) return null;
  if (!loading && count === 0) return null;

  return (
    <>
      <div className="rounded-md border-2 border-red-400 bg-red-50 px-4 py-3 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-red-900">
                {loading ? 'Scanning…' : `${count} recontact lead${count === 1 ? '' : 's'} assigned to a non-sales account`}
              </span>
              {!loading && count > 0 && (
                <span className="text-[11px] font-medium uppercase tracking-wide bg-red-200 text-red-900 rounded px-1.5 py-0.5">
                  invisible to sales agents
                </span>
              )}
            </div>
            <p className="text-xs text-red-800/90 mt-0.5">
              These leads are stuck on inboxes or admin accounts (e.g. info@, support@, claims@)
              — the sales agent they belong to can't see them until they're reassigned.
            </p>
            {sample.length > 0 && (
              <div className="mt-2 text-[11px] text-red-900/80 space-y-0.5">
                {sample.slice(0, 3).map((l) => (
                  <div key={l.id} className="truncate">
                    <span className="font-medium">{[l.first_name, l.last_name].filter(Boolean).join(' ') || l.email || 'Lead'}</span>
                    <span className="text-red-800/70"> → sitting on {l.assignee_email || '(unknown)'} ({l.assignee_role || '—'})</span>
                  </div>
                ))}
                {count > sample.length && (
                  <div className="text-red-800/70">…and {count - sample.length} more.</div>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-red-400 text-red-800 hover:bg-red-100"
              onClick={scan}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Rescan
            </Button>
            <Button
              size="sm"
              className="h-8 bg-red-600 hover:bg-red-700 text-white"
              onClick={() => setDialogOpen(true)}
              disabled={loading || count === 0}
            >
              Fix now
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Reassign {count} recontact lead{count === 1 ? '' : 's'}
            </DialogTitle>
            <DialogDescription>
              These leads are currently sitting on non-sales accounts. Pick a sales
              agent to receive them, or send them back to the unassigned pool so
              the whole floor can pick them up.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-1">
            <label className="text-xs font-medium text-muted-foreground">Move to sales agent</label>
            <Select value={targetAgentId} onValueChange={setTargetAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a sales agent…" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => {
                  const name = [a.first_name, a.last_name].filter(Boolean).join(' ').trim();
                  return (
                    <SelectItem key={a.id} value={a.id}>
                      {name || a.email || 'Agent'}
                    </SelectItem>
                  );
                })}
                {agents.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No sales agents available
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => runBulkUpdate('unassign')}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Unassign all (back to pool)
            </Button>
            <Button
              type="button"
              onClick={() => runBulkUpdate('reassign')}
              disabled={saving || !targetAgentId}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Reassign to selected
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NonSalesAssigneeBanner;
