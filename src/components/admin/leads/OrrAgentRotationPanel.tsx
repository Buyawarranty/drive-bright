import React from 'react';
import { Users, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

/**
 * Agent availability & rotation — read-only view of who is on, what they are
 * doing, where they sit in the rotation, and how they are doing on first calls.
 *
 * Rotation order follows sort_order only (never assigned_today), so nobody is
 * ever "caught up" — late starters simply rejoin at the back.
 */

type Row = {
  id: string;
  name: string;
  status: 'break' | 'lunch' | 'available' | 'paused';
  statusLabel: string;
  activity: string;
  rotationPos: number | null;
  rotationNote: string;
  leadsToday: number;
  firstCallPct: number | null;
};

const STATUS_STYLES: Record<Row['status'], string> = {
  available: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  break: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  lunch: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30',
  paused: 'bg-muted text-muted-foreground border-border',
};

export const OrrAgentRotationPanel: React.FC = () => {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const [agentsRes, capsRes, stateRes, breaksRes, leadsRes] = await Promise.all([
        supabase
          .from('admin_users')
          .select('id, first_name, last_name, email, role, is_active')
          .in('role', ['sales', 'sales_lead'])
          .eq('is_active', true)
          .limit(200),
        supabase
          .from('agent_distribution_caps')
          .select('admin_user_id, daily_cap, assigned_today, paused, sort_order')
          .limit(200),
        supabase.from('round_robin_state').select('last_assigned_user_id, updated_at').limit(10),
        supabase
          .from('agent_break_status')
          .select('admin_user_id, status, reason, started_at, expected_back_at')
          .limit(200),
        supabase
          .from('sales_leads')
          .select('assigned_to, created_at, last_contacted_at')
          .gte('created_at', start.toISOString())
          .limit(1000),
      ]);

      const agents = agentsRes.data || [];
      const caps = capsRes.data || [];
      const breaks = breaksRes.data || [];
      const leads = leadsRes.data || [];
      const lastAssigned = (stateRes.data || [])[0]?.last_assigned_user_id || null;

      const capBy = new Map(caps.map(c => [c.admin_user_id, c]));
      const breakBy = new Map(breaks.map(b => [b.admin_user_id, b]));

      // Rotation queue: unpaused agents in sort_order, starting after the last assigned.
      const queue = agents
        .filter(a => !capBy.get(a.id)?.paused)
        .sort((a, b) => (capBy.get(a.id)?.sort_order ?? 999) - (capBy.get(b.id)?.sort_order ?? 999));
      const lastIdx = queue.findIndex(a => a.id === lastAssigned);
      const order = new Map<string, number>();
      queue.forEach((a, i) => {
        const pos = ((i - lastIdx - 1 + queue.length) % queue.length) + 1;
        order.set(a.id, pos);
      });

      const built: Row[] = agents.map(a => {
        const cap = capBy.get(a.id);
        const br = breakBy.get(a.id);
        const mine = leads.filter(l => l.assigned_to === a.id);
        const contacted = mine.filter(l => !!l.last_contacted_at);
        const within30 = contacted.filter(
          l =>
            new Date(l.last_contacted_at as string).getTime() - new Date(l.created_at as string).getTime() <=
            30 * 60 * 1000,
        ).length;

        const brStatus = String(br?.status || '').toLowerCase();
        const onBreak = brStatus === 'break' || brStatus === 'on_break';
        const onLunch = brStatus === 'lunch';

        let status: Row['status'] = 'available';
        let statusLabel = 'Available';
        let activity = 'Ready for leads';

        if (cap?.paused) {
          status = 'paused';
          statusLabel = 'Not taking leads';
          activity = 'Switched off in Lead Allocation';
        } else if (onLunch) {
          status = 'lunch';
          statusLabel = 'Lunch';
          activity = br?.expected_back_at
            ? `Back at ${new Date(br.expected_back_at as string).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
            : 'On lunch';
        } else if (onBreak) {
          status = 'break';
          statusLabel = 'On break';
          activity = (br?.reason as string) || 'Away from the desk';
        }

        const pos = order.get(a.id) ?? null;

        return {
          id: a.id,
          name: [a.first_name, a.last_name].filter(Boolean).join(' ') || (a.email as string) || 'Agent',
          status,
          statusLabel,
          activity,
          rotationPos: pos,
          rotationNote:
            cap?.paused ? '—' : pos === 1 ? 'Up next' : pos === 2 ? 'Next after that' : pos ? `${pos} in line` : '—',
          leadsToday: mine.length,
          firstCallPct: contacted.length ? Math.round((within30 / contacted.length) * 100) : null,
        };
      });

      built.sort((a, b) => (a.rotationPos ?? 999) - (b.rotationPos ?? 999));
      setRows(built);
    } catch (err) {
      console.error('[OrrAgentRotationPanel] load failed', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Agent availability &amp; rotation</h3>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-background text-xs font-medium hover:bg-muted transition-colors"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="text-left font-semibold px-4 py-2">Agent</th>
              <th className="text-left font-semibold px-4 py-2">Status</th>
              <th className="text-left font-semibold px-4 py-2">Current activity</th>
              <th className="text-left font-semibold px-4 py-2">Next in rotation</th>
              <th className="text-right font-semibold px-4 py-2">Leads today</th>
              <th className="text-left font-semibold px-4 py-2 w-40">First call &lt; 30m</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {loading ? 'Loading agents…' : 'No active sales agents found.'}
                </td>
              </tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">{r.name}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                      STATUS_STYLES[r.status],
                    )}
                  >
                    {r.statusLabel}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.activity}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <span className="font-semibold text-foreground">{r.rotationPos ?? '—'}</span>{' '}
                  <span className="text-[11px] text-muted-foreground">{r.rotationNote}</span>
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-foreground">{r.leadsToday}</td>
                <td className="px-4 py-2.5">
                  {r.firstCallPct == null ? (
                    <span className="text-xs text-muted-foreground">No calls yet</span>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-foreground">{r.firstCallPct}%</div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            r.firstCallPct >= 90 ? 'bg-emerald-500' : r.firstCallPct >= 70 ? 'bg-amber-500' : 'bg-destructive',
                          )}
                          style={{ width: `${Math.min(100, r.firstCallPct)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="px-4 py-3 text-[11px] text-muted-foreground border-t border-border">
        Rotation follows the set order only. Agents keep their fair place while they are away — nobody is caught up on
        missed turns.
      </p>
    </div>
  );
};

export default OrrAgentRotationPanel;
