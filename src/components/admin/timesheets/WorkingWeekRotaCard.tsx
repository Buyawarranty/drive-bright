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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { toast } from 'sonner';

type DayType = 'full_day' | 'half_day';

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
  // Default to NEXT week (staff need to submit next week's rota by Thu 6pm)
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => addWeeks(new Date(), 1));
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
  }, [weekStart.toISOString()]);

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
        const dayType: DayType = forceType ?? 'full_day';
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
  const daysCountForAgent = (agentId: string) =>
    rows.filter((r) => r.admin_user_id === agentId).length;

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <div className="px-5 py-4 border-b border-border flex items-start gap-2">
        <CalendarDays className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground">
            Working Week Rota — {format(weekStart, 'd MMM')} – {format(weekEnd, 'd MMM yyyy')}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tick every day you'll be working this week (Mon–Sun).{' '}
            <span className="font-medium text-foreground">
              Submit next week's rota by Thursday 6pm
            </span>{' '}
            so managers can allocate leads and duties. Full day is default — click a day again to switch to half day or remove it.
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekAnchor(subWeeks(weekAnchor, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekAnchor(addWeeks(new Date(), 1))}>
            Next Week
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekAnchor(new Date())}>
            This Week
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
            const count = daysCountForAgent(a.id);
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
                <span className={cn('ml-1.5', active ? 'opacity-90' : count === 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground')}>
                  · {count} day{count === 1 ? '' : 's'}
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
            <div className="mb-3 flex items-center gap-2 text-xs">
              {daysCountForAgent(editingAgent.id) > 0 ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {displayName(editingAgent)} has {daysCountForAgent(editingAgent.id)} day{daysCountForAgent(editingAgent.id) === 1 ? '' : 's'} logged for this week.
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {displayName(editingAgent)} has not confirmed any working days for this week yet.
                </span>
              )}
            </div>

            {/* 7-day calendar strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {days.map((d) => {
                const row = editingAgent ? getRow(editingAgent.id, d) : undefined;
                const weekend = isWeekend(d);
                const today = isToday(d);
                const disabled = !canEditFor(editingAgent!.id) || saving;

                return (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      'rounded-lg border p-2 flex flex-col',
                      weekend ? 'border-blue-300 bg-blue-50/60 dark:bg-blue-950/20' : 'border-border bg-background',
                      today && 'ring-2 ring-orange-500 ring-offset-1',
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <div className={cn('text-[10px] uppercase tracking-wide font-semibold',
                          weekend ? 'text-blue-600' : 'text-muted-foreground')}>
                          {format(d, 'EEE')}
                          {today && <span className="ml-1 text-orange-600">• Today</span>}
                        </div>
                        <div className={cn('text-lg font-bold leading-tight',
                          today ? 'text-orange-600' : 'text-foreground')}>
                          {format(d, 'd MMM')}
                        </div>
                      </div>
                      {row && (
                        <div className={cn('w-6 h-6 rounded-full flex items-center justify-center',
                          row.day_type === 'full_day' ? 'bg-emerald-500' : 'bg-amber-500')}>
                          <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1 mt-auto">
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
                            ? 'bg-amber-500 text-white border-amber-600'
                            : 'bg-background hover:bg-amber-50 border-border text-foreground',
                          disabled && 'opacity-60 cursor-not-allowed',
                        )}
                      >
                        Half
                      </button>
                    </div>
                    {row && (
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

            {/* Coverage summary — who is on each day */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {days.map((d) => {
                const signups = agents
                  .map((a) => ({ a, row: getRow(a.id, d) }))
                  .filter((x) => !!x.row);
                return (
                  <div
                    key={'sum-' + d.toISOString()}
                    className="rounded-md border border-border/60 bg-muted/20 p-2"
                  >
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                      {format(d, 'EEE d')} · {signups.length} on
                    </div>
                    {signups.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground italic">Nobody</div>
                    ) : (
                      <ul className="text-[11px] space-y-0.5">
                        {signups.map(({ a, row }) => (
                          <li key={a.id} className="flex items-center gap-1">
                            <span className="truncate text-foreground">{displayName(a)}</span>
                            {row!.day_type === 'half_day' && (
                              <span className="text-amber-600 text-[9px]">½</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default WorkingWeekRotaCard;
