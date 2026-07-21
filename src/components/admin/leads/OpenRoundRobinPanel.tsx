import React, { useEffect, useState, useCallback } from 'react';
import { Repeat, AlertTriangle, ListChecks, RefreshCw, Play, Moon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { OpenRoundRobinTestPanel } from './OpenRoundRobinTestPanel';


const TEAM_BLUE_ID = '14f567b3-4ba3-4baa-acef-8d0de8e24b2d';

interface Stats {
  inWindow: number;
  inRetry: number;
  reclaimedLastHour: number;
  dormantToday: number;
}

/**
 * Open Round Robin — Team Blue Beta.
 *
 * Wired to the live distribution engine:
 *  - Assignment sets a 2-minute first-call deadline (DB trigger).
 *  - A pg_cron job runs `sweep_open_round_robin()` every minute to
 *    reclaim leads whose window lapsed, extend a 10-minute retry after
 *    a no-answer, and mark leads dormant after 7 attempts.
 *  - Reclaims are logged to lead_assignment_audit.
 *
 * Team Red / Team Green are not touched.
 */
export const OpenRoundRobinPanel: React.FC<{ isManagement?: boolean }> = ({ isManagement = true }) => {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats>({ inWindow: 0, inRetry: 0, reclaimedLastHour: 0, dormantToday: 0 });
  const [loading, setLoading] = useState(false);
  const [sweeping, setSweeping] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const startIso = startOfDay.toISOString();

      const [inWindowRes, inRetryRes, reclaimedRes, dormantRes] = await Promise.all([
        supabase.from('sales_leads').select('id', { count: 'exact', head: true })
          .not('orr_first_call_deadline', 'is', null)
          .gt('orr_first_call_deadline', nowIso),
        supabase.from('sales_leads').select('id', { count: 'exact', head: true })
          .not('orr_retry_deadline', 'is', null)
          .gt('orr_retry_deadline', nowIso),
        supabase.from('lead_assignment_audit').select('id', { count: 'exact', head: true })
          .eq('assignment_type', 'open_round_robin')
          .gte('created_at', hourAgo),
        supabase.from('sales_leads').select('id', { count: 'exact', head: true })
          .eq('status', 'dormant' as any)
          .gte('orr_dormant_at', startIso),
      ]);

      setStats({
        inWindow: inWindowRes.count ?? 0,
        inRetry: inRetryRes.count ?? 0,
        reclaimedLastHour: reclaimedRes.count ?? 0,
        dormantToday: dormantRes.count ?? 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 30_000);
    const channel = supabase
      .channel('orr-panel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_assignment_audit' }, () => loadStats())
      .subscribe();
    return () => {
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, [loadStats]);

  const runSweepNow = async () => {
    setSweeping(true);
    try {
      const { data, error } = await supabase.rpc('sweep_open_round_robin' as any);
      if (error) throw error;
      const d = (data ?? {}) as { reclaimed?: number; dormant?: number; enabled?: boolean };
      toast({
        title: d.enabled === false ? 'Open Round Robin is disabled' : 'Sweep complete',
        description: d.enabled === false
          ? 'Turn it on in lead_distribution_settings for Team Blue.'
          : `Reclaimed ${d.reclaimed ?? 0} · Dormant ${d.dormant ?? 0}`,
      });
      loadStats();
    } catch (e: any) {
      toast({ title: 'Sweep failed', description: e.message, variant: 'destructive' });
    } finally {
      setSweeping(false);
    }
  };

  return (
    <section className="rounded-lg border border-blue-200 bg-blue-50/40 shadow-sm">
      <div className="px-5 py-4 border-b border-blue-200 flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Repeat className="h-4 w-4 text-blue-700 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-foreground">
                Open Round Robin · Team Blue Beta
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-blue-600 text-white">
                Live
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              New Team Blue enquiries are auto-assigned one at a time. Start the first call
              within 2 minutes or the lead is reclaimed and passed to the next agent.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadStats} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {isManagement && (
            <Button size="sm" onClick={runSweepNow} disabled={sweeping}>
              <Play className={`h-3.5 w-3.5 mr-1.5 ${sweeping ? 'animate-pulse' : ''}`} />
              Run sweep now
            </Button>
          )}
        </div>
      </div>

      {/* Live counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-5 py-4 border-b border-blue-200">
        <StatTile label="In 2-min window" value={stats.inWindow} tone="blue" />
        <StatTile label="In 10-min retry" value={stats.inRetry} tone="amber" />
        <StatTile label="Reclaimed (last hr)" value={stats.reclaimedLastHour} tone="rose" />
        <StatTile label="Dormant today" value={stats.dormantToday} tone="slate" />
      </div>

      {/* Live banner */}
      <div className="px-5 py-3 border-b border-blue-200 bg-blue-100/60 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-blue-800 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-900">
          <strong>Sweep runs every 60 seconds.</strong> Missed first calls are reassigned to the
          next available Team Blue agent. All movements are logged to the assignment audit.
        </p>
      </div>

      {/* Rules */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Open Round Robin Rules</h3>
        </div>
        <ol className="list-decimal pl-5 space-y-1.5 text-sm text-foreground/90">
          <li><strong>First call window:</strong> 2 minutes</li>
          <li><strong>If no call starts:</strong> lead is reassigned to the next Team Blue agent</li>
          <li><strong>If no answer:</strong> 10-minute retry window with the same agent</li>
          <li><strong>If retry is missed:</strong> lead returns to the Open Round Robin queue</li>
          <li><strong>After 7 contact attempts:</strong> lead becomes dormant</li>
        </ol>
        <p className="text-[11px] text-muted-foreground mt-3">
          Team Red and Team Green flows are unchanged.
        </p>
      </div>

      {isManagement && (
        <div className="px-5 pb-5">
          <OpenRoundRobinTestPanel />
        </div>
      )}
    </section>
  );
};

const toneClasses: Record<string, string> = {
  blue: 'bg-blue-50 border-blue-200 text-blue-900',
  amber: 'bg-amber-50 border-amber-200 text-amber-900',
  rose: 'bg-rose-50 border-rose-200 text-rose-900',
  slate: 'bg-slate-50 border-slate-200 text-slate-900',
};

const StatTile: React.FC<{ label: string; value: number; tone: keyof typeof toneClasses }> = ({ label, value, tone }) => (
  <div className={`rounded-md border px-3 py-2 ${toneClasses[tone]}`}>
    <div className="text-[11px] font-medium uppercase tracking-wide opacity-80">{label}</div>
    <div className="text-2xl font-semibold tabular-nums">{value}</div>
  </div>
);

export default OpenRoundRobinPanel;
