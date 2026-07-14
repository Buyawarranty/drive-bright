import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, AlertTriangle, CheckCircle2, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AdminLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
  is_active: boolean;
}

/**
 * Compact widget showing weekend coverage at a glance.
 * - Sunday: who's on solo (or a red alert if unset/inactive).
 * - Saturday: how many rostered (red if 0).
 * - Highlights today when it's a weekend day.
 */
export const WeekendCoverageWidget = () => {
  const [loading, setLoading] = useState(true);
  const [sundayAgents, setSundayAgents] = useState<AdminLite[]>([]);
  const [sundayRosterEmpty, setSundayRosterEmpty] = useState(false);
  const [saturdayAgents, setSaturdayAgents] = useState<AdminLite[]>([]);

  useEffect(() => {
    (async () => {
      const { data: settings } = await (supabase as any)
        .from('lead_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [
          'weekend_solo_agent_id',
          'weekend_saturday_roster',
          'weekend_sunday_roster',
        ]);

      const map = new Map<string, any>();
      (settings || []).forEach((r: any) => map.set(r.setting_key, r.setting_value));

      const sundayRaw = map.get('weekend_sunday_roster');
      let sundayIds: string[] = Array.isArray(sundayRaw)
        ? sundayRaw.filter((x: any) => typeof x === 'string')
        : [];
      // Legacy fallback
      if (sundayIds.length === 0) {
        const legacy = map.get('weekend_solo_agent_id');
        const legacyId = typeof legacy === 'string' ? legacy : null;
        if (legacyId) sundayIds = [legacyId];
      }
      const rosterRaw = map.get('weekend_saturday_roster');
      const rosterIds: string[] = Array.isArray(rosterRaw)
        ? rosterRaw.filter((x: any) => typeof x === 'string')
        : [];

      const ids = Array.from(new Set([...sundayIds, ...rosterIds]));
      let byId = new Map<string, AdminLite>();
      if (ids.length > 0) {
        const { data: users } = await supabase
          .from('admin_users')
          .select('id, first_name, last_name, email, role, is_active')
          .in('id', ids);
        (users as AdminLite[] | null)?.forEach((u) => byId.set(u.id, u));
      }

      setSundayRosterEmpty(sundayIds.length === 0);
      setSundayAgents(sundayIds.map((id) => byId.get(id)).filter(Boolean) as AdminLite[]);
      setSaturdayAgents(rosterIds.map((id) => byId.get(id)).filter(Boolean) as AdminLite[]);
      setLoading(false);
    })();
  }, []);

  const todayUkDow = useMemo(() => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      weekday: 'short',
    }).format(new Date());
    return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts as any] ?? -1;
  }, []);


  const isSatToday = todayUkDow === 6;
  const isSunToday = todayUkDow === 0;

  const activeSundayAgents = sundayAgents.filter((a) => a.is_active);
  const sundayAlert = sundayRosterEmpty || activeSundayAgents.length === 0;
  const saturdayAlert = saturdayAgents.length === 0;

  if (loading) return null;

  const renderChip = (a: AdminLite) => {
    const name = `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email;
    const dim = !a.is_active;
    return (
      <span
        key={a.id}
        className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
          dim
            ? 'border-destructive/40 bg-destructive/5 text-destructive'
            : 'border-border bg-background text-foreground'
        }`}
        title={dim ? 'Agent is inactive' : name}
      >
        <User className="h-3 w-3" />
        {name}
        {dim && ' (inactive)'}
      </span>
    );
  };

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Weekend coverage</h3>
        <span className="ml-auto text-[11px] text-muted-foreground">
          Change in Lead Teams → Default Allocation
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
        {/* SATURDAY */}
        <div className={`px-4 py-3 ${isSatToday ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Saturday
            </span>
            {isSatToday && (
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500 text-white">
                Today
              </span>
            )}
            {saturdayAlert ? (
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                No coverage set
              </span>
            ) : (
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {saturdayAgents.length} rostered
              </span>
            )}
          </div>
          {saturdayAlert ? (
            <p className="text-xs text-destructive">
              No agents rostered — set the Saturday roster so managers know who's covering.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {saturdayAgents.map(renderChip)}
            </div>
          )}
        </div>

        {/* SUNDAY */}
        <div className={`px-4 py-3 ${isSunToday ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sunday
            </span>
            {isSunToday && (
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500 text-white">
                Today
              </span>
            )}
            {sundayAlert ? (
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                {sundayRosterEmpty ? 'No agents set' : 'All ticked agents inactive'}
              </span>
            ) : (
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {activeSundayAgents.length} working
              </span>
            )}
          </div>
          {sundayAlert ? (
            <p className="text-xs text-destructive">
              Sunday leads will park in the Open Pool with a coverage-down flag.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {sundayAgents.map(renderChip)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Round-robin among active agents · caps bypassed
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};


export default WeekendCoverageWidget;
