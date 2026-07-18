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

  // Thursday (current week) 18:00 — deadline that flips banner to red/blocking.
  const deadline = useMemo(() => {
    const d = new Date(thursdayStart);
    d.setHours(18, 0, 0, 0);
    return d;
  }, [thursdayStart]);

  const now = new Date();
  const beforeThursday = now < thursdayStart;
  const pastDeadline = now >= deadline;

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

  // Only show from Thursday onwards.
  if (beforeThursday) return null;
  if (!applicable || hasSubmitted !== false) return null;
  // Before deadline: dismissible reminder. After deadline: blocking, cannot dismiss.
  if (!pastDeadline && dismissedThisWeek) return null;

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
      className={cn(
        'sticky top-0 z-[60] w-full border-b px-4 py-2.5 text-sm',
        pastDeadline
          ? 'bg-red-600 text-white border-red-700 animate-pulse'
          : 'bg-amber-100 text-amber-900 border-amber-300',
      )}
      role="alert"
    >
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        {pastDeadline ? (
          <AlertTriangle className="h-5 w-5 shrink-0" />
        ) : (
          <CalendarClock className="h-5 w-5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          {pastDeadline ? (
            <strong className="font-bold uppercase tracking-wide">Action required · Please update your calendar</strong>
          ) : (
            <strong className="font-semibold">Reminder</strong>
          )}
          <span className="ml-2">
            Please tick which days you'll be working next week ({format(nextWeekStart, 'd MMM')} – {format(nextWeekEnd, 'd MMM')}) on your Working Week Rota.{' '}
            {pastDeadline
              ? 'The Thursday 6pm deadline has passed — leads cannot be allocated to you until this is completed.'
              : 'Deadline: Thursday 6pm.'}
          </span>
        </div>
        <Link
          to="/admin-dashboard/?tab=timesheets"
          className={cn(
            'px-3 py-1.5 rounded font-semibold text-xs whitespace-nowrap',
            pastDeadline
              ? 'bg-white text-red-700 hover:bg-red-50'
              : 'bg-amber-600 text-white hover:bg-amber-700',
          )}
        >
          Update Calendar
        </Link>
        {!pastDeadline && (
          <button
            onClick={dismiss}
            className="p-1 rounded hover:bg-amber-200 shrink-0"
            aria-label="Dismiss until next reminder"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default WorkingWeekReminderBanner;
