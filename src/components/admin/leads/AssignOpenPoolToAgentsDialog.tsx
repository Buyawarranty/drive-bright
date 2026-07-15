import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poolCount: number;
  onAssigned?: () => void;
}

interface AgentRow {
  admin_user_id: string;
  name: string;
  mode: 'round_robin' | 'open_pool';
  selected: boolean;
  count: number;
}

/**
 * Manager-facing dialog: split Open Pool leads across one or more active agents
 * in a single action. Uses the same `open_pool_bulk_assign_to_agent` RPC per
 * agent so downstream logic (audit trail, timers, RLS) stays identical.
 */
export function AssignOpenPoolToAgentsDialog({ open, onOpenChange, poolCount, onAssigned }: Props) {
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Bulk-assigned leads always stick to the target agent (no call-window timer)
  // so they can just start ringing through the list — no popup, no accept step,
  // no risk of the lead silently returning to the pool if not accepted in time.
  const noTimer = true;
  const minutes = 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: caps } = await (supabase as any)
        .from('agent_distribution_caps')
        .select('admin_user_id, assignment_mode, paused')
        .eq('paused', false)
        .in('assignment_mode', ['round_robin', 'open_pool']);

      const ids = (caps ?? []).map((c: any) => c.admin_user_id);
      if (ids.length === 0) {
        setRows([]);
        return;
      }

      const { data: users } = await supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, is_active')
        .in('id', ids);

      const byId = new Map((users ?? []).map(u => [u.id, u]));
      const built: AgentRow[] = (caps ?? [])
        .map((c: any) => {
          const u = byId.get(c.admin_user_id) as any;
          if (!u || !u.is_active) return null;
          const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
          return {
            admin_user_id: c.admin_user_id,
            name,
            mode: c.assignment_mode as 'round_robin' | 'open_pool',
            selected: false,
            count: 0,
          };
        })
        .filter(Boolean) as AgentRow[];

      built.sort((a, b) => {
        if (a.mode !== b.mode) return a.mode === 'round_robin' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      setRows(built);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const totalRequested = useMemo(
    () => rows.filter(r => r.selected).reduce((sum, r) => sum + (r.count || 0), 0),
    [rows],
  );
  const selectedCount = rows.filter(r => r.selected).length;

  const splitEvenly = () => {
    const selectable = rows.filter(r => r.selected);
    if (selectable.length === 0 || poolCount === 0) return;
    const base = Math.floor(poolCount / selectable.length);
    const remainder = poolCount - base * selectable.length;
    let idx = 0;
    setRows(rs =>
      rs.map(r => {
        if (!r.selected) return r;
        const extra = idx < remainder ? 1 : 0;
        idx += 1;
        return { ...r, count: base + extra };
      }),
    );
  };

  const submit = async () => {
    if (totalRequested <= 0) return;
    setSubmitting(true);
    let totalAssigned = 0;
    let failed = 0;
    const windowMinutes = noTimer ? 0 : Math.max(5, Math.min(240, minutes || 30));
    try {
      for (const r of rows) {
        if (!r.selected || r.count <= 0) continue;
        const { data, error } = await (supabase as any).rpc('open_pool_bulk_assign_to_agent', {
          _target_admin_id: r.admin_user_id,
          _count: r.count,
          _window_minutes: windowMinutes,
        });
        if (error) {
          failed += 1;
          console.error('bulk assign failed for', r.name, error);
          continue;
        }
        const row = Array.isArray(data) ? data[0] : data;
        totalAssigned += row?.assigned_count ?? 0;
      }

      if (totalAssigned === 0 && failed === 0) {
        toast({
          title: 'No leads available',
          description: 'The Open Pool has no leads ready to assign right now.',
        });
      } else {
        toast({
          title: `Assigned ${totalAssigned} lead${totalAssigned === 1 ? '' : 's'}`,
          description: failed > 0
            ? `${failed} agent${failed === 1 ? '' : 's'} failed — check console.`
            : (noTimer
              ? 'Leads stay with each agent until they log an outcome.'
              : `Each lead has a ${windowMinutes}-minute call window.`),
          variant: failed > 0 ? 'destructive' : 'default',
        });
      }
      onAssigned?.();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Open Pool leads to agents</DialogTitle>
          <DialogDescription>
            {poolCount} lead{poolCount === 1 ? '' : 's'} available. Tick agents, set how many each
            should receive, then assign.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {selectedCount} agent{selectedCount === 1 ? '' : 's'} selected · {totalRequested} lead{totalRequested === 1 ? '' : 's'} to assign
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={splitEvenly}
              disabled={selectedCount === 0 || poolCount === 0}
              className="h-7 text-xs"
            >
              <Users className="h-3.5 w-3.5 mr-1" />
              Split all {poolCount} evenly
            </Button>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border">
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Loading agents…
              </div>
            ) : rows.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No active round-robin or open-pool agents.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 w-8"></th>
                    <th className="text-left px-3 py-2">Agent</th>
                    <th className="text-left px-3 py-2">Mode</th>
                    <th className="text-right px-3 py-2 w-28">Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.admin_user_id} className="border-t">
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={r.selected}
                          onCheckedChange={(v) =>
                            setRows(rs => rs.map((x, xi) => xi === i
                              ? { ...x, selected: !!v, count: !!v && x.count === 0 ? 1 : x.count }
                              : x))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {r.mode === 'round_robin' ? 'Round Robin' : 'Open Pool'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          type="number"
                          min={0}
                          max={50}
                          value={r.count}
                          disabled={!r.selected}
                          onChange={(e) => {
                            const n = Math.max(0, Math.min(50, Number(e.target.value) || 0));
                            setRows(rs => rs.map((x, xi) => xi === i ? { ...x, count: n } : x));
                          }}
                          className="h-8 w-20 ml-auto text-right"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-md border p-3 space-y-1 bg-muted/30">
            <p className="text-sm font-medium">Leads assign directly to the agent.</p>
            <p className="text-[11px] text-muted-foreground">
              No popup, no accept step — bulk-assigned leads land straight in the agent's leads list
              so they can start dialling immediately. Each agent can receive up to 50 leads per
              assignment (RPC limit).
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || totalRequested <= 0}>
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Assigning…</>
            ) : (
              <>Assign {totalRequested} lead{totalRequested === 1 ? '' : 's'}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AssignOpenPoolToAgentsDialog;
