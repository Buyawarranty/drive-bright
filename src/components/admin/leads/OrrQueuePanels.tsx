import React from 'react';
import { Clock, Sunrise, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { isSecondaryCrmTab } from '@/lib/crmTabCoordinator';

/**
 * Live lead queue + morning queue — read-only waiting views for Open Round Robin.
 * Shows who is waiting, how long, where they came from and who holds them.
 * No writes, no assignment actions.
 */

type QueueLead = {
  id: string;
  name: string;
  phone: string;
  reg: string;
  source: string;
  waitMins: number;
  createdAt: string;
  agent: string;
};

const SLA_MINS = 30;

const fmtWait = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

const waitClass = (m: number) =>
  m > SLA_MINS ? 'text-destructive font-semibold' : m > SLA_MINS * 0.6 ? 'text-amber-600 font-semibold' : 'text-foreground';

export const OrrQueuePanels: React.FC = () => {
  const [leads, setLeads] = React.useState<QueueLead[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const [leadsRes, agentsRes] = await Promise.all([
        supabase
          .from('sales_leads')
          .select('id, first_name, last_name, phone, vehicle_reg, lead_source, created_at, assigned_to, last_contacted_at')
          .gte('created_at', start.toISOString())
          .is('last_contacted_at', null)
          .order('created_at', { ascending: true })
          .limit(200),
        supabase.from('admin_users').select('id, first_name, last_name, email').limit(300),
      ]);

      const agentName = new Map(
        (agentsRes.data || []).map(a => [
          a.id,
          [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || 'Agent',
        ]),
      );

      const rows: QueueLead[] = (leadsRes.data || []).map(l => ({
        id: l.id as string,
        name: [l.first_name, l.last_name].filter(Boolean).join(' ') || 'No name yet',
        phone: (l.phone as string) || '—',
        reg: (l.vehicle_reg as string) || '—',
        source: (l.lead_source as string) || 'unknown',
        createdAt: l.created_at as string,
        waitMins: Math.max(0, Math.round((Date.now() - new Date(l.created_at as string).getTime()) / 60000)),
        agent: l.assigned_to ? agentName.get(l.assigned_to as string) || 'Unknown agent' : 'Unassigned',
      }));

      setLeads(rows);
    } catch (err) {
      console.error('[OrrQueuePanels] load failed', err);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(() => { if (document.hidden || isSecondaryCrmTab()) return; load(); }, 120_000);
    return () => clearInterval(t);
  }, [load]);

  const morning = leads.filter(l => new Date(l.createdAt).getHours() < 12);
  const oldest = leads.length ? Math.max(...leads.map(l => l.waitMins)) : null;
  const morningOldest = morning.length ? Math.max(...morning.map(l => l.waitMins)) : null;
  const onTrack = oldest == null || oldest <= SLA_MINS;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Live lead queue */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Live lead queue</h3>
            <span className="text-xs font-semibold text-muted-foreground">({leads.length})</span>
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
                <th className="text-left font-semibold px-4 py-2">Wait time</th>
                <th className="text-left font-semibold px-4 py-2">Lead</th>
                <th className="text-left font-semibold px-4 py-2">Source</th>
                <th className="text-left font-semibold px-4 py-2">Held by</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {loading ? 'Loading queue…' : 'Nothing waiting — every lead today has had a first contact.'}
                  </td>
                </tr>
              )}
              {leads.slice(0, 8).map(l => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className={cn('px-4 py-2.5 whitespace-nowrap', waitClass(l.waitMins))}>{fmtWait(l.waitMins)}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-foreground">{l.phone}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {l.name}
                      {l.reg !== '—' ? ` · ${l.reg}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground capitalize">{l.source.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2.5 text-foreground">{l.agent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="px-4 py-3 text-[11px] text-muted-foreground border-t border-border">
          Leads wait with the agent they were given to. They do not rotate repeatedly.
          {leads.length > 8 ? ` Showing the 8 longest waits of ${leads.length}.` : ''}
        </p>
      </div>

      {/* Morning queue */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <Sunrise className="h-4 w-4 text-amber-500" />
          <h3 className="text-base font-semibold text-foreground">Morning leads queue</h3>
          <span className="text-xs font-semibold text-muted-foreground">({morning.length})</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
          <div className="rounded-md border border-border bg-background p-3">
            <div className="text-[11px] font-medium text-muted-foreground">Total in queue</div>
            <div className="text-xl font-bold text-foreground mt-1">{morning.length}</div>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <div className="text-[11px] font-medium text-muted-foreground">Oldest lead</div>
            <div className={cn('text-xl font-bold mt-1', morningOldest != null && morningOldest > SLA_MINS ? 'text-destructive' : 'text-foreground')}>
              {morningOldest == null ? '—' : fmtWait(morningOldest)}
            </div>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <div className="text-[11px] font-medium text-muted-foreground">On track</div>
            <div className={cn('text-xl font-bold mt-1', onTrack ? 'text-emerald-600' : 'text-destructive')}>
              {onTrack ? 'Yes' : 'No'}
            </div>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <div className="text-[11px] font-medium text-muted-foreground">SLA target</div>
            <div className="text-xl font-bold text-foreground mt-1">&lt; {SLA_MINS}m</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="text-left font-semibold px-4 py-2">Position</th>
                <th className="text-left font-semibold px-4 py-2">Lead</th>
                <th className="text-left font-semibold px-4 py-2">Wait</th>
                <th className="text-left font-semibold px-4 py-2">Source</th>
                <th className="text-left font-semibold px-4 py-2">Status</th>
                <th className="text-left font-semibold px-4 py-2">Assigned to</th>
              </tr>
            </thead>
            <tbody>
              {morning.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {loading ? 'Loading morning queue…' : 'Morning queue is clear.'}
                  </td>
                </tr>
              )}
              {morning.slice(0, 6).map((l, i) => {
                const atRisk = l.waitMins > SLA_MINS;
                return (
                  <tr key={l.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">{l.name}</div>
                      <div className="text-[11px] text-muted-foreground">{l.phone}</div>
                    </td>
                    <td className={cn('px-4 py-2.5 whitespace-nowrap', waitClass(l.waitMins))}>{fmtWait(l.waitMins)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground capitalize">{l.source.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                          atRisk
                            ? 'bg-destructive/10 text-destructive border-destructive/30'
                            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
                        )}
                      >
                        {atRisk ? 'Past window' : 'Good'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-foreground">{l.agent}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {morning.length > 6 && (
          <p className="px-4 py-3 text-[11px] text-muted-foreground border-t border-border">
            Showing the 6 longest waits of {morning.length} morning leads.
          </p>
        )}
      </div>
    </div>
  );
};

export default OrrQueuePanels;
