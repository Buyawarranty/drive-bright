import { useEffect, useState, useCallback } from 'react';
import { Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Props {
  userRole?: string | null;
  onClick?: () => void;
  className?: string;
}

interface Counts {
  morning: number;
  live: number;
  retry: number;
}

/**
 * Persistent header pill that shows how many leads are currently unassigned
 * and waiting to be pushed out. Visible on every admin page for management
 * roles. Clicking it jumps to the Lead Teams / allocation section.
 */
export const PendingLeadsPill = ({ userRole, onClick, className }: Props) => {
  const [counts, setCounts] = useState<Counts | null>(null);

  const canSee =
    userRole === 'admin' || userRole === 'super_admin' || userRole === 'sales_manager';

  const load = useCallback(async () => {
    if (!canSee) return;
    const lockCutoff = new Date(Date.now() - 7 * 60 * 1000).toISOString();
    const base = () =>
      supabase
        .from('sales_leads')
        .select('id', { count: 'exact', head: true })
        .is('assigned_to', null)
        .is('owner_agent', null)
        .not('status', 'in', '(lost,converted,fake_lead)')
        .or('pool_status.is.null,pool_status.in.(new,callback_booked,contacted)')
        .or(`locked_by.is.null,locked_at.lt.${lockCutoff}`);
    const [live, morning, retry] = await Promise.all([
      base().eq('queue', 'live_open_pool'),
      base().eq('queue', 'morning_call_queue'),
      base().eq('queue', 'retry_queue'),
    ]);
    setCounts({
      live: live.count ?? 0,
      morning: morning.count ?? 0,
      retry: retry.count ?? 0,
    });
  }, [canSee]);

  useEffect(() => {
    if (!canSee) return;
    load();
    const interval = setInterval(load, 60_000);
    const channel = supabase
      .channel('pending-leads-pill')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales_leads' },
        () => load(),
      )
      .subscribe();
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [canSee, load]);

  if (!canSee || !counts) return null;

  const total = counts.morning + counts.live + counts.retry;
  const tone =
    total === 0
      ? 'bg-muted text-muted-foreground border-border'
      : total > 20
      ? 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100'
      : total > 5
      ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
      : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100';

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${counts.morning} morning · ${counts.live} open pool · ${counts.retry} retry — click to allocate`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
        tone,
        className,
      )}
    >
      <Users className="h-3.5 w-3.5" />
      <span>{total}</span>
      <span className="hidden sm:inline font-normal opacity-80">
        {total === 1 ? 'lead waiting' : 'leads waiting'}
      </span>
      {total > 0 && (
        <span className="hidden md:inline text-[10px] opacity-75 font-normal ml-1">
          ({counts.morning}m · {counts.live}p{counts.retry ? ` · ${counts.retry}r` : ''})
        </span>
      )}
    </button>
  );
};

export default PendingLeadsPill;
