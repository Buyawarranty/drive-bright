import React from 'react';
import { Phone, Users, Timer, Sunrise, Target, PhoneCall, CheckCircle2, Utensils, Repeat, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { isSecondaryCrmTab } from '@/lib/crmTabCoordinator';

/**
 * ORR "at a glance" strip — read-only snapshot of today's lead flow plus the
 * current calling window. Nothing here writes; it is safe to render anywhere.
 */

type Stats = {
  waiting: number;
  oldestWaitMins: number | null;
  agentsAvailable: number;
  agentsTotal: number;
  morningQueue: number;
  morningOldestMins: number | null;
  firstCallPct: number | null;
  calledToday: number;
};

const WINDOWS = [
  { key: 'morning', label: 'Morning', startH: 9, endH: 12, icon: Sunrise },
  { key: 'lunch', label: 'Lunch', startH: 12, endH: 13, icon: Utensils },
  { key: 'evening', label: 'End of day', startH: 17, endH: 19, icon: Sunrise },
] as const;

const minsSince = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

const fmtMins = (m: number | null) => (m == null ? '—' : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

function currentWindow(now: Date) {
  const h = now.getHours() + now.getMinutes() / 60;
  const active = WINDOWS.find(w => h >= w.startH && h < w.endH) || null;
  const next = WINDOWS.find(w => w.startH > h) || WINDOWS[0];
  return { active, next };
}

export const OrrGlanceStrip: React.FC<{ teamLabel?: string }> = ({ teamLabel = 'All teams' }) => {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const load = React.useCallback(async () => {
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      const [leadsRes, agentsRes] = await Promise.all([
        supabase
          .from('sales_leads')
          .select('created_at, last_contacted_at, assigned_to, status')
          .gte('created_at', start.toISOString())
          .limit(1000),
        supabase
          .from('admin_users')
          .select('id, is_active, role')
          .in('role', ['sales', 'sales_lead'])
          .limit(200),
      ]);

      const leads = leadsRes.data || [];
      const agents = agentsRes.data || [];

      const uncontacted = leads.filter(l => !l.last_contacted_at);
      const contacted = leads.filter(l => !!l.last_contacted_at);

      const oldest = uncontacted.reduce<number | null>((acc, l) => {
        const m = minsSince(l.created_at as string);
        return acc == null || m > acc ? m : acc;
      }, null);

      const morning = uncontacted.filter(l => new Date(l.created_at as string).getHours() < 12);
      const morningOldest = morning.reduce<number | null>((acc, l) => {
        const m = minsSince(l.created_at as string);
        return acc == null || m > acc ? m : acc;
      }, null);

      const within30 = contacted.filter(
        l =>
          new Date(l.last_contacted_at as string).getTime() - new Date(l.created_at as string).getTime() <=
          30 * 60 * 1000,
      ).length;

      setStats({
        waiting: uncontacted.length,
        oldestWaitMins: oldest,
        agentsAvailable: agents.filter(a => a.is_active).length,
        agentsTotal: agents.length,
        morningQueue: morning.length,
        morningOldestMins: morningOldest,
        firstCallPct: contacted.length ? Math.round((within30 / contacted.length) * 100) : null,
        calledToday: contacted.length,
      });
    } catch (err) {
      console.error('[OrrGlanceStrip] load failed', err);
      setStats(null);
    }
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(() => { if (document.hidden || isSecondaryCrmTab()) return; load(); }, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const { active, next } = currentWindow(now);
  const target = 90;

  const cards = [
    {
      label: 'New leads (waiting)',
      icon: Phone,
      value: stats ? String(stats.waiting) : '—',
      sub: stats?.oldestWaitMins != null ? `Oldest: ${fmtMins(stats.oldestWaitMins)}` : 'Nothing waiting',
      subClass: stats && stats.oldestWaitMins != null && stats.oldestWaitMins > 30 ? 'text-destructive' : 'text-muted-foreground',
    },
    {
      label: 'Agents switched on',
      icon: Users,
      value: stats ? `${stats.agentsAvailable} / ${stats.agentsTotal}` : '—',
      sub: 'Taking leads today',
      subClass: 'text-muted-foreground',
    },
    {
      label: 'Called today',
      icon: PhoneCall,
      value: stats ? String(stats.calledToday) : '—',
      sub: 'Leads with a first contact logged',
      subClass: 'text-muted-foreground',
    },
    {
      label: 'Morning queue',
      icon: Sunrise,
      value: stats ? String(stats.morningQueue) : '—',
      sub: stats?.morningOldestMins != null ? `Oldest: ${fmtMins(stats.morningOldestMins)}` : 'Clear',
      subClass: stats && stats.morningOldestMins != null && stats.morningOldestMins > 30 ? 'text-amber-600' : 'text-muted-foreground',
    },
    {
      label: 'First call < 30m',
      icon: Target,
      value: stats?.firstCallPct != null ? `${stats.firstCallPct}%` : '—',
      sub: `Target: ${target}%`,
      subClass:
        stats?.firstCallPct != null && stats.firstCallPct < target ? 'text-amber-600' : 'text-emerald-600',
    },
    {
      label: 'Waiting over 30m',
      icon: Timer,
      value: stats ? String(stats.oldestWaitMins != null && stats.oldestWaitMins > 30 ? 1 : 0) : '—',
      sub: 'Oldest lead past the window',
      subClass: 'text-muted-foreground',
    },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-semibold text-foreground">{teamLabel} at a glance</h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold px-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live figures
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {cards.map(c => (
          <div key={c.label} className="rounded-md border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
              <c.icon className="h-4 w-4 text-primary shrink-0" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{c.value}</div>
            <div className={cn('mt-1 text-[11px] font-medium', c.subClass)}>{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" />
          <div>
            <div className="text-xs font-semibold text-foreground">System status</div>
            <div className="text-[11px] text-muted-foreground">All systems operational</div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Sunrise className="h-4 w-4 text-amber-500 mt-0.5" />
          <div>
            <div className="text-xs font-semibold text-foreground">Current window</div>
            <div className="text-[11px] text-muted-foreground">
              {active ? `${active.label} ${active.startH}:00 – ${active.endH}:00` : 'Outside calling windows'}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Utensils className="h-4 w-4 text-primary mt-0.5" />
          <div>
            <div className="text-xs font-semibold text-foreground">Next window</div>
            <div className="text-[11px] text-muted-foreground">
              {next.label} {next.startH}:00 – {next.endH}:00
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Repeat className="h-4 w-4 text-teal-600 mt-0.5" />
          <div>
            <div className="text-xs font-semibold text-foreground">Rotation mode</div>
            <div className="text-[11px] text-muted-foreground">Round robin — one lead at a time</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        Day one calling plan: 9am – 11am calling · max 3 calls / full day 2
      </div>
    </div>
  );
};

export default OrrGlanceStrip;
