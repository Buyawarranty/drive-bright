import React from 'react';
import { Gauge, Bell, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { isSecondaryCrmTab } from '@/lib/crmTabCoordinator';

/**
 * Today's performance + alerts feed — read-only.
 * Splits today's leads into called quickly / called late / still waiting,
 * and raises plain-English alerts for anything that needs a nudge.
 */

const SLA_MINS = 30;

type Bucket = { quick: number; late: number; waiting: number };
type Alert = { id: string; tone: 'high' | 'medium' | 'low'; text: string; when: string };

const toneClass = (t: Alert['tone']) =>
  t === 'high'
    ? 'border-l-destructive bg-destructive/5'
    : t === 'medium'
      ? 'border-l-amber-500 bg-amber-500/5'
      : 'border-l-primary bg-primary/5';

const fmtWait = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

export const OrrPerformancePanel: React.FC = () => {
  const [bucket, setBucket] = React.useState<Bucket>({ quick: 0, late: 0, waiting: 0 });
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const [leadsRes, agentsRes, breaksRes] = await Promise.all([
        supabase
          .from('sales_leads')
          .select('id, first_name, last_name, phone, vehicle_reg, created_at, assigned_to, last_contacted_at')
          .gte('created_at', start.toISOString())
          .order('created_at', { ascending: true })
          .limit(500),
        supabase.from('admin_users').select('id, first_name, last_name, email').limit(300),
        supabase
          .from('agent_break_status')
          .select('admin_user_id, status, started_at')
          .neq('status', 'available')
          .limit(100),
      ]);

      const agentName = new Map(
        (agentsRes.data || []).map(a => [
          a.id as string,
          [a.first_name, a.last_name].filter(Boolean).join(' ') || (a.email as string) || 'Agent',
        ]),
      );

      const rows = leadsRes.data || [];
      const next: Bucket = { quick: 0, late: 0, waiting: 0 };
      const raised: Alert[] = [];

      rows.forEach(l => {
        const created = new Date(l.created_at as string).getTime();
        if (l.last_contacted_at) {
          const mins = Math.round((new Date(l.last_contacted_at as string).getTime() - created) / 60000);
          if (mins <= SLA_MINS) next.quick += 1;
          else next.late += 1;
        } else {
          next.waiting += 1;
          const waited = Math.round((Date.now() - created) / 60000);
          if (waited > SLA_MINS) {
            const who = l.assigned_to ? agentName.get(l.assigned_to as string) || 'an agent' : 'nobody yet';
            raised.push({
              id: `wait-${l.id}`,
              tone: waited > SLA_MINS * 3 ? 'high' : 'medium',
              text: `${(l.phone as string) || 'Lead'}${l.vehicle_reg ? ` (${l.vehicle_reg})` : ''} has been waiting ${fmtWait(waited)} with ${who}.`,
              when: fmtWait(waited),
            });
          }
        }
      });

      (breaksRes.data || []).forEach(b => {
        const startedAt = b.started_at ? new Date(b.started_at as string).getTime() : null;
        const mins = startedAt ? Math.round((Date.now() - startedAt) / 60000) : 0;
        if (mins >= 45) {
          raised.push({
            id: `break-${b.admin_user_id}`,
            tone: 'low',
            text: `${agentName.get(b.admin_user_id as string) || 'An agent'} has been on ${String(b.status || 'break').replace(/_/g, ' ')} for ${fmtWait(mins)}.`,
            when: fmtWait(mins),
          });
        }
      });

      raised.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'high' ? -1 : b.tone === 'high' ? 1 : a.tone === 'medium' ? -1 : 1));

      setBucket(next);
      setAlerts(raised.slice(0, 10));
    } catch (err) {
      console.error('[OrrPerformancePanel] load failed', err);
      setBucket({ quick: 0, late: 0, waiting: 0 });
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(() => { if (document.hidden || isSecondaryCrmTab()) return; load(); }, 120_000);
    return () => clearInterval(t);
  }, [load]);

  const total = bucket.quick + bucket.late + bucket.waiting;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const quickPct = pct(bucket.quick);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Today's performance */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Today's performance</h3>
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

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <div
              className="relative h-28 w-28 shrink-0 rounded-full"
              style={{
                background: `conic-gradient(hsl(var(--primary)) 0% ${quickPct}%, hsl(var(--muted)) ${quickPct}% 100%)`,
              }}
              aria-label={`${quickPct}% of today's leads called within ${SLA_MINS} minutes`}
            >
              <div className="absolute inset-[10px] rounded-full bg-card flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-foreground">{quickPct}%</span>
                <span className="text-[10px] text-muted-foreground text-center leading-tight px-2">
                  called in {SLA_MINS}m
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-2 text-sm">
              {[
                { label: `Called within ${SLA_MINS} minutes`, n: bucket.quick, dot: 'bg-primary' },
                { label: 'Called later than that', n: bucket.late, dot: 'bg-amber-500' },
                { label: 'Still waiting for a first call', n: bucket.waiting, dot: 'bg-muted-foreground/40' },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className={cn('h-2.5 w-2.5 rounded-full', r.dot)} />
                    {r.label}
                  </span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {r.n} <span className="text-xs text-muted-foreground">({pct(r.n)}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {total === 0
              ? 'No leads have arrived yet today.'
              : `${total} lead${total === 1 ? '' : 's'} in today. Target is 90% of first calls inside ${SLA_MINS} minutes.`}
          </p>
        </div>
      </div>

      {/* Alerts feed */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <Bell className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Alerts</h3>
          <span className="text-xs font-semibold text-muted-foreground">({alerts.length})</span>
        </div>

        <div className="p-4 space-y-2 max-h-[320px] overflow-y-auto">
          {alerts.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {loading ? 'Checking…' : 'All clear — nothing needs chasing right now.'}
            </p>
          )}
          {alerts.map(a => (
            <div key={a.id} className={cn('rounded-md border border-border border-l-4 px-3 py-2', toneClass(a.tone))}>
              <p className="text-sm text-foreground">{a.text}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{a.when}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
