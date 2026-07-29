import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Zap, ZapOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { fairFillShares } from '@/lib/fairFillShares';


/**
 * Global auto-distribute control bar.
 *
 * Visible on every admin page for admin / super_admin / sales_manager. Handles:
 *  - Persistent ON/OFF toggle for Open Pool auto-distribute (only affects
 *    Open Round Robin pool leads — Round Robin leads are always sent instantly).
 *  - Runs the sweep on a 30s interval regardless of which tab is active, so
 *    pool leads never sit waiting when the setting is ON.
 *  - Renders a red warning bar the moment auto-distribute is OFF *and* the
 *    Open Pool has at least one waiting lead, so managers see the backlog
 *    from any page.
 */

const AUTO_SWEEP_KEY = 'open_pool_auto_distribute';
const AUTO_SWEEP_INTERVAL_MS = 30_000;
const POOL_POLL_MS = 30_000;
const REASSIGN_WINDOW_MINUTES = 60 * 24 * 90;
const MANAGEMENT_ROLES = new Set(['admin', 'super_admin', 'sales_manager']);

interface Props {
  userRole: string | null;
  onGoToPool?: () => void;
}

interface Cap {
  admin_user_id: string;
  paused: boolean;
  assignment_mode: 'round_robin' | 'open_pool' | null;
  daily_cap: number | null;
}

