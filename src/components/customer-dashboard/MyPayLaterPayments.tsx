import React, { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { BAW_PAYLATER_LABEL } from '@/lib/bawPayLater';

/**
 * My payments — the customer's yearly BAW PayLater collections.
 * Only shows when the customer actually has a yearly payment plan.
 */

interface ScheduleRow {
  id: string;
  year_number: number;
  amount: number;
  due_date: string;
  status: string;
  paid_at: string | null;
}

const gbp = (n: number | null | undefined) => `£${Math.round(Number(n) || 0).toLocaleString('en-GB')}`;

const MyPayLaterPayments: React.FC<{ customerId?: string | null }> = ({ customerId }) => {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase
        .from('baw_paylater_schedules')
        .select('id, year_number, amount, due_date, status, paid_at')
        .order('year_number', { ascending: true });
      if (customerId) query = query.eq('customer_id', customerId);
      const { data } = await query;
      if (!cancelled) {
        setRows((data || []) as ScheduleRow[]);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [customerId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking your payments…
      </div>
    );
  }

  if (rows.length === 0) return null;

  const outstanding = rows.filter((r) => r.status === 'pending');

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-900">Your payments — {BAW_PAYLATER_LABEL}</h3>
        {outstanding.length > 0 && (
          <Badge className="bg-amber-500 hover:bg-amber-500">
            {gbp(outstanding.reduce((a, r) => a + Number(r.amount || 0), 0))} still to pay
          </Badge>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-600">
        You pay for your cover one year at a time. We take each payment on your policy anniversary.
      </p>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-md border bg-white px-3 py-2">
            <div>
              <div className="text-sm font-semibold">Year {r.year_number}</div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <CalendarClock className="h-3 w-3" />
                {r.status === 'paid' && r.paid_at
                  ? `Paid ${new Date(r.paid_at).toLocaleDateString('en-GB')}`
                  : `Due ${new Date(r.due_date).toLocaleDateString('en-GB')}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{gbp(r.amount)}</span>
              {r.status === 'paid' ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Paid
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-400 text-amber-700">Payment pending</Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyPayLaterPayments;
