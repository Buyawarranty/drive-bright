import React from 'react';
import { Play, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TimeToContactCell } from '@/components/admin/leads/TimeToContactCell';
import { useSandboxLiveLeads } from '@/hooks/useSandboxLiveLeads';
import { useOrrSandboxAllocations } from '@/hooks/useOrrSandboxAllocations';
import { useLeadResponseTime } from '@/hooks/useLeadResponseTime';

/**
 * Practice pass over the genuine live leads.
 *
 * Reads real leads (SELECT only) and writes the simulated owner to
 * `orr_sandbox_allocations`. No live lead, agent figure or notification changes.
 */
export const OrrSandboxPassPanel: React.FC = () => {
  const { leads, loading, refresh } = useSandboxLiveLeads(true, { window: 'recent', limit: 40 });
  const { allocations, candidates, running, simulate, clearAll, error } = useOrrSandboxAllocations(true);

  const nameById = React.useMemo(
    () => Object.fromEntries(candidates.map(c => [c.adminUserId, c.name])),
    [candidates],
  );

  const run = async () => {
    const ids = leads.map(l => l.id);
    const { assigned } = await simulate(ids);
    toast.success(`Practice pass done — ${assigned} of ${ids.length} leads placed. Nothing live changed.`);
  };

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Practice pass over today's real leads</h3>
          <p className="text-xs text-muted-foreground">
            Uses the same teams, caps and on/off switches as the Lead Allocation page. It only records who{' '}
            <em>would</em> get each lead.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={run} disabled={running || loading || !leads.length}>
            {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
            Run Open Round Robin now
          </Button>
          <Button size="sm" variant="outline" onClick={async () => { await clearAll(); await refresh(); }} disabled={running}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Clear practice run
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {candidates.map(c => {
          const count = Object.values(allocations).filter(a => a.agentId === c.adminUserId).length;
          return (
            <Badge key={c.adminUserId} variant="outline" className="text-xs">
              {c.name}: {count} practice {count === 1 ? 'lead' : 'leads'}
              {c.dailyCap > 0 && <span className="text-muted-foreground"> · cap {c.dailyCap}</span>}
            </Badge>
          );
        })}
        {!candidates.length && (
          <p className="text-xs text-muted-foreground">
            No agents are switched on for distribution, so there is nobody to practise with yet.
          </p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr className="text-left">
              <th className="py-1 pr-3">Lead</th>
              <th className="py-1 pr-3">Arrived</th>
              <th className="py-1 pr-3">Really assigned to</th>
              <th className="py-1">Would go to (practice)</th>
            </tr>
          </thead>
          <tbody>
            {leads.slice(0, 20).map(l => {
              const sim = allocations[l.id];
              return (
                <tr key={l.id} className="border-t border-border/60">
                  <td className="py-1.5 pr-3 font-medium">
                    {[l.firstName, l.lastName].filter(Boolean).join(' ') || l.email || l.reg || 'Lead'}
                  </td>
                  <td className="py-1.5 pr-3 text-muted-foreground">
                    {l.createdAt.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-1.5 pr-3 text-muted-foreground">
                    {l.assignedTo ? (nameById[l.assignedTo] || 'An agent') : 'Nobody yet'}
                  </td>
                  <td className="py-1.5">
                    {sim?.agentId ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="font-medium">{nameById[sim.agentId] || 'Agent'}</span>
                        <Badge variant="secondary" className="text-[10px]">Practice</Badge>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{sim?.reason || 'Not run yet'}</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && !leads.length && (
              <tr>
                <td colSpan={4} className="py-3 text-muted-foreground">No leads in the last 7 days.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrrSandboxPassPanel;
