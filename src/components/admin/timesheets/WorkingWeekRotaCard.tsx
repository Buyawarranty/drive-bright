import { useEffect, useMemo, useState } from 'react';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
  isWeekend,
  addWeeks,
  subWeeks,
} from 'date-fns';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
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

interface Props {
  isManagement: boolean;
}

/**
 * Working Week Rota — replaces the old weekend-only signup.
 * Weekly calendar (Mon–Sun). Each staff member ticks the days they're working.
 * Full-day is the default. Today is highlighted. Weekends styled distinctly.
 * Managers can pick any agent to edit; agents can only edit themselves.
 */
export const WorkingWeekRotaCard = ({ isManagement }: Props) => {
  const { user } = useAuth();
  const currentAdminId = useCurrentAdminId();
  // Default to THIS week so agents see the rota they need to update immediately.
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => new Date());
  const [agents, setAgents] = useState<AdminLite[]>([]);
  const [rows, setRows] = useState<WorkingDayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);


  const weekStart = useMemo(() => startOfWeek(weekAnchor, { weekStartsOn: 1 }), [weekAnchor]);
  const weekEnd = useMemo(() => endOfWeek(weekAnchor, { weekStartsOn: 1 }), [weekAnchor]);
  const days = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  const isCurrentWeek = useMemo(() => {
    const now = new Date();
    return now >= weekStart && now <= weekEnd;
  }, [weekStart, weekEnd]);

  const load = async () => {
    setLoading(true);
    // Staff only ever load their own rota row; managers load the whole team.
    if (!isManagement) {
      if (!currentAdminId) return;
      const [meRes, rowsRes] = await Promise.all([
        supabase
          .from('admin_users')
          .select('id, first_name, last_name, email, role, is_active')
          .eq('id', currentAdminId)
          .maybeSingle(),
        (supabase as any)
          .from('agent_working_days')
          .select('id, admin_user_id, work_date, day_type')
          .eq('admin_user_id', currentAdminId)
          .gte('work_date', format(weekStart, 'yyyy-MM-dd'))
          .lte('work_date', format(weekEnd, 'yyyy-MM-dd')),
      ]);
      setAgents(meRes.data ? [meRes.data as AdminLite] : []);
      setRows((rowsRes.data as WorkingDayRow[]) || []);
      setLoading(false);
      return;
    }

    const [agentsRes, rowsRes] = await Promise.all([
      supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role, is_active')
        .eq('is_active', true)
        .in('role', ['sales', 'sales_lead', 'lead_gen', 'sales_manager', 'claims_agent', 'claims_manager'])
        .order('first_name', { ascending: true }),
      (supabase as any)
        .from('agent_working_days')
        .select('id, admin_user_id, work_date, day_type')
        .gte('work_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('work_date', format(weekEnd, 'yyyy-MM-dd')),
    ]);
    setAgents((agentsRes.data as AdminLite[]) || []);
    setRows((rowsRes.data as WorkingDayRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.toISOString(), isManagement, currentAdminId]);

  useEffect(() => {
    if (!currentAdminId) return;
    if (!isManagement) setSelectedAgentId(currentAdminId);
    else if (!selectedAgentId) setSelectedAgentId(currentAdminId);
  }, [currentAdminId, isManagement, selectedAgentId]);

  const canEditFor = (agentId: string) => isManagement || agentId === currentAdminId;

  const getRow = (agentId: string, date: Date) =>
    rows.find(
      (r) => r.admin_user_id === agentId && isSameDay(new Date(r.work_date + 'T00:00:00'), date),
    );

  const toggleDay = async (agentId: string, date: Date, forceType?: DayType) => {
    if (!canEditFor(agentId) || saving) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = getRow(agentId, date);
    setSaving(true);
    try {
      if (existing && !forceType) {
        // toggle off
        const { error } = await (supabase as any)
          .from('agent_working_days')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
        setRows((prev) => prev.filter((r) => r.id !== existing.id));
      } else if (existing && forceType && existing.day_type !== forceType) {
        // change type
        const { error } = await (supabase as any)
          .from('agent_working_days')
          .update({ day_type: forceType })
          .eq('id', existing.id);
        if (error) throw error;
        setRows((prev) => prev.map((r) => (r.id === existing.id ? { ...r, day_type: forceType } : r)));
      } else if (!existing) {
        const dayType: DayType = forceType ?? (isWeekend(date) ? 'half_day' : 'full_day');
        const { data, error } = await (supabase as any)
          .from('agent_working_days')
          .insert({
            admin_user_id: agentId,
            work_date: dateStr,
            day_type: dayType,
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

  const displayName = (a: AdminLite) =>
    `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email;

  const editingAgent = agents.find((a) => a.id === selectedAgentId) ?? null;
  const workingCountForAgent = (agentId: string) =>
    rows.filter((r) => r.admin_user_id === agentId && r.day_type !== 'off').length;
  const offCountForAgent = (agentId: string) =>
    rows.filter((r) => r.admin_user_id === agentId && r.day_type === 'off').length;

  return (
    <section className="rounded-xl border-2 border-orange-400 bg-card shadow-lg ring-1 ring-orange-200">
      <div className="px-5 py-4 border-b-2 border-orange-300 bg-gradient-to-r from-orange-100 via-amber-50 to-yellow-50 flex items-start gap-3 rounded-t-xl">
        <div className="h-9 w-9 rounded-lg bg-orange-500 flex items-center justify-center shrink-0 shadow-sm">
          <CalendarDays className="h-5 w-5 text-white" />
        </div>
      <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-orange-900 leading-tight">
            Which days are you working?
          </h3>
          <div className="text-sm text-orange-900/80 mt-1">
            <span className="font-semibold">{format(weekStart, 'd MMM')} – {format(weekEnd, 'd MMM yyyy')}</span>
            {' · '}Tap a day to tick it. Weekdays = full day, weekend = half day.
            {' · '}<span className="font-semibold text-red-700">Confirm Sat &amp; Sun</span>
            {' · '}Next week's rota by Thursday 6pm.
          </div>

        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekAnchor(subWeeks(weekAnchor, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekAnchor(new Date())}>
            This Week
          </Button>
          <Button variant="outline" size="sm" className="border-orange-400 text-orange-800 hover:bg-orange-100" onClick={() => setWeekAnchor(addWeeks(new Date(), 1))}>
            Next Week
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekAnchor(addWeeks(weekAnchor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>


      {isManagement && (
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Editing:</span>
          {agents.map((a) => {
            const active = a.id === selectedAgentId;
            const agentRows = rows.filter((r) => r.admin_user_id === a.id);
            const workingCount = agentRows.filter((r) => r.day_type !== 'off').length;
            const offCount = agentRows.filter((r) => r.day_type === 'off').length;
            const sat = days.find((d) => d.getDay() === 6);
            const sun = days.find((d) => d.getDay() === 0);
            const satRow = sat ? getRow(a.id, sat) : undefined;
            const sunRow = sun ? getRow(a.id, sun) : undefined;
            const satOn = satRow && satRow.day_type !== 'off';
            const sunOn = sunRow && sunRow.day_type !== 'off';
            return (
              <button
                key={a.id}
                onClick={() => setSelectedAgentId(a.id)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:bg-muted',
                )}
              >
                {displayName(a)}
                <span className={cn('ml-1.5', active ? 'opacity-90' : workingCount === 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground')}>
                  · {workingCount} day{workingCount === 1 ? '' : 's'}
                  {offCount > 0 && <span className="text-slate-500"> · {offCount} off</span>}
                  {satOn && sunOn ? ' · Sat+Sun' : satOn ? ' · Sat' : sunOn ? ' · Sun' : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}


      <div className="px-5 py-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading rota…</div>
        ) : !editingAgent ? (
          <div className="text-sm text-muted-foreground">No agent selected.</div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              {(() => {
                const wc = workingCountForAgent(editingAgent.id);
                const oc = offCountForAgent(editingAgent.id);
                if (wc > 0) {
                  return (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {displayName(editingAgent)} has {wc} working day{wc === 1 ? '' : 's'}{oc > 0 ? ` and ${oc} day${oc === 1 ? '' : 's'} off` : ''} logged for this week.
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {displayName(editingAgent)} has not confirmed any working days for this week yet.
                  </span>
                );
              })()}
              {(() => {
                const sat = days.find((d) => d.getDay() === 6);
                const sun = days.find((d) => d.getDay() === 0);
                const satRow = sat ? getRow(editingAgent.id, sat) : undefined;
                const sunRow = sun ? getRow(editingAgent.id, sun) : undefined;
                const satUnset = !satRow;
                const sunUnset = !sunRow;
                const satOff = satRow?.day_type === 'off';
                const sunOff = sunRow?.day_type === 'off';
                const satOn = satRow && !satOff;
                const sunOn = sunRow && !sunOff;
                if (satUnset && sunUnset) {
                  return (
                    <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Saturday and Sunday are not confirmed — tick working or mark as Off so managers know.
                    </span>
                  );
                }
                if (satUnset) {
                  return (
                    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Saturday is not confirmed (working or off).
                    </span>
                  );
                }
                if (sunUnset && satOn) {
                  return (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      Sunday is optional — currently not confirmed.
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Weekend confirmed{satOff || sunOff ? ` (${satOff ? 'Sat off' : ''}${satOff && sunOff ? ', ' : ''}${sunOff ? 'Sun off' : ''})` : ''}.
                  </span>
                );
              })()}
            </div>

            {/* BIG weekend quick-select — the fast path most people need */}
            <div className="mb-4 rounded-xl border-2 border-blue-300 bg-blue-50/50 dark:bg-blue-950/20 p-3">
              <div className="text-sm font-bold text-blue-900 dark:text-blue-200 mb-2">
                Working this weekend? Tap to confirm
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {days
                  .filter((d) => d.getDay() === 6 || d.getDay() === 0)
                  .map((d) => {
                    const row = getRow(editingAgent.id, d);
                    const isOff = row?.day_type === 'off';
                    const isWorking = !!row && !isOff;
                    const disabled = !canEditFor(editingAgent.id) || saving;
                    return (
                      <div
                        key={'wk-' + d.toISOString()}
                        className={cn(
                          'rounded-lg border-2 p-3 bg-background',
                          isWorking ? 'border-emerald-500' : isOff ? 'border-slate-400' : 'border-blue-200',
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xl font-extrabold text-foreground leading-none">
                            {format(d, 'EEEE')}
                            <span className="ml-2 text-base font-semibold text-muted-foreground">
                              {format(d, 'd MMM')}
                            </span>
                          </div>
                          {isWorking && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 text-sm font-bold">
                              <CheckCircle2 className="h-5 w-5" /> Done
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleDay(editingAgent.id, d, 'half_day')}
                            className={cn(
                              'h-14 rounded-lg border-2 text-sm font-bold flex items-center justify-center gap-1.5 transition-colors',
                              row?.day_type === 'half_day'
                                ? 'bg-blue-500 text-white border-blue-600'
                                : 'bg-background border-blue-300 text-blue-700 hover:bg-blue-50',

                              disabled && 'opacity-60 cursor-not-allowed',
                            )}
                          >
                            <Check className="h-5 w-5" strokeWidth={3} /> Half day
                          </button>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleDay(editingAgent.id, d, 'full_day')}
                            className={cn(
                              'h-14 rounded-lg border-2 text-sm font-bold flex items-center justify-center gap-1.5 transition-colors',
                              row?.day_type === 'full_day'
                                ? 'bg-emerald-600 text-white border-emerald-700'
                                : 'bg-background border-emerald-300 text-emerald-700 hover:bg-emerald-50',
                              disabled && 'opacity-60 cursor-not-allowed',
                            )}
                          >
                            <Check className="h-5 w-5" strokeWidth={3} /> Full day
                          </button>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleDay(editingAgent.id, d, 'off')}
                            className={cn(
                              'h-14 rounded-lg border-2 text-sm font-bold flex items-center justify-center gap-1.5 transition-colors',
                              isOff
                                ? 'bg-slate-600 text-white border-slate-700'
                                : 'bg-background border-slate-300 text-slate-600 hover:bg-slate-100',
                              disabled && 'opacity-60 cursor-not-allowed',
                            )}
                          >
                            <X className="h-5 w-5" strokeWidth={3} /> Not working
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>


            {/* 7-day calendar strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {days.map((d) => {
                const row = editingAgent ? getRow(editingAgent.id, d) : undefined;
                const weekend = isWeekend(d);
                const today = isToday(d);
                const disabled = !canEditFor(editingAgent!.id) || saving;
                const isOff = row?.day_type === 'off';
                const isWorking = !!row && !isOff;
                const hasAny = !!row;

                return (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      'rounded-lg border p-2 flex flex-col',
                      isWorking
                        ? (row?.day_type === 'half_day'
                            ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/25'
                            : 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20')

                        : isOff
                          ? 'border-slate-400 bg-slate-100/70 dark:bg-slate-900/40'
                          : weekend
                            ? 'border-blue-300 bg-blue-50/30 dark:bg-blue-950/20'
                            : 'border-border bg-background',
                      today && 'ring-2 ring-orange-500 ring-offset-1',
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <div className={cn('text-[10px] uppercase tracking-wide font-semibold',
                          weekend ? 'text-blue-600' : 'text-muted-foreground')}
                        >
                          {format(d, 'EEE')}
                          {today && <span className="ml-1 text-orange-600">• Today</span>}
                        </div>
                        <div className={cn('text-lg font-bold leading-tight',
                          today ? 'text-orange-600' : isWorking ? 'text-emerald-700' : isOff ? 'text-slate-600 line-through' : 'text-foreground')}
                        >
                          {format(d, 'd MMM')}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleDay(editingAgent!.id, d, isWorking ? undefined : (isWeekend(d) ? 'half_day' : 'full_day'))}
                        className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center border transition-colors',
                          isWorking
                            ? 'bg-emerald-500 border-emerald-600 text-white'
                            : isOff
                              ? 'bg-slate-400 border-slate-500 text-white'
                              : 'bg-background border-border text-muted-foreground hover:border-emerald-400 hover:text-emerald-600',
                          disabled && 'opacity-60 cursor-not-allowed',
                        )}
                        title={isWorking ? 'Working — click to clear' : isOff ? 'Marked off' : 'Tick on'}
                      >
                        {isWorking ? <Check className="h-4 w-4" strokeWidth={3} /> : <X className="h-4 w-4" strokeWidth={3} />}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1 mt-auto">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleDay(editingAgent!.id, d, 'full_day')}
                        className={cn(
                          'text-[11px] py-1 rounded border font-medium transition-colors',
                          row?.day_type === 'full_day'
                            ? 'bg-emerald-500 text-white border-emerald-600'
                            : 'bg-background hover:bg-emerald-50 border-border text-foreground',
                          disabled && 'opacity-60 cursor-not-allowed',
                        )}
                      >
                        Full
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleDay(editingAgent!.id, d, 'half_day')}
                        className={cn(
                          'text-[11px] py-1 rounded border font-medium transition-colors',
                          row?.day_type === 'half_day'
                            ? 'bg-blue-500 text-white border-blue-600'
                            : 'bg-background hover:bg-blue-50 border-border text-foreground',

                          disabled && 'opacity-60 cursor-not-allowed',
                        )}
                      >
                        Half
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleDay(editingAgent!.id, d, 'off')}
                        title="Mark this day as not working"
                        className={cn(
                          'text-[11px] py-1 rounded border font-medium transition-colors',
                          isOff
                            ? 'bg-slate-500 text-white border-slate-600'
                            : 'bg-background hover:bg-slate-100 border-border text-foreground',
                          disabled && 'opacity-60 cursor-not-allowed',
                        )}
                      >
                        Off
                      </button>
                    </div>
                    {hasAny && (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleDay(editingAgent!.id, d)}
                        className="text-[10px] text-muted-foreground hover:text-red-600 mt-1 underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                );
              })}
            </div>


            {/* Coverage summary — managers only; staff see their own rota only */}
            {isManagement && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">

              {days.map((d) => {
                const entries = agents.map((a) => ({ a, row: getRow(a.id, d) }));
                const working = entries.filter((x) => x.row && x.row.day_type !== 'off');
                const off = entries.filter((x) => x.row?.day_type === 'off');
                return (
                  <div
                    key={'sum-' + d.toISOString()}
                    className="rounded-md border border-border/60 bg-muted/20 p-2"
                  >
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                      {format(d, 'EEE d')} · {working.length} on
                      {off.length > 0 && <span className="text-slate-500"> · {off.length} off</span>}
                    </div>
                    {working.length === 0 && off.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground italic">Nobody</div>
                    ) : (
                      <ul className="text-[11px] space-y-0.5">
                        {working.map(({ a, row }) => (
                          <li key={a.id} className="flex items-center gap-1">
                            <span className="truncate text-foreground">{displayName(a)}</span>
                            {row!.day_type === 'half_day' && (
                              <span className="text-amber-600 text-[9px]">½</span>
                            )}
                          </li>
                        ))}
                        {off.map(({ a }) => (
                          <li key={a.id} className="flex items-center gap-1 text-slate-500 line-through">
                            <span className="truncate">{displayName(a)}</span>
                            <span className="text-[9px] no-underline">off</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
            )}

          </>
        )}
      </div>
    </section>
  );
};

export default WorkingWeekRotaCard;
