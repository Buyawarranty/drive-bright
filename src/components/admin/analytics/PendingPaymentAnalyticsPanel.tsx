import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Pending payment analytics — money sold but not yet in the bank.
 *
 * Read-only panel. Two streams:
 *  1. Orders sitting on "Pending Payment" (deferred / pay-by-link sales awaiting first payment)
 *  2. BAW PayLater yearly instalments still to collect
 */

interface PendingOrder {
  id: string;
  name: string | null;
  email: string | null;
  final_amount: number | null;
  signup_date: string | null;
  warranty_reference_number: string | null;
}

interface PendingSchedule {
  id: string;
  customer_id: string | null;
  warranty_reference_number: string | null;
  year_number: number | null;
  amount: number | null;
  due_date: string | null;
  customers?: { name: string | null; email: string | null } | null;
}

const money = (n: number) => `£${Math.round(n).toLocaleString()}`;

const fmtDate = (value: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export function PendingPaymentAnalyticsPanel() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [schedules, setSchedules] = useState<PendingSchedule[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [ordersRes, schedulesRes] = await Promise.all([
          supabase
            .from('customers')
            .select('id, name, email, final_amount, signup_date, warranty_reference_number')
            .ilike('status', 'pending payment')
            .eq('is_deleted', false)
            .order('signup_date', { ascending: false })
            .limit(500),
          supabase
            .from('baw_paylater_schedules')
            .select('id, customer_id, warranty_reference_number, year_number, amount, due_date, customers(name, email)')
            .eq('status', 'pending')
            .order('due_date', { ascending: true })
            .limit(500),
        ]);

        if (cancelled) return;
        setOrders((ordersRes.data as PendingOrder[]) || []);
        setSchedules((schedulesRes.data as unknown as PendingSchedule[]) || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);

    const ordersTotal = orders.reduce((s, o) => s + (Number(o.final_amount) || 0), 0);
    const schedulesTotal = schedules.reduce((s, r) => s + (Number(r.amount) || 0), 0);

    let overdue = 0;
    let overdueCount = 0;
    let dueSoon = 0;
    let dueSoonCount = 0;

    schedules.forEach(r => {
      const amount = Number(r.amount) || 0;
      if (!r.due_date) return;
      const due = new Date(r.due_date);
      if (Number.isNaN(due.getTime())) return;
      due.setHours(0, 0, 0, 0);
      if (due < today) {
        overdue += amount;
        overdueCount += 1;
      } else if (due <= in30) {
        dueSoon += amount;
        dueSoonCount += 1;
      }
    });

    return {
      ordersTotal,
      schedulesTotal,
      combined: ordersTotal + schedulesTotal,
      overdue,
      overdueCount,
      dueSoon,
      dueSoonCount,
    };
  }, [orders, schedules]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-amber-300/70">
          <CardHeader className="pb-2">
            <CardDescription>Total still to collect</CardDescription>
            <CardTitle className="text-2xl text-amber-700">{money(totals.combined)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {orders.length + schedules.length} payment{orders.length + schedules.length === 1 ? '' : 's'} outstanding
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Orders awaiting first payment</CardDescription>
            <CardTitle className="text-2xl">{money(totals.ordersTotal)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{orders.length} order{orders.length === 1 ? '' : 's'}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>BAW PayLater yearly payments</CardDescription>
            <CardTitle className="text-2xl">{money(totals.schedulesTotal)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{schedules.length} instalment{schedules.length === 1 ? '' : 's'}</CardContent>
        </Card>

        <Card className="border-red-300/70">
          <CardHeader className="pb-2">
            <CardDescription>Overdue</CardDescription>
            <CardTitle className="text-2xl text-red-600">{money(totals.overdue)}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {totals.overdueCount} overdue · {money(totals.dueSoon)} due in next 30 days ({totals.dueSoonCount})
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orders awaiting first payment</CardTitle>
          <CardDescription>Sales confirmed on a payment link or deferred payment, not yet collected — excluded from revenue until paid.</CardDescription>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing waiting — every order has been collected.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4">Reference</th>
                    <th className="py-2 pr-4">Sold</th>
                    <th className="py-2 pr-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 50).map(o => (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <div className="font-medium">{o.name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{o.email || '—'}</div>
                      </td>
                      <td className="py-2 pr-4 text-xs">{o.warranty_reference_number || '—'}</td>
                      <td className="py-2 pr-4 text-xs">{fmtDate(o.signup_date)}</td>
                      <td className="py-2 pr-4 text-right font-semibold">{money(Number(o.final_amount) || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orders.length > 50 && (
                <p className="text-xs text-muted-foreground mt-2">Showing the 50 most recent of {orders.length}.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>BAW PayLater yearly payments to collect</CardTitle>
          <CardDescription>Each remaining yearly instalment on 2 and 3 year cover paid year by year.</CardDescription>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No yearly payments outstanding.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4">Reference</th>
                    <th className="py-2 pr-4">Year</th>
                    <th className="py-2 pr-4">Due</th>
                    <th className="py-2 pr-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.slice(0, 50).map(r => {
                    const due = r.due_date ? new Date(r.due_date) : null;
                    const isOverdue = !!due && !Number.isNaN(due.getTime()) && due < new Date();
                    return (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">
                          <div className="font-medium">{r.customers?.name || '—'}</div>
                          <div className="text-xs text-muted-foreground">{r.customers?.email || '—'}</div>
                        </td>
                        <td className="py-2 pr-4 text-xs">{r.warranty_reference_number || '—'}</td>
                        <td className="py-2 pr-4">Year {r.year_number ?? '—'}</td>
                        <td className="py-2 pr-4 text-xs">
                          {fmtDate(r.due_date)}{' '}
                          {isOverdue && <Badge variant="destructive" className="ml-1">Overdue</Badge>}
                        </td>
                        <td className="py-2 pr-4 text-right font-semibold">{money(Number(r.amount) || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {schedules.length > 50 && (
                <p className="text-xs text-muted-foreground mt-2">Showing the 50 soonest of {schedules.length}.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
