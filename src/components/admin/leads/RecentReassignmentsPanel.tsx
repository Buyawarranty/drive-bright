import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Undo2, RefreshCw, ArrowRight, Clock, History } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Batch {
  batch_key: string;
  changed_by: string | null;
  old_assigned_to: string | null;
  new_assigned_to: string | null;
  bucket_start: string;
  first_changed_at: string;
  last_changed_at: string;
  lead_count: number;
  still_on_new_count: number;
}

interface AgentMap { [id: string]: string }

const HOURS_WINDOW = 24;

export const RecentReassignmentsPanel: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [agents, setAgents] = useState<AgentMap>({});
  const [loading, setLoading] = useState(true);
  const [undoing, setUndoing] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    const { data } = await supabase.from('admin_users').select('id, first_name, last_name, email');
    const map: AgentMap = {};
    (data || []).forEach((a: any) => {
      map[a.id] = `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email || 'Unknown';
    });
    setAgents(map);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('list_recent_bulk_reassignments', {
      p_hours: HOURS_WINDOW,
      p_min_batch: 3,
    });
    if (error) {
      toast.error(error.message || 'Failed to load recent reassignments');
    } else {
      setBatches((data as Batch[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAgents(); load(); }, [loadAgents, load]);

  const name = (id: string | null) => (id ? (agents[id] || id.slice(0, 8)) : 'Unassigned');

  const undo = async (b: Batch) => {
    setUndoing(b.batch_key);
    try {
      const { data, error } = await supabase.rpc('undo_bulk_reassignment', {
        p_changed_by: b.changed_by,
        p_old_assigned_to: b.old_assigned_to,
        p_new_assigned_to: b.new_assigned_to,
        p_bucket_start: b.bucket_start,
      });
      if (error) throw error;
      const r = data as { success: boolean; reverted?: number; error?: string; note?: string };
      if (!r.success) throw new Error(r.error || 'Undo failed');
      toast.success(`Reverted ${r.reverted || 0} lead${r.reverted === 1 ? '' : 's'} back to ${name(b.old_assigned_to)}`);
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Undo failed');
    } finally {
      setUndoing(null);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="px-5 py-4 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2 min-w-0">
          <History className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">Recent Reassignments (Undo)</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Bulk lead reassignments from the last {HOURS_WINDOW} hours. If a batch was done in error,
              hit Undo to send the leads back to the original agent. Only leads still sitting with the
              new agent (and not in a terminal status) are moved.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="border-t border-border">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : batches.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No bulk reassignments in the last {HOURS_WINDOW} hours.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {batches.map((b) => {
              const canUndo = b.still_on_new_count > 0;
              return (
                <li key={b.batch_key} className="px-5 py-3 flex flex-wrap items-center gap-3 justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {b.lead_count} lead{b.lead_count === 1 ? '' : 's'}
                      </Badge>
                      <span className="text-red-600 font-medium truncate">{name(b.old_assigned_to)}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-green-700 font-medium truncate">{name(b.new_assigned_to)}</span>
                      {b.still_on_new_count !== b.lead_count && (
                        <Badge variant="outline" className="text-[10px]">
                          {b.still_on_new_count} still revertible
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                      <Clock className="h-3 w-3" />
                      <span>{formatDistanceToNow(new Date(b.last_changed_at), { addSuffix: true })}</span>
                      <span>·</span>
                      <span>{format(new Date(b.last_changed_at), 'dd MMM HH:mm')}</span>
                      <span>·</span>
                      <span>by {name(b.changed_by)}</span>
                    </div>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-amber-400 text-amber-800 hover:bg-amber-50"
                        disabled={!canUndo || undoing === b.batch_key}
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        {undoing === b.batch_key ? 'Undoing…' : 'Undo'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Undo this reassignment?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will move up to <strong>{b.still_on_new_count}</strong> lead
                          {b.still_on_new_count === 1 ? '' : 's'} from{' '}
                          <strong>{name(b.new_assigned_to)}</strong> back to{' '}
                          <strong>{name(b.old_assigned_to)}</strong>. Leads that were reassigned
                          again since, or that reached a terminal status (lost, fake, converted),
                          are left alone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => undo(b)}>Undo reassignment</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};
