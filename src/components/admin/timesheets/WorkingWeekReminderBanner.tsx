import { useEffect, useMemo, useState } from 'react';
import { startOfWeek, endOfWeek, addWeeks, format } from 'date-fns';
import { AlertTriangle, CalendarClock, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { cn } from '@/lib/utils';


const ROLES_REQUIRED = ['sales', 'sales_lead', 'sales_manager', 'lead_gen', 'claims_agent', 'claims_manager'];

/**
 * Working Week Reminder — sticky top-of-screen banner shown to sales/claims staff
 * who haven't submitted their next-week rota. Turns to red "error" mode after
 * Thursday 6pm London time until they've added at least one working day.
 */
export const WorkingWeekReminderBanner = ({ userRole }: { userRole: string | null }) => {
  const { session } = useAuth();
  const adminId = useCurrentAdminId();
  const navigate = useNavigate();
  const [hasSubmitted, setHasSubmitted] = useState<boolean | null>(null);
  const [dismissedThisWeek, setDismissedThisWeek] = useState(false);

  const nextWeekStart = useMemo(() => startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }), []);
  const nextWeekEnd = useMemo(() => endOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 }), []);

  // Thursday (current week) 00:00 — earliest moment the banner may appear.
  const thursdayStart = useMemo(() => {
    const thu = new Date(nextWeekStart);
    thu.setDate(thu.getDate() - 4);
    thu.setHours(0, 0, 0, 0);
    return thu;
  }, [nextWeekStart]);

  // The upcoming weekend (Sat/Sun of the current week).
  const saturday = useMemo(() => {
    const d = new Date(thursdayStart);
    d.setDate(d.getDate() + 2);
    return d;
  }, [thursdayStart]);
  const sunday = useMemo(() => {
    const d = new Date(thursdayStart);
    d.setDate(d.getDate() + 3);
    return d;
  }, [thursdayStart]);

  const now = new Date();
  // Polite nudge only — Thursday and Friday, never at the weekend or early week.
  const dow = now.getDay(); // 4 = Thu, 5 = Fri
  const isReminderDay = dow === 4 || dow === 5;

  const applicable = !!userRole && ROLES_REQUIRED.includes(userRole);

  useEffect(() => {
    const key = `wwrota-dismissed-${format(nextWeekStart, 'yyyy-MM-dd')}`;
    if (localStorage.getItem(key)) setDismissedThisWeek(true);
  }, [nextWeekStart]);

  useEffect(() => {
    if (!applicable || !adminId) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('agent_working_days')
        .select('id')
        .eq('admin_user_id', adminId)
        .gte('work_date', format(nextWeekStart, 'yyyy-MM-dd'))
        .lte('work_date', format(nextWeekEnd, 'yyyy-MM-dd'))
        .limit(1);
      if (!cancelled) setHasSubmitted(!!(data && data.length > 0));
    })();
    return () => {
      cancelled = true;
    };
  }, [applicable, adminId, nextWeekStart, nextWeekEnd, session?.user?.id]);

  if (!isReminderDay) return null;
  if (!applicable || hasSubmitted !== false) return null;
  if (dismissedThisWeek) return null;

  const dismiss = () => {
    const key = `wwrota-dismissed-${format(nextWeekStart, 'yyyy-MM-dd')}`;
    localStorage.setItem(key, '1');
    setDismissedThisWeek(true);
  };

  const goToRota = () => {
    navigate('/admin-dashboard?tab=timesheets');
    // Give the tab a beat to mount, then scroll the rota card into view.
    setTimeout(() => {
      const el = document.getElementById('working-week-rota');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
  };

  return (
    <div
      className="sticky top-0 z-[60] w-full border-b border-blue-300 bg-blue-100 px-4 py-2.5 text-sm text-blue-900"
      role="status"
    >
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <CalendarClock className="h-5 w-5 shrink-0" />
        <div className="flex-1 min-w-0">
          <strong className="font-semibold">Are you working this weekend?</strong>
          <span className="ml-2">
            Please mark your days ({format(saturday, 'EEE d MMM')} &amp; {format(sunday, 'EEE d MMM')}) plus next week
            ({format(nextWeekStart, 'd MMM')} – {format(nextWeekEnd, 'd MMM')}) on your Working Week Rota.
          </span>
        </div>
        <button
          type="button"
          onClick={goToRota}
          className="px-3 py-1.5 rounded font-semibold text-xs whitespace-nowrap bg-blue-600 text-white hover:bg-blue-700"
        >
          Mark my days
        </button>

        <button
          onClick={dismiss}
          className="p-1.5 rounded-md hover:bg-blue-200 shrink-0 text-blue-800"
          aria-label="Close reminder"
        >
          <X className="h-6 w-6" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};

export default WorkingWeekReminderBanner;
