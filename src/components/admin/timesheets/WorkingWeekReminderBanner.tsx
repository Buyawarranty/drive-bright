import { useEffect, useMemo, useState } from 'react';
import { format, startOfWeek } from 'date-fns';
import { CalendarClock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const ROLES_REQUIRED = ['sales', 'sales_lead', 'sales_manager', 'lead_gen', 'claims_agent', 'claims_manager'];

/**
 * Weekend rota pop-up — shown to sales/claims staff on Thursday and Friday only.
 * They tick Saturday and/or Sunday and it's saved straight away: no page change,
 * no navigation to the rota page.
 */
export const WorkingWeekReminderBanner = ({ userRole }: { userRole: string | null }) => {
  const { user } = useAuth();
  const adminId = useCurrentAdminId();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Saturday / Sunday of the current week (week starts Monday).
  const { saturday, sunday, weekKey } = useMemo(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const sat = new Date(monday);
    sat.setDate(sat.getDate() + 5);
    const sun = new Date(monday);
    sun.setDate(sun.getDate() + 6);
    return { saturday: sat, sunday: sun, weekKey: format(monday, 'yyyy-MM-dd') };
  }, []);

  const dow = new Date().getDay(); // 4 = Thu, 5 = Fri
  const isReminderDay = dow === 4 || dow === 5;
  const applicable = !!userRole && ROLES_REQUIRED.includes(userRole);

  useEffect(() => {
    if (!isReminderDay || !applicable || !adminId) return;
    if (localStorage.getItem(`wwrota-answered-${weekKey}`)) return;

    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('agent_working_days')
        .select('id')
        .eq('admin_user_id', adminId)
        .gte('work_date', format(saturday, 'yyyy-MM-dd'))
        .lte('work_date', format(sunday, 'yyyy-MM-dd'))
        .limit(1);
      if (!cancelled && !(data && data.length > 0)) setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isReminderDay, applicable, adminId, saturday, sunday, weekKey]);

  const closeForWeek = () => {
    localStorage.setItem(`wwrota-answered-${weekKey}`, '1');
    setOpen(false);
  };

  const toggle = (dateStr: string) => setSelected((prev) => ({ ...prev, [dateStr]: !prev[dateStr] }));

  const save = async () => {
    const days = [saturday, sunday].map((d) => format(d, 'yyyy-MM-dd')).filter((d) => selected[d]);
    if (days.length === 0) {
      closeForWeek();
      toast.success('Thanks — marked as not working this weekend.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('agent_working_days').insert(
        days.map((work_date) => ({
          admin_user_id: adminId,
          work_date,
          day_type: 'half_day',
          created_by: user?.id ?? null,
        }))
      );
      if (error) throw error;
      toast.success(`You're down to work ${days.length === 2 ? 'Saturday and Sunday' : format(new Date(days[0]), 'EEEE')}.`);
      closeForWeek();
    } catch (e: any) {
      toast.error(e.message || 'Could not save your days');
    } finally {
      setSaving(false);
    }
  };

  if (!isReminderDay || !applicable) return null;

  const dayButton = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const on = !!selected[dateStr];
    return (
      <button
        key={dateStr}
        type="button"
        onClick={() => toggle(dateStr)}
        className={`flex-1 rounded-lg border-2 px-4 py-4 text-left transition ${
          on ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
        }`}
        aria-pressed={on}
      >
        <div className="text-base font-semibold">{format(date, 'EEEE')}</div>
        <div className="text-xs text-muted-foreground">{format(date, 'd MMM')}</div>
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeForWeek())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Are you working this weekend?
          </DialogTitle>
          <DialogDescription>Tap the days you're working — it's saved right here.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-3">
          {dayButton(saturday)}
          {dayButton(sunday)}
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={closeForWeek} className="flex-1">
            Not this weekend
          </Button>
          <Button onClick={save} disabled={saving} className="flex-1">
            {saving ? 'Saving…' : 'Save my days'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WorkingWeekReminderBanner;
