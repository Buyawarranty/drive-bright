import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, differenceInCalendarDays, addDays } from 'date-fns';
import { BellRing, CalendarClock, ChevronDown, ChevronUp, PoundSterling } from 'lucide-react';

interface ReminderRow {
  id: string;
  customer_id: string;
  total_due: number;
  next_due_date: string | null;
  reminder_note: string | null;
  status: string;
  customerName: string;
  customerEmail: string | null;
  paid: number;
}

interface Props {
  /** Optional: focus a customer record when a reminder is clicked. */
  onOpenCustomer?: (customerId: string) => void;
}

/**
 * Top-of-page banner listing part payment reminders that are due, due soon or overdue.
 * Purely a reminder surface — it never changes payment or pricing logic.
 */
export const PartPaymentRemindersBanner: React.FC<Props> = ({ onOpenCustomer }) => {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = React.useState(true);

  const { data: reminders = [] } = useQuery({
    queryKey: ['part-payment-reminders'],
    queryFn: async (): Promise<ReminderRow[]> => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const horizon = format(addDays(new Date(), 3), 'yyyy-MM-dd');

      const { data: plans, error } = await supabase
        .from('customer_part_payment_plans')
        .select('id, customer_id, total_due, next_due_date, reminder_note, reminder_enabled, reminder_dismissed_until, status')
        .neq('status', 'completed')
        .eq('reminder_enabled', true)
        .not('next_due_date', 'is', null)
        .lte('next_due_date', horizon)
        .order('next_due_date', { ascending: true });
      if (error) throw error;

      const live = (plans ?? []).filter(
        (p: any) => !p.reminder_dismissed_until || p.reminder_dismissed_until < today,
      );
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

      return live.map((p: any) => ({
        id: p.id,
        customer_id: p.customer_id,
        total_due: Number(p.total_due || 0),
        next_due_date: p.next_due_date,
        reminder_note: p.reminder_note,
        status: p.status,
        customerName: nameById.get(p.customer_id)?.name || 'Unknown customer',
        customerEmail: nameById.get(p.customer_id)?.email ?? null,
        paid: paidById.get(p.customer_id) ?? 0,
      }));
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const snooze = async (planId: string, days: number) => {
    const until = format(addDays(new Date(), days), 'yyyy-MM-dd');
    const { error } = await supabase
      .from('customer_part_payment_plans')
      .update({ reminder_dismissed_until: until })
      .eq('id', planId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Reminder snoozed for ${days} day${days === 1 ? '' : 's'}`);
    queryClient.invalidateQueries({ queryKey: ['part-payment-reminders'] });
  };

  if (reminders.length === 0) return null;

  const overdue = reminders.filter(
    r => r.next_due_date && differenceInCalendarDays(new Date(r.next_due_date), new Date()) < 0,
  ).length;

  return (
    <div
      className={`rounded-lg border-2 shadow-sm ${
        overdue > 0 ? 'border-red-400 bg-red-50' : 'border-amber-400 bg-amber-50'
      }`}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full ${
              overdue > 0 ? 'bg-red-200 text-red-900' : 'bg-amber-200 text-amber-900'
            }`}
          >
            <BellRing className="w-4 h-4" />
          </div>
          <div>
            <div className={`text-sm font-semibold ${overdue > 0 ? 'text-red-900' : 'text-amber-900'}`}>
              {reminders.length} part payment reminder{reminders.length === 1 ? '' : 's'}
              {overdue > 0 ? ` · ${overdue} overdue` : ''}
            </div>
            <div className={`text-xs ${overdue > 0 ? 'text-red-800' : 'text-amber-800'}`}>
              Chase the remaining balance so the order can be completed.
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(v => !v)}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-black/10 divide-y divide-black/10">
          {reminders.map(r => {
            const days = r.next_due_date
              ? differenceInCalendarDays(new Date(r.next_due_date), new Date())
              : null;
            const outstanding = Math.max(r.total_due - r.paid, 0);
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
                    ? '—'
                    : days < 0
                      ? `${Math.abs(days)}d overdue`
                      : days === 0
                        ? 'Due today'
                        : `In ${days}d`}
                </Badge>
                <button
                  type="button"
                  className="font-semibold underline-offset-2 hover:underline text-left"
                  onClick={() => onOpenCustomer?.(r.customer_id)}
                >
                  {r.customerName}
                </button>
                <span className="text-muted-foreground">{r.customerEmail}</span>
                <span className="flex items-center gap-1 font-medium">
                  <PoundSterling className="w-3 h-3" />
                  {outstanding.toFixed(2)} outstanding
                </span>
                {r.reminder_note && (
                  <span className="italic text-muted-foreground">“{r.reminder_note}”</span>
                )}
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => snooze(r.id, 1)}>
                    Snooze 1d
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => snooze(r.id, 7)}>
                    7d
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
