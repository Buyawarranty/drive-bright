import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Gauge, AlertTriangle, Clock } from 'lucide-react';

/**
 * App performance, per sales agent.
 *
 * Sales staff were the only people seeing Quotes & Orders crawl, and we only
 * found out when they told us. This panel reads the CRM's own activity log and
 * shows, for every sales agent and sales lead, how long their screens actually
 * take to become usable — plus any crashes or errors their browser hit — so a
 * bad experience is visible here before anyone has to complain.
 */

type Row = {
  admin_email: string | null;
  admin_user_id: string | null;
  event_type: string;
  tab: string | null;
  duration_ms: number | null;
  created_at: string;
};

type AgentStat = {
  email: string;
  name: string;
  role: string;
  loads: number;
  avgMs: number | null;
  worstMs: number | null;
  slowCount: number;
  crashCount: number;
  errorCount: number;
  worstTab: string | null;
  lastSeen: string | null;
};

const WINDOWS = [
  { id: '24h', label: 'Last 24 hours', hours: 24 },
  { id: '7d', label: 'Last 7 days', hours: 24 * 7 },
] as const;

const SALES_ROLES = ['sales', 'sales_lead'];

// Anything past this is a genuinely bad experience for someone on a call.
const SLOW_MS = 8000;

const fmtSecs = (ms: number | null) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`);

const healthTone = (s: AgentStat) => {
  if (s.crashCount > 0 || (s.avgMs ?? 0) > SLOW_MS) return 'bg-destructive/10 text-destructive border-destructive/30';
  if (s.slowCount > 0 || s.errorCount > 0 || (s.avgMs ?? 0) > 4000) return 'bg-amber-100 text-amber-800 border-amber-300';
  return 'bg-emerald-100 text-emerald-800 border-emerald-300';
};

const healthLabel = (s: AgentStat) => {
  if (s.crashCount > 0 || (s.avgMs ?? 0) > SLOW_MS) return 'Poor';
  if (s.slowCount > 0 || s.errorCount > 0 || (s.avgMs ?? 0) > 4000) return 'Patchy';
  return 'Good';
};

export const SalesStaffPerformancePanel = () => {
  const [windowId, setWindowId] = useState<(typeof WINDOWS)[number]['id']>('24h');
  const [stats, setStats] = useState<AgentStat[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const hours = WINDOWS.find((w) => w.id === windowId)?.hours ?? 24;
      const since = new Date(Date.now() - hours * 3600_000).toISOString();

      const [agentsRes, eventsRes] = await Promise.all([
        supabase
          .from('admin_users')
          .select('id, name, email, role, is_active')
          .in('role', SALES_ROLES)
          .eq('is_active', true),
        supabase
          .from('admin_ui_events')
          .select('admin_email, admin_user_id, event_type, tab, duration_ms, created_at')
          .gte('created_at', since)
          .in('event_type', ['page_load', 'tab_view', 'slow_load', 'crash', 'js_error'])
          .order('created_at', { ascending: false })
          .limit(4000),
      ]);

      const agents = (agentsRes.data || []) as any[];
      const events = (eventsRes.data || []) as Row[];

      const byAgent = new Map<string, Row[]>();
      events.forEach((e) => {
        const key = (e.admin_email || '').toLowerCase();
        if (!key) return;
        const list = byAgent.get(key) || [];
        list.push(e);
        byAgent.set(key, list);
      });

      const next: AgentStat[] = agents.map((a) => {
        const key = (a.email || '').toLowerCase();
        const rows = byAgent.get(key) || [];
        const durations = rows
          .filter((r) => (r.event_type === 'page_load' || r.event_type === 'tab_view') && typeof r.duration_ms === 'number')
          .map((r) => ({ ms: r.duration_ms as number, tab: r.tab }));
        const avgMs = durations.length ? durations.reduce((s, d) => s + d.ms, 0) / durations.length : null;
        const worst = durations.reduce<{ ms: number; tab: string | null } | null>(
          (w, d) => (!w || d.ms > w.ms ? d : w),
          null,
        );
        return {
          email: a.email,
          name: a.name || a.email,
          role: a.role,
          loads: durations.length,
          avgMs,
          worstMs: worst?.ms ?? null,
          worstTab: worst?.tab ?? null,
          slowCount: rows.filter((r) => r.event_type === 'slow_load' || (r.duration_ms ?? 0) > SLOW_MS).length,
          crashCount: rows.filter((r) => r.event_type === 'crash').length,
          errorCount: rows.filter((r) => r.event_type === 'js_error').length,
          lastSeen: rows[0]?.created_at ?? null,
        };
      });

      // Worst experience first — that's who needs help.
      next.sort((a, b) => {
        const score = (s: AgentStat) => s.crashCount * 1000 + s.slowCount * 100 + (s.avgMs ?? 0) / 100;
        return score(b) - score(a);
      });
      setStats(next);
    } catch (e) {
      console.warn('[SalesStaffPerformancePanel] load failed', e);
      setStats([]);
    } finally {
      setLoading(false);
    }
  }, [windowId]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const active = stats.filter((s) => s.loads > 0);
    const avg = active.length ? active.reduce((s, a) => s + (a.avgMs ?? 0), 0) / active.length : null;
    return {
      active: active.length,
      avg,
      slow: stats.reduce((s, a) => s + a.slowCount, 0),
      crashes: stats.reduce((s, a) => s + a.crashCount, 0),
    };
  }, [stats]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Sales staff app performance
            </CardTitle>
            <CardDescription>
              How fast the CRM actually is for each sales agent and sales lead, and any crashes their browser hit.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5">
            {WINDOWS.map((w) => (
              <Button
                key={w.id}
                size="sm"
                variant={windowId === w.id ? 'default' : 'outline'}
                className="h-7 text-xs"
                onClick={() => setWindowId(w.id)}
              >
                {w.label}
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Agents using the CRM</p>
            <p className="text-lg font-semibold">{summary.active}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Average screen load</p>
            <p className="text-lg font-semibold">{fmtSecs(summary.avg)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Slow loads (over 8s)</p>
            <p className="text-lg font-semibold">{summary.slow}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Crashes</p>
            <p className="text-lg font-semibold">{summary.crashes}</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Checking each agent's experience…</p>
        ) : stats.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No active sales staff found.</p>
        ) : (
          <div className="rounded-md border divide-y">
            {stats.map((s) => (
              <div key={s.email} className="px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <Badge variant="outline" className={healthTone(s)}>
                  {healthLabel(s)}
                </Badge>
                <span className="font-medium min-w-[10rem]">{s.name}</span>
                <span className="text-xs text-muted-foreground">{s.role === 'sales_lead' ? 'Sales lead' : 'Sales'}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  avg {fmtSecs(s.avgMs)} · worst {fmtSecs(s.worstMs)}
                  {s.worstTab ? ` on ${s.worstTab}` : ''}
                </span>
                <span className="text-xs text-muted-foreground">{s.loads} screen opens</span>
                {s.slowCount > 0 && (
                  <span className="text-xs text-amber-700">{s.slowCount} slow</span>
                )}
                {(s.crashCount > 0 || s.errorCount > 0) && (
                  <span className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {s.crashCount} crash{s.crashCount === 1 ? '' : 'es'} · {s.errorCount} error
                    {s.errorCount === 1 ? '' : 's'}
                  </span>
                )}
                {s.loads === 0 && s.crashCount === 0 && (
                  <span className="text-xs text-muted-foreground">No activity in this window</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SalesStaffPerformancePanel;
