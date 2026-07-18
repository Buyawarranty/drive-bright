import { useEffect, useMemo, useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { toast } from 'sonner';

type Slot = 'sat_am' | 'sat_pm' | 'sun_am' | 'sun_pm';

const SLOT_META: Record<Slot, { label: string; time: string; day: 'sat' | 'sun' }> = {
  sat_am: { label: 'Sat AM', time: '9:00 – 13:00', day: 'sat' },
  sat_pm: { label: 'Sat PM', time: '13:00 – 17:00', day: 'sat' },
  sun_am: { label: 'Sun AM', time: '9:00 – 13:00', day: 'sun' },
  sun_pm: { label: 'Sun PM', time: '13:00 – 17:00', day: 'sun' },
};

interface AdminLite {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
}
interface ShiftRow {
  id: string;
  admin_user_id: string;
  shift_date: string;
  slot: Slot;
}

interface Props {
  isManagement: boolean;
  monthAnchor?: Date;
}

/**
 * Weekend Shifts sign-up.
 *
 * Agents pick which Sat/Sun slots they'll work each month. Sat AM (9–1) is
 * mandatory ×2. Sun is optional. Managers can see everyone's picks and edit
 * anyone's. The Allocate Leads panel reads the same data so weekend coverage
 * is transparent.
 */
export const WeekendShiftsCard = ({ isManagement, monthAnchor }: Props) => {
  const { user } = useAuth();
  const currentAdminId = useCurrentAdminId();
  const [month, setMonth] = useState<Date>(monthAnchor ?? new Date());
  const [agents, setAgents] = useState<AdminLite[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const weekendDays = useMemo(() => {
    const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
    return days.filter((d) => d.getDay() === 6 || d.getDay() === 0);
  }, [month]);

  const load = async () => {
    setLoading(true);
    const [agentsRes, shiftsRes] = await Promise.all([
      supabase
        .from('admin_users')
        .select('id, first_name, last_name, email, role, is_active')
        .eq('is_active', true)
        .in('role', ['sales', 'sales_lead', 'lead_gen', 'sales_manager'])
        .order('first_name', { ascending: true }),
      (supabase as any)
        .from('agent_weekend_shifts')
        .select('id, admin_user_id, shift_date, slot')
        .gte('shift_date', format(startOfMonth(month), 'yyyy-MM-dd'))
        .lte('shift_date', format(endOfMonth(month), 'yyyy-MM-dd')),
    ]);
    setAgents((agentsRes.data as AdminLite[]) || []);
    setShifts((shiftsRes.data as ShiftRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  // Which agent are we editing? Managers can pick anyone; agents lock to themselves.
  useEffect(() => {
    if (!currentAdminId) return;
    if (!isManagement) {
      setSelectedAgentId(currentAdminId);
    } else if (!selectedAgentId) {
      setSelectedAgentId(currentAdminId);
    }
  }, [currentAdminId, isManagement, selectedAgentId]);

  const canEditFor = (agentId: string) =>
    isManagement || agentId === currentAdminId;

  const hasShift = (agentId: string, date: Date, slot: Slot) =>
    shifts.some(
      (s) =>
        s.admin_user_id === agentId &&
        s.slot === slot &&
        isSameDay(new Date(s.shift_date + 'T00:00:00'), date),
    );

  const toggleShift = async (agentId: string, date: Date, slot: Slot) => {
    if (!canEditFor(agentId)) return;
    setSaving(true);
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = shifts.find(
      (s) =>
        s.admin_user_id === agentId &&
        s.slot === slot &&
        s.shift_date === dateStr,
    );
    try {
      if (existing) {
        const { error } = await (supabase as any)
          .from('agent_weekend_shifts')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
        setShifts((prev) => prev.filter((s) => s.id !== existing.id));
      } else {
        const { data, error } = await (supabase as any)
          .from('agent_weekend_shifts')
          .insert({
            admin_user_id: agentId,
            shift_date: dateStr,
            slot,
            created_by: user?.id ?? null,
          })
          .select('id, admin_user_id, shift_date, slot')
          .single();
        if (error) throw error;
        setShifts((prev) => [...prev, data as ShiftRow]);
      }
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not update weekend shift');
    } finally {
      setSaving(false);
    }
  };

  const displayName = (a: AdminLite) =>
    `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email;

  const editingAgent = agents.find((a) => a.id === selectedAgentId) ?? null;

  const satAmCountForAgent = (agentId: string) =>
    shifts.filter((s) => s.admin_user_id === agentId && s.slot === 'sat_am').length;

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <div className="px-5 py-4 border-b border-border flex items-start gap-2">
        <CalendarDays className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground">
            Weekend Shifts — {format(month, 'MMMM yyyy')}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Select which Saturdays and Sundays you're working this month.
            <span className="font-medium text-foreground"> Everyone must pick at least 2 Saturday mornings (9am–1pm).</span>{' '}
            Sundays are optional. Managers see and can edit everyone's picks; leads are allocated to whoever's signed up.
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(subMonths(month, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isManagement && (
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Editing:</span>
          {agents.map((a) => {
            const active = a.id === selectedAgentId;
            const satCount = satAmCountForAgent(a.id);
            return (
              <button
                key={a.id}
                onClick={() => setSelectedAgentId(a.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:bg-muted'
                }`}
              >
                {displayName(a)}
                <span className={`ml-1.5 ${active ? 'opacity-90' : 'text-muted-foreground'}`}>
                  · {satCount} Sat AM
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="px-5 py-4">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading weekend shifts…</div>
        ) : weekendDays.length === 0 ? (
          <div className="text-sm text-muted-foreground">No weekend days in this month.</div>
        ) : !editingAgent ? (
          <div className="text-sm text-muted-foreground">No agent selected.</div>
        ) : (
          <>
            {editingAgent && (
              <div className="mb-3 flex items-center gap-2 text-xs">
                {satAmCountForAgent(editingAgent.id) >= 2 ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {displayName(editingAgent)} has met the 2 × Saturday AM minimum.
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {displayName(editingAgent)} still needs{' '}
                    {2 - satAmCountForAgent(editingAgent.id)} more Saturday AM shift
                    {2 - satAmCountForAgent(editingAgent.id) === 1 ? '' : 's'} this month.
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {weekendDays.map((d) => {
                const isSat = d.getDay() === 6;
                const slots: Slot[] = isSat ? ['sat_am', 'sat_pm'] : ['sun_am', 'sun_pm'];
                const signups = agents
                  .map((a) => ({
                    a,
                    slots: slots.filter((s) => hasShift(a.id, d, s)),
                  }))
                  .filter((x) => x.slots.length > 0);
                return (
                  <div
                    key={d.toISOString()}
                    className={`rounded-lg border ${
                      isSat ? 'border-primary/30 bg-primary/[0.03]' : 'border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/10'
                    } p-3`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-foreground">
                        {format(d, 'EEE d MMM')}
                      </div>
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
                        {isSat ? 'Saturday' : 'Sunday (optional)'}
                      </span>
                    </div>

                    {editingAgent && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {slots.map((slot) => {
                          const on = hasShift(editingAgent.id, d, slot);
                          const disabled = !canEditFor(editingAgent.id) || saving;
                          return (
                            <label
                              key={slot}
                              className={`inline-flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-md border cursor-pointer transition-colors ${
                                on
                                  ? 'bg-primary/10 border-primary/50 text-foreground'
                                  : 'bg-background border-border text-muted-foreground hover:bg-muted/60'
                              } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                              <Checkbox
                                checked={on}
                                disabled={disabled}
                                onCheckedChange={() => toggleShift(editingAgent.id, d, slot)}
                              />
                              <span className="font-medium">{SLOT_META[slot].label}</span>
                              <span className="text-muted-foreground">{SLOT_META[slot].time}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    <div className="pt-1 border-t border-border/60 mt-1">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                        Working this day
                      </div>
                      {signups.length === 0 ? (
                        <div className="text-xs text-muted-foreground italic">Nobody signed up yet.</div>
                      ) : (
                        <ul className="text-xs space-y-0.5">
                          {signups.map(({ a, slots: sl }) => (
                            <li key={a.id} className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground">{displayName(a)}</span>
                              <span className="text-muted-foreground">
                                — {sl.map((s) => SLOT_META[s].label.replace(/^(Sat|Sun) /, '')).join(' + ')}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
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

export default WeekendShiftsCard;