export const GlobalAutoDistributeBar = ({ userRole, onGoToPool }: Props) => {
  const isManager = !!userRole && MANAGEMENT_ROLES.has(userRole);
  const [autoOn, setAutoOn] = useState<boolean>(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [poolCount, setPoolCount] = useState<number>(0);
  const [sweeping, setSweeping] = useState(false);
  const sweepingRef = useRef(false);

  // ---- Config -------------------------------------------------------------
  const loadConfig = useCallback(async () => {
    const { data } = await (supabase as any)
      .from('admin_config')
      .select('config_value')
      .eq('config_key', AUTO_SWEEP_KEY)
      .maybeSingle();
    setAutoOn(!!data?.config_value);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!isManager) return;
    loadConfig();
  }, [isManager, loadConfig]);

  // Live sync so toggling on one screen updates the other tabs.
  useEffect(() => {
    if (!isManager) return;
    const ch = supabase
      .channel('admin-config-auto-distribute')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'admin_config', filter: `config_key=eq.${AUTO_SWEEP_KEY}` },
        (payload: any) => {
          const v = (payload.new?.config_value ?? payload.old?.config_value) as boolean | undefined;
          if (typeof v === 'boolean') setAutoOn(v);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isManager]);

  const toggle = useCallback(async (next: boolean) => {
    setSaving(true);
    setAutoOn(next); // optimistic
    const { error } = await (supabase as any)
      .from('admin_config')
      .upsert(
        { config_key: AUTO_SWEEP_KEY, config_value: next, updated_at: new Date().toISOString() },
        { onConflict: 'config_key' },
      );
    setSaving(false);
    if (error) {
      setAutoOn(!next);
      toast({ title: 'Could not update setting', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: next ? 'Auto-distribute enabled' : 'Auto-distribute disabled',
      description: next
        ? 'Open Pool leads are handed to active agents automatically — Round Robin is unaffected (those go instantly).'
        : 'Open Pool leads will pile up until you hand them out. Round Robin still works normally.',
    });
  }, []);

  // ---- Pool count ---------------------------------------------------------
  const loadPoolCount = useCallback(async () => {
    const { count } = await (supabase as any)
      .from('sales_leads')
      .select('id', { count: 'exact', head: true })
      .eq('queue', 'live_open_pool')
      .is('assigned_to', null)
      .is('owner_agent', null)
      .eq('status', 'new');
    setPoolCount(count ?? 0);
  }, []);

  useEffect(() => {
    if (!isManager) return;
    loadPoolCount();
    const t = setInterval(loadPoolCount, POOL_POLL_MS);
    return () => clearInterval(t);
  }, [isManager, loadPoolCount]);

  // Realtime pool updates.
  useEffect(() => {
    if (!isManager) return;
    const ch = supabase
      .channel('global-auto-distribute-pool')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_leads', filter: 'queue=eq.live_open_pool' },
        () => loadPoolCount(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isManager, loadPoolCount]);

  // ---- Sweep --------------------------------------------------------------
  const runSweep = useCallback(async () => {
    if (sweepingRef.current) return;
    if (poolCount <= 0) return;

    sweepingRef.current = true;
    setSweeping(true);
    try {
      // Load active, unpaused round-robin / open-pool agents + their caps.
      const { data: caps } = await (supabase as any)
        .from('agent_distribution_caps')
        .select('admin_user_id, paused, assignment_mode, daily_cap')
        .eq('paused', false)
        .in('assignment_mode', ['round_robin', 'open_pool']);

      const agentCaps: Cap[] = (caps || []) as Cap[];
      if (agentCaps.length === 0) return;

      // Live assigned_today counts from sales_leads (not the stale counter).
      const todayStart = (() => {
        const n = new Date();
        return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())).toISOString();
      })();
      const ids = agentCaps.map(c => c.admin_user_id);
      const { data: todays } = await (supabase as any)
        .from('sales_leads')
        .select('assigned_to')
        .not('assigned_to', 'is', null)
        .gte('assigned_at', todayStart)
        .in('assigned_to', ids);
      const assignedToday: Record<string, number> = {};
      (todays || []).forEach((r: any) => {
        if (!r.assigned_to) return;
        assignedToday[r.assigned_to] = (assignedToday[r.assigned_to] || 0) + 1;
      });

      const weights = agentCaps.map(c => {
        const cap = c.daily_cap ?? null;
        const used = assignedToday[c.admin_user_id] || 0;
        const remaining = cap == null ? 1000 : Math.max(0, cap - used);
        return { id: c.admin_user_id, usedToday: used, remaining };
      }).filter(a => a.remaining > 0);

      if (weights.length === 0) return; // everyone capped

      // Fair fill: one lead at a time to whoever has fewest today.
      const shares = fairFillShares(weights, poolCount);

      for (const [agentId, share] of Object.entries(shares)) {
        if (share <= 0) continue;
        const { error } = await (supabase as any).rpc('open_pool_bulk_assign_to_agent', {
          _target_admin_id: agentId,
          _count: share,
          _window_minutes: REASSIGN_WINDOW_MINUTES,
        });
        if (error) console.error('[global auto-sweep] rpc failed', agentId, error);
      }


      loadPoolCount();
    } catch (e) {
      console.error('[global auto-sweep] error', e);
    } finally {
      sweepingRef.current = false;
      setSweeping(false);
    }
  }, [poolCount, loadPoolCount]);

  useEffect(() => {
    if (!isManager || !autoOn) return;
    const kick = setTimeout(() => runSweep(), 1500);
    const t = setInterval(() => runSweep(), AUTO_SWEEP_INTERVAL_MS);
    return () => { clearTimeout(kick); clearInterval(t); };
  }, [isManager, autoOn, runSweep]);

  const warn = useMemo(() => !autoOn && poolCount > 0, [autoOn, poolCount]);

  if (!isManager || !loaded) return null;

  return (
    <div
      className={`sticky top-16 z-40 border-b ${
        warn
          ? 'bg-red-600 text-white border-red-700'
          : autoOn
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : 'bg-slate-50 text-slate-800 border-slate-200'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-1.5 flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-2 font-semibold">
          {warn ? (
            <AlertTriangle className="h-4 w-4" />
          ) : autoOn ? (
            <Zap className="h-4 w-4 text-emerald-600" />
          ) : (
            <ZapOff className="h-4 w-4 text-slate-500" />
          )}
          <span>
            {warn
              ? `Auto-distribute OFF — ${poolCount} lead${poolCount === 1 ? '' : 's'} piling up in the Open Pool`
              : autoOn
                ? `Open Pool auto-distribute ON${poolCount > 0 ? ` — ${poolCount} in pool, handing out…` : ' — pool clear'}`
                : `Open Pool auto-distribute OFF — pool clear`}
          </span>
          {sweeping && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {warn && onGoToPool && (
            <Button
              size="sm"
              variant="secondary"
              className="h-7 bg-white text-red-700 hover:bg-red-50"
              onClick={onGoToPool}
            >
              Go to Open Pool
            </Button>
          )}
          {warn && (
            <Button
              size="sm"
              className="h-7 bg-white text-red-700 hover:bg-red-50"
              disabled={saving}
              onClick={() => toggle(true)}
            >
              Turn ON now
            </Button>
          )}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs font-medium">Open Pool auto-distribute</span>
            <Switch checked={autoOn} onCheckedChange={toggle} disabled={saving} />
          </label>
        </div>
      </div>
    </div>
  );
};

export default GlobalAutoDistributeBar;
