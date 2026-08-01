import { useEffect, useMemo, useState } from 'react';
import { format, isSameDay, isFuture, isToday } from 'date-fns';
import { CheckCircle2, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Slot = 'sat_am' | 'sat_pm' | 'sun_am' | 'sun_pm';

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
}

function getUpcomingWeekend(today = new Date()): { saturday: Date; sunday: Date } {
  const day = today.getDay(); // 0=Sun, 6=Sat
  const saturday = new Date(today);
  if (day === 6) {
    // today is Saturday — use this weekend
  } else if (day === 0) {
    // today is Sunday — yesterday's Saturday
    saturday.setDate(today.getDate() - 1);
  } else {
    saturday.setDate(today.getDate() + (6 - day));
  }
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  return { saturday, sunday };
}

const displayName = (a: AdminLite) =>
  `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email;

/**
 * "Are you working this weekend?" — simple Saturday / Sunday pickers.
 * Agents toggle their own weekend; managers can edit for anyone and see the roster.
 */
export const WeekendShiftsCard = ({ isManagement }: Props) => {
  const { user } = useAuth();
  const currentAdminId = useCurrentAdminId();
  const [agents, setAgents] = useState<AdminLite[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const weekend = useMemo(() => getUpcomingWeekend(), []);
  const satStr = format(weekend.saturday, 'yyyy-MM-dd');
  const sunStr = format(weekend.sunday, 'yyyy-MM-dd');

  const load = async () => {
    if (!currentAdminId) return;
    setLoading(true);

    if (!isManagement) {
      const [meRes, shiftsRes] = await Promise.all([
        supabase
          .from('admin_users')
          .select('id, first_name, last_name, email, role, is_active')
          .eq('id', currentAdminId)
          .maybeSingle(),
        (supabase as any)
          .from('agent_weekend_shifts')
          .select('id, admin_user_id, shift_date, slot')
          .eq('admin_user_id', currentAdminId)
          .in('shift_date', [satStr, sunStr]),
      ]);
      setAgents(meRes.data ? [meRes.data as AdminLite] : []);
      setShifts((shiftsRes.data as ShiftRow[]) || []);
      setLoading(false);
      return;
    }

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
        .in('shift_date', [satStr, sunStr]),
    ]);
    setAgents((agentsRes.data as AdminLite[]) || []);
    setShifts((shiftsRes.data as ShiftRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isManagement, currentAdminId, satStr, sunStr]);

  useEffect(() => {
    if (!currentAdminId) return;
    if (!isManagement) {
      setSelectedAgentId(currentAdminId);
    } else if (!selectedAgentId) {
      setSelectedAgentId(currentAdminId);
    }
  }, [currentAdminId, isManagement, selectedAgentId]);

  const canEditFor = (agentId: string) => isManagement || agentId === currentAdminId;

  const hasShift = (agentId: string, date: Date) =>
    shifts.some(
      (s) =>
        s.admin_user_id === agentId &&
        isSameDay(new Date(s.shift_date + 'T00:00:00'), date),
    );

  const toggleDay = async (agentId: string, date: Date) => {
    if (!canEditFor(agentId)) return;
    setSaving(true);
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = shifts.find(
      (s) => s.admin_user_id === agentId && s.shift_date === dateStr,
    );
    try {
      if (existing) {
        // Remove all slots for that day
        const { error } = await (supabase as any)
          .from('agent_weekend_shifts')
          .delete()
          .eq('admin_user_id', agentId)
          .eq('shift_date', dateStr);
        if (error) throw error;
        setShifts((prev) => prev.filter((s) => !(s.admin_user_id === agentId && s.shift_date === dateStr)));
      } else {
        // Insert a default AM slot
        const slot: Slot = date.getDay() === 6 ? 'sat_am' : 'sun_am';
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

  const editingAgent = agents.find((a) => a.id === selectedAgentId) ?? null;

  const workersForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return agents
      .filter((a) => shifts.some((s) => s.admin_user_id === a.id && s.shift_date === dateStr))
      .map(displayName);
  };

  const satWorkers = workersForDay(weekend.saturday);
  const sunWorkers = workersForDay(weekend.sunday);

  const renderDayBox = (date: Date, label: string, subtitle: string, accent: string) => {
    if (!editingAgent) return null;
    const on = hasShift(editingAgent.id, date);
    const disabled = !canEditFor(editingAgent.id) || saving;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => toggleDay(editingAgent.id, date)}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-8 transition-all',
          on
            ? `${accent} text-white border-transparent shadow-lg`
            : 'bg-card border-border text-foreground hover:border-primary/40 hover:bg-muted/40',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        {on && (
          <span className="absolute top-3 right-3">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </span>
        )}
        <span className="text-2xl font-extrabold tracking-tight">{label}</span>
        <span className={cn('text-sm font-medium', on ? 'text-white/90' : 'text-muted-foreground')}>
          {subtitle}
        </span>
        <span className={cn('text-xs mt-1', on ? 'text-white/80' : 'text-muted-foreground/70')}>
          {on ? 'You\'re working' : 'Tap to select'}
        </span>
      </button>
    );
  };

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground">
            Are you working this weekend?
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(weekend.saturday, 'EEE d MMM')} & {format(weekend.sunday, 'EEE d MMM')} — pick the days you're in.
          </p>
        </div>
      </div>

      {isManagement && agents.length > 1 && (
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Editing:</span>
          {agents.map((a) => {
            const active = a.id === selectedAgentId;
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
              </button>
            );
          })}
        </div>
      )}

      <div className="px-5 py-6">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : !editingAgent ? (
          <div className="text-sm text-muted-foreground">No agent selected.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderDayBox(
              weekend.saturday,
              'Saturday',
              format(weekend.saturday, 'd MMMM'),
              'bg-blue-600',
            )}
            {renderDayBox(
              weekend.sunday,
              'Sunday',
              format(weekend.sunday, 'd MMMM'),
              'bg-amber-600',
            )}
          </div>
        )}

        {isManagement && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/10 p-3">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">
                Working Saturday
              </div>
              {satWorkers.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">Nobody yet.</div>
              ) : (
                <p className="text-xs text-foreground font-medium">{satWorkers.join(', ')}</p>
              )}
            </div>
            <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/10 p-3">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">
                Working Sunday
              </div>
              {sunWorkers.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">Nobody yet.</div>
              ) : (
                <p className="text-xs text-foreground font-medium">{sunWorkers.join(', ')}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default WeekendShiftsCard;
