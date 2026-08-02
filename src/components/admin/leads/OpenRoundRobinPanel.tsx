import React, { useEffect, useState, useCallback } from 'react';
import { Repeat, AlertTriangle, ListChecks, RefreshCw, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { OpenRoundRobinTestPanel } from './OpenRoundRobinTestPanel';


const TEAM_BLUE_ID = '14f567b3-4ba3-4baa-acef-8d0de8e24b2d';

interface Stats {
  inWindow: number;
  awaitingRelease: number;
  releasedLastHour: number;
  passedLastHour: number;
  dormantToday: number;
  assignedOvernight: number;
  attemptCounts: Record<number, number>;
  sweepLastRan: string | null;
}

/**
 * Open Round Robin — Team Blue Beta (7-attempt schedule).
 *
 * Attempt 1: within 2 min of assignment
 * Attempt 2: 10 min after Attempt 1
 * Attempt 3: 5:30pm same day (if Attempt 2 by 3:30pm) else 10:00am next business day
 * Attempt 4: 10:00am next business day after Attempt 3
 * Attempt 5: 1:00pm, 2 business days after Attempt 4
 * Attempt 6: 5:30pm, 2 business days after Attempt 5
 * Attempt 7: 10:00am, 3 business days after Attempt 6
 * After 7 unanswered → Dormant – No Contact.
 *
 * Only real outbound calls increment the attempt counter. Passing between
 * agents inside the 2-min window does not count as an attempt.
 */
export const OpenRoundRobinPanel: React.FC<{ isManagement?: boolean }> = ({ isManagement = true }) => {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats>({
    inWindow: 0, awaitingRelease: 0, releasedLastHour: 0, passedLastHour: 0,
    dormantToday: 0, assignedOvernight: 0, attemptCounts: {}, sweepLastRan: null,
  });
  const [loading, setLoading] = useState(false);
  const [sweeping, setSweeping] = useState(false);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const startIso = startOfDay.toISOString();

      const [inWindowRes, awaitingRes, releasedRes, passedRes, dormantRes, overnightRes, attemptsRes, lastRanRes] = await Promise.all([
        supabase.from('sales_leads').select('id', { count: 'exact', head: true })
          .not('orr_first_call_deadline', 'is', null)
          .gt('orr_first_call_deadline', nowIso),
        supabase.from('sales_leads').select('id', { count: 'exact', head: true })
          .not('orr_next_release_at', 'is', null)
          .gt('orr_next_release_at', nowIso),
        supabase.from('lead_assignment_audit').select('id', { count: 'exact', head: true })
          .eq('assignment_type', 'open_round_robin')
          .like('reason', 'orr_release_attempt_%')
          .gte('created_at', hourAgo),
        supabase.from('lead_assignment_audit').select('id', { count: 'exact', head: true })
          .eq('assignment_type', 'open_round_robin')
          .eq('reason', 'orr_passed_no_call')
          .gte('created_at', hourAgo),
        supabase.from('sales_leads').select('id', { count: 'exact', head: true })
          .eq('status', 'dormant' as any)
          .gte('orr_dormant_at', startIso),
        supabase.from('lead_assignment_audit').select('id', { count: 'exact', head: true })
          .eq('assignment_type', 'open_round_robin')
          .eq('reason', 'orr_release_attempt_1')
          .gte('created_at', hourAgo),
        supabase.from('sales_leads').select('orr_attempt_count')
          .gt('orr_attempt_count', 0)
          .not('orr_next_release_at', 'is', null),
        supabase.from('lead_assignment_audit').select('created_at')
          .eq('assignment_type', 'open_round_robin')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const counts: Record<number, number> = {};
      (attemptsRes.data || []).forEach((r: any) => {
        const n = r.orr_attempt_count;
        counts[n] = (counts[n] || 0) + 1;
      });

      setStats({
        inWindow: inWindowRes.count ?? 0,
        awaitingRelease: awaitingRes.count ?? 0,
        releasedLastHour: releasedRes.count ?? 0,
        passedLastHour: passedRes.count ?? 0,
        dormantToday: dormantRes.count ?? 0,
        assignedOvernight: overnightRes.count ?? 0,
        attemptCounts: counts,
        sweepLastRan: (lastRanRes.data as any)?.created_at ?? null,
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
      const d = (data ?? {}) as { released?: number; passed?: number; assigned_overnight?: number; enabled?: boolean; note?: string };
      toast({
        title: d.enabled === false ? 'Open Round Robin is disabled' : 'Sweep complete',
        description: d.enabled === false
          ? 'Turn it on in lead_distribution_settings for Team Blue.'
          : `Released ${d.released ?? 0} · Passed ${d.passed ?? 0} · Overnight ${d.assigned_overnight ?? 0}${d.note ? ` (${d.note})` : ''}`,
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
                Open Round Robin · Team Blue test mode
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-amber-500 text-white">
                Test mode only
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Not switched on for real leads yet. Team Blue can rehearse it here — real enquiries
              still go out on the standard round robin. It will be turned on for live leads later.
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
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 px-5 py-4 border-b border-blue-200">
        <StatTile label="In 2-min window" value={stats.inWindow} tone="blue" />
        <StatTile label="Awaiting release" value={stats.awaitingRelease} tone="amber" />
        <StatTile label="Released (last hr)" value={stats.releasedLastHour} tone="emerald" />
        <StatTile label="Passed no-call (hr)" value={stats.passedLastHour} tone="rose" />
        <StatTile label="Dormant today" value={stats.dormantToday} tone="slate" />
        <StatTile label="Overnight assigned (hr)" value={stats.assignedOvernight} tone="indigo" />
      </div>

      {/* Attempt distribution */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2 px-5 py-3 border-b border-blue-200 bg-white/60">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <div key={n} className="rounded border border-blue-200 bg-blue-50/60 px-2 py-1.5 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">Attempt {n}</div>
            <div className="text-lg font-semibold tabular-nums text-blue-900">{stats.attemptCounts[n] ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">awaiting next</div>
          </div>
        ))}
      </div>

      <div className="px-5 pb-2 border-b border-blue-200 bg-blue-50/40 text-[11px] text-muted-foreground">
        Sweep last ran: {stats.sweepLastRan ? new Date(stats.sweepLastRan).toLocaleTimeString('en-GB', { timeZone: 'Europe/London' }) : '—'} (London)
      </div>

      {/* Test-mode banner */}
      <div className="px-5 py-3 border-b border-amber-200 bg-amber-100/70 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-800 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-900">
          <strong>Test mode only — no real leads are routed through Open Round Robin.</strong> Use
          the practice panel below to rehearse the flow. Live rollout for Team Blue comes later; the
          counters above stay at zero until then.
        </p>
      </div>


      {/* Rules */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">7-Attempt Contact Schedule</h3>
        </div>
        <ol className="list-decimal pl-5 space-y-1 text-sm text-foreground/90">
          <li><strong>Attempt 1:</strong> within 2 minutes of assignment</li>
          <li><strong>Attempt 2:</strong> 10 minutes after Attempt 1</li>
          <li><strong>Attempt 3:</strong> 5:30pm same day if Attempt 2 was by 3:30pm — otherwise 10:00am next business day</li>
          <li><strong>Attempt 4:</strong> 10:00am, next business day after Attempt 3</li>
          <li><strong>Attempt 5:</strong> 1:00pm, 2 business days after Attempt 4</li>
          <li><strong>Attempt 6:</strong> 5:30pm, 2 business days after Attempt 5</li>
          <li><strong>Attempt 7:</strong> 10:00am, 3 business days after Attempt 6</li>
        </ol>
        <p className="text-xs text-foreground/80 mt-3">
          At each release the lead opens to eligible Team Blue agents; the first to claim gets a
          2-minute call window. If they don't call, it passes to the next agent (no attempt logged).
          After 7 unanswered attempts the lead becomes <strong>Dormant – No Contact</strong>.
          Weekends and UK bank holidays are excluded from business-day math. If the customer answers
          at any point, all future releases are cancelled and ownership stays with the caller.
        </p>
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
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900',
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
};

const StatTile: React.FC<{ label: string; value: number; tone: keyof typeof toneClasses }> = ({ label, value, tone }) => (
  <div className={`rounded-md border px-3 py-2 ${toneClasses[tone]}`}>
    <div className="text-[11px] font-medium uppercase tracking-wide opacity-80">{label}</div>
    <div className="text-2xl font-semibold tabular-nums">{value}</div>
  </div>
);

export default OpenRoundRobinPanel;
