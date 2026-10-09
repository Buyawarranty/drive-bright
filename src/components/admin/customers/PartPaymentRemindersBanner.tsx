import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, differenceInCalendarDays } from 'date-fns';
import { BellRing, CalendarClock, ChevronDown, ChevronUp, PoundSterling, AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface ReminderRow {
  id: string;
  customer_id: string;
  total_due: number;
  next_due_date: string | null;
  reminder_note: string | null;
  status: string;
  created_at: string | null;
  customerName: string;
  customerEmail: string | null;
  paid: number;
}

interface Props {
  /** Optional: focus a customer record when a reminder is clicked. */
  onOpenCustomer?: (customerId: string, email?: string | null) => void;
  /** Managers only: allows marking the outstanding balance as received. */
  canMarkReceived?: boolean;
  /** Jump the list to the "Balance outstanding" filter. */
  onShowPendingList?: () => void;
}

const HOURS_24 = 24 * 60 * 60 * 1000;

/**
 * Top-of-page banner listing every part payment with money still outstanding.
 * Rows stay visible until a manager marks the payment received. Purely a
 * reminder/tracking surface — it never changes payment or pricing logic.
 */
export const PartPaymentRemindersBanner: React.FC<Props> = ({ onOpenCustomer, canMarkReceived, onShowPendingList }) => {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = React.useState(true);
  /** How many reminders the user closed the banner for. Reopens automatically when new ones appear. */
  const [dismissedCount, setDismissedCount] = React.useState<number>(() => {
    const stored = sessionStorage.getItem('pp-reminders-banner-dismissed-count');
    const n = stored ? parseInt(stored, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  });

  const dismiss = () => {
    setDismissedCount(visible.length);
    sessionStorage.setItem('pp-reminders-banner-dismissed-count', String(visible.length));
  };

  const { data: reminders = [] } = useQuery({
    queryKey: ['part-payment-reminders'],
    queryFn: async (): Promise<ReminderRow[]> => {
      const { data: plans, error } = await supabase
        .from('customer_part_payment_plans')
        .select('id, customer_id, total_due, next_due_date, reminder_note, status, created_at')
        .neq('status', 'completed')
        .order('created_at', { ascending: true })
        .limit(300);
      if (error) throw error;

      const live = plans ?? [];
      if (live.length === 0) return [];

      const ids = live.map((p: any) => p.customer_id);
      const [{ data: customers }, { data: payments }] = await Promise.all([
        supabase.from('customers').select('id, name, email').in('id', ids),
        supabase.from('customer_part_payments').select('customer_id, amount').in('customer_id', ids),
      ]);

      const nameById = new Map((customers ?? []).map((c: any) => [c.id, c]));
      const paidById = new Map<string, number>();
      (payments ?? []).forEach((p: any) => {
        paidById.set(p.customer_id, (paidById.get(p.customer_id) ?? 0) + Number(p.amount || 0));
      });

      return live
        .map((p: any) => ({
          id: p.id,
          customer_id: p.customer_id,
          total_due: Number(p.total_due || 0),
          next_due_date: p.next_due_date,
          reminder_note: p.reminder_note,
          status: p.status,
          created_at: p.created_at,
          customerName: nameById.get(p.customer_id)?.name || 'Unknown customer',
          customerEmail: nameById.get(p.customer_id)?.email ?? null,
          paid: paidById.get(p.customer_id) ?? 0,
        }))
        .filter(r => r.paid > 0 && Math.max(r.total_due - r.paid, 0) > 0);
    },
    refetchInterval: 2 * 60 * 1000,
  });

  /** Rows whose balance date is more than 60 days away stay hidden until 60 days remain. */
  const visible = reminders.filter(r => {
    if (!r.next_due_date) return true;
    return differenceInCalendarDays(new Date(r.next_due_date), new Date()) <= 60;
  });

  if (visible.length === 0 || visible.length <= dismissedCount) return null;

  const isUncollected24h = (r: ReminderRow) =>
    !!r.created_at && Date.now() - new Date(r.created_at).getTime() > HOURS_24;

  const uncollected = visible.filter(isUncollected24h).length;
  const overdue = visible.filter(
    r => r.next_due_date && differenceInCalendarDays(new Date(r.next_due_date), new Date()) < 0,
  ).length;
  const alarm = uncollected > 0 || overdue > 0;

  return (
    <div
      className={`rounded-lg border-2 shadow-sm ${
        alarm ? 'border-red-400 bg-red-50' : 'border-amber-400 bg-amber-50'
      }`}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              alarm ? 'bg-red-200 text-red-900' : 'bg-amber-200 text-amber-900'
            }`}
          >
            {alarm ? <AlertTriangle className="w-4 h-4" /> : <BellRing className="w-4 h-4" />}
          </div>
          <div>
            <div className={`text-sm font-semibold ${alarm ? 'text-red-900' : 'text-amber-900'}`}>
              {visible.length} part-payment balance{visible.length === 1 ? '' : 's'} pending
              {uncollected > 0 ? ` · ${uncollected} not collected within 24 hours` : ''}
              {overdue > 0 ? ` · ${overdue} past the balance date` : ''}
            </div>
            <div className={`text-xs ${alarm ? 'text-red-800' : 'text-amber-800'}`}>
              Every sale with a part payment received stays here until its remaining balance is confirmed.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onShowPendingList && (
            <Button variant="outline" size="sm" onClick={onShowPendingList}>
              Show pending list
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setExpanded(v => !v)}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Close banner"
            title="Close this banner — it comes back if new balances appear"
            className="h-9 w-9 p-0 hover:bg-black/10"
            onClick={dismiss}
          >
            <X className="w-6 h-6" strokeWidth={2.5} />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-black/10 divide-y divide-black/10">
          {visible.map(r => {
            const days = r.next_due_date
              ? differenceInCalendarDays(new Date(r.next_due_date), new Date())
              : null;
            const outstanding = Math.max(r.total_due - r.paid, 0);
            const late = isUncollected24h(r);
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                <Badge
                  variant="outline"
                  className={
                    days != null && days < 0
                      ? 'border-red-500 text-red-700'
                      : 'border-amber-500 text-amber-700'
                  }
                >
                  <CalendarClock className="w-3 h-3 mr-1" />
                  {days == null
                    ? 'No balance date'
                    : days < 0
                      ? `${Math.abs(days)}d overdue`
                      : days === 0
                        ? 'Due today'
                        : `In ${days}d`}
                </Badge>
                {late && (
                  <Badge className="bg-red-600 text-white hover:bg-red-600">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Not collected in 24h
                  </Badge>
                )}
                <button
                  type="button"
                  className="font-semibold underline-offset-2 hover:underline text-left"
                  onClick={() => onOpenCustomer?.(r.customer_id, r.customerEmail)}
                >
                  {r.customerName}
                </button>
                <span className="text-muted-foreground">{r.customerEmail}</span>
                <span className="flex items-center gap-1 font-medium">
                  <PoundSterling className="w-3 h-3" />
                  {outstanding.toFixed(2)} outstanding of £{r.total_due.toFixed(2)}
                </span>
                {r.created_at && (
                  <span className="text-xs text-muted-foreground">
                    taken {format(new Date(r.created_at), 'd MMM HH:mm')}
                  </span>
                )}
                {r.reminder_note && (
                  <span className="italic text-muted-foreground">“{r.reminder_note}”</span>
                )}
                <div className="ml-auto flex gap-1">
                  {onShowPendingList && (
                    <Button size="sm" variant="outline" onClick={onShowPendingList}>
                      See payment
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
