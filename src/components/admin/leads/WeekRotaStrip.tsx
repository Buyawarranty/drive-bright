import { useEffect, useMemo, useRef, useState } from 'react';
import { startOfWeek, endOfWeek, eachDayOfInterval, format, isSameDay, isToday } from 'date-fns';
import { CalendarDays, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { useSeesAllAgents } from '@/hooks/useSeesAllAgents';
import { toast } from 'sonner';

type DayType = 'full_day' | 'half_day' | 'off';

interface AdminLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}

interface WorkingDayRow {
  id: string;
  admin_user_id: string;
  work_date: string;
  day_type: DayType;
}

const ROTA_ROLES = ['sales', 'sales_lead', 'lead_gen', 'sales_manager', 'claims_agent', 'claims_manager'] as const;

/** Mon–Fri ticked by default; Saturday and Sunday start unticked. */
const defaultTypeFor = (d: Date): DayType | null => {
  const dow = d.getDay();
  return dow >= 1 && dow <= 5 ? 'full_day' : null;
};

/**
 * Compact working-week rota strip for the New Leads section.
 * Shares the same `agent_working_days` data as the Timesheets rota, so the two
 * pages always tally. Agents see their own Mon–Sun row; managers get a single
 * line that expands to every agent's week.
 */
export const WeekRotaStrip = () => {
  const { user } = useAuth();
  const currentAdminId = useCurrentAdminId();
  const { seesAll: isManagement } = useSeesAllAgents();
  const [agents, setAgents] = useState<AdminLite[]>([]);
  const [rows, setRows] = useState<WorkingDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const weekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const weekEnd = useMemo(() => endOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const days = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  const load = async () => {
    setLoading(true);
    try {
      const rowsQuery = (supabase as any)
        .from('agent_working_days')
        .select('id, admin_user_id, work_date, day_type')
        .gte('work_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('work_date', format(weekEnd, 'yyyy-MM-dd'));

      if (isManagement) {
        const [agentsRes, rowsRes] = await Promise.all([
          supabase
            .from('admin_users')
            .select('id, first_name, last_name, email, role')
            .eq('is_active', true)
            .in('role', ROTA_ROLES)
            .order('first_name', { ascending: true }),
          rowsQuery,
        ]);
        setAgents((agentsRes.data as AdminLite[]) || []);
        setRows((rowsRes.data as WorkingDayRow[]) || []);
      } else {
        if (!currentAdminId) return;
        const [meRes, rowsRes] = await Promise.all([
          supabase
            .from('admin_users')
            .select('id, first_name, last_name, email, role')
            .eq('id', currentAdminId)
            .maybeSingle(),
          rowsQuery.eq('admin_user_id', currentAdminId),
        ]);
        setAgents(meRes.data ? [meRes.data as AdminLite] : []);
        setRows((rowsRes.data as WorkingDayRow[]) || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentAdminId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAdminId, isManagement]);

  const getRow = (agentId: string, date: Date) =>
    rows.find((r) => r.admin_user_id === agentId && isSameDay(new Date(r.work_date + 'T00:00:00'), date));

  const canEditFor = (agentId: string) => isManagement || agentId === currentAdminId;

  const applyDefaults = async (agentId: string) => {
    const targets = days
      .map((d) => ({ d, type: defaultTypeFor(d) }))
      .filter((x): x is { d: Date; type: DayType } => x.type !== null)
      .filter(({ d }) => !getRow(agentId, d));
    if (!targets.length) return;
    const { data, error } = await (supabase as any)
      .from('agent_working_days')
      .insert(
        targets.map(({ d, type }) => ({
          admin_user_id: agentId,
          work_date: format(d, 'yyyy-MM-dd'),
          day_type: type,
          created_by: user?.id ?? null,
        })),
      )
      .select('id, admin_user_id, work_date, day_type');
    if (error) return;
    setRows((prev) => [...prev, ...((data as WorkingDayRow[]) || [])]);
  };

  // Seed defaults once per agent per week so nobody starts blank.
  const seeded = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (loading || saving) return;
    const targets = isManagement ? agents.map((a) => a.id) : currentAdminId ? [currentAdminId] : [];
    for (const agentId of targets) {
      const key = `${agentId}:${format(weekStart, 'yyyy-MM-dd')}`;
      if (seeded.current.has(key)) continue;
      seeded.current.add(key);
      if (rows.some((r) => r.admin_user_id === agentId)) continue;
      applyDefaults(agentId);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, saving, agents, currentAdminId, rows.length]);

  const toggleDay = async (agentId: string, date: Date) => {
    if (!canEditFor(agentId) || saving) return;
    const existing = getRow(agentId, date);
    setSaving(true);
    try {
      if (existing) {
        const { error } = await (supabase as any)
          .from('agent_working_days')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
        setRows((prev) => prev.filter((r) => r.id !== existing.id));
      } else {
        const { data, error } = await (supabase as any)
          .from('agent_working_days')
          .insert({
            admin_user_id: agentId,
            work_date: format(date, 'yyyy-MM-dd'),
            day_type: 'full_day',
            created_by: user?.id ?? null,
          })
          .select('id, admin_user_id, work_date, day_type')
          .single();
        if (error) throw error;
        setRows((prev) => [...prev, data as WorkingDayRow]);
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not update working day');
    } finally {
      setSaving(false);
    }
  };

  const displayName = (a: AdminLite) => `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email;

  const dayChip = (agentId: string, d: Date, interactive: boolean) => {
    const on = !!getRow(agentId, d) && getRow(agentId, d)!.day_type !== 'off';
    return (
      <button
        key={agentId + d.toISOString()}
        type="button"
        disabled={!interactive || saving}
        onClick={() => interactive && toggleDay(agentId, d)}
        title={`${format(d, 'EEEE d MMM')} — ${on ? 'working (tap to untick)' : 'not working (tap to tick)'}`}
        aria-pressed={on}
        className={cn(
          'h-7 w-7 rounded-md border text-[11px] font-bold transition-colors',
          on
            ? 'bg-emerald-600 text-white border-emerald-700'
            : 'bg-background text-muted-foreground border-dashed border-border',
          isToday(d) && 'ring-2 ring-primary ring-offset-1',
          interactive ? 'hover:opacity-90 cursor-pointer' : 'cursor-default',
        )}
      >
        {format(d, 'EEEEE')}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading this week's rota…
      </div>
    );
  }

  const me = agents.find((a) => a.id === currentAdminId);
  const workingCount = (agentId: string) =>
    rows.filter((r) => r.admin_user_id === agentId && r.day_type !== 'off').length;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="h-4 w-4 text-orange-600 shrink-0" />
          <span className="text-sm font-semibold whitespace-nowrap">Attendance · this week</span>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {format(weekStart, 'd MMM')} – {format(weekEnd, 'd MMM')}
          </span>
        </div>

        {me && (
          <div className="flex items-center gap-1">
            {days.map((d) => dayChip(me.id, d, canEditFor(me.id)))}
          </div>
        )}

        <span className="text-[11px] text-muted-foreground">
          Mon–Fri ticked by default — tap to tick or untick any day
        </span>

        {isManagement && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
          >
            {expanded ? 'Hide team attendance' : `Team attendance (${agents.length})`}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {isManagement && expanded && (
        <div className="border-t border-border px-4 py-3 space-y-1.5 max-h-72 overflow-y-auto">
          {agents.map((a) => (
            <div key={a.id} className="flex items-center gap-3 flex-wrap">
              <span className="text-xs w-40 truncate">{displayName(a)}</span>
              <div className="flex items-center gap-1">{days.map((d) => dayChip(a.id, d, true))}</div>
              <span className="text-[11px] text-muted-foreground">
                {workingCount(a.id)} day{workingCount(a.id) === 1 ? '' : 's'} on
              </span>
            </div>
          ))}
          <div className="pt-1 text-[11px] text-muted-foreground">
            Matches the Timesheets rota — changes here show there too.
          </div>
        </div>
      )}
    </div>
  );
};

export default WeekRotaStrip;
