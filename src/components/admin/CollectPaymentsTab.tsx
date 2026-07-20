import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PaymentDueDatePicker } from './PaymentDueDatePicker';
import { PoundSterling, Phone, Mail, Search, RefreshCw, Info } from 'lucide-react';
import { format, isPast, isToday, differenceInCalendarDays, parseISO } from 'date-fns';
import { toast } from 'sonner';

interface Row {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  registration_plate: string | null;
  plan_type: string | null;
  final_amount: number | null;
  payment_due_date: string;
  assigned_to_name?: string | null;
  status: string | null;
}

interface Props {
  userRole?: string | null;
  onNavigateToTab?: (tab: string) => void;
}

const MANAGEMENT = new Set(['admin', 'super_admin', 'sales_manager', 'performance_manager']);

export const CollectPaymentsTab: React.FC<Props> = ({ userRole, onNavigateToTab }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const isManagement = MANAGEMENT.has(userRole || '');

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, phone, registration_plate, plan_type, final_amount, payment_due_date, status, assigned_to')
        .not('payment_due_date', 'is', null)
        .order('payment_due_date', { ascending: true })
        .limit(500);
      if (error) throw error;

      const list = (data as any[]) || [];
      const assigneeIds = Array.from(new Set(list.map((r) => r.assigned_to).filter(Boolean)));
      let nameMap: Record<string, string> = {};
      if (assigneeIds.length) {
        const { data: users } = await supabase
          .from('admin_users')
          .select('user_id, first_name, last_name, email')
          .in('user_id', assigneeIds);
        (users || []).forEach((u: any) => {
          nameMap[u.user_id] = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
        });
      }

      setRows(list.map((r) => ({ ...r, assigned_to_name: r.assigned_to ? nameMap[r.assigned_to] : null })));
    } catch (e) {
      console.error(e);
      toast.error('Failed to load payment collections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.email || '').toLowerCase().includes(q) ||
        (r.first_name || '').toLowerCase().includes(q) ||
        (r.last_name || '').toLowerCase().includes(q) ||
        (r.registration_plate || '').toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const buckets = useMemo(() => {
    const overdue: Row[] = [];
    const today: Row[] = [];
    const upcoming: Row[] = [];
    for (const r of filtered) {
      const d = parseISO(r.payment_due_date);
      if (isToday(d)) today.push(r);
      else if (isPast(d)) overdue.push(r);
      else upcoming.push(r);
    }
    return { overdue, today, upcoming };
  }, [filtered]);

  const totalDue = buckets.overdue.length + buckets.today.length;

  if (!isManagement && userRole !== 'sales_lead') {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold">Access denied</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Collect Payments is restricted to management and sales leads.
        </p>
      </div>
    );
  }

  const renderGroup = (title: string, list: Row[], tone: 'red' | 'orange' | 'amber') => {
    if (!list.length) return null;
    const toneCls =
      tone === 'red'
        ? 'border-red-300 bg-red-50'
        : tone === 'orange'
        ? 'border-orange-300 bg-orange-50'
        : 'border-amber-300 bg-amber-50';
    const badgeCls =
      tone === 'red'
        ? 'bg-red-600 text-white'
        : tone === 'orange'
        ? 'bg-orange-500 text-white'
        : 'bg-amber-500 text-white';

    return (
      <Card className={`border-2 ${toneCls}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${badgeCls}`}>
              {list.length}
            </span>
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {list.map((r) => {
              const d = parseISO(r.payment_due_date);
              const days = differenceInCalendarDays(d, new Date());
              const daysLabel =
                days === 0 ? 'Today' : days < 0 ? `${Math.abs(days)}d overdue` : `in ${days}d`;
              const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || '(no name)';
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-white/60 transition-colors"
                >
                  <div className="min-w-[180px] flex-1">
                    <div className="font-semibold text-sm">{name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                      {r.email && (
                        <a href={`mailto:${r.email}`} className="flex items-center gap-1 hover:underline">
                          <Mail className="h-3 w-3" />
                          {r.email}
                        </a>
                      )}
                      {r.phone && (
                        <a href={`tel:${r.phone}`} className="flex items-center gap-1 hover:underline">
                          <Phone className="h-3 w-3" />
                          {r.phone}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="text-xs">
                    {r.registration_plate && (
                      <Badge variant="outline" className="font-mono">
                        {r.registration_plate}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground min-w-[110px]">
                    {r.plan_type || '—'}
                    {r.final_amount ? (
                      <div className="font-semibold text-foreground">£{Number(r.final_amount).toFixed(2)}</div>
                    ) : null}
                  </div>
                  <div className="text-xs min-w-[130px]">
                    <div className="font-semibold">{format(d, 'EEE dd MMM')}</div>
                    <div className="text-muted-foreground">{daysLabel}</div>
                  </div>
                  <div className="text-xs text-muted-foreground min-w-[110px]">
                    {r.assigned_to_name ? `Owner: ${r.assigned_to_name}` : 'Unassigned'}
                  </div>
                  <div className="flex items-center gap-2">
                    <PaymentDueDatePicker
                      customerId={r.id}
                      paymentDueDate={r.payment_due_date}
                      onUpdate={load}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onNavigateToTab?.('customers');
                        setTimeout(() => {
                          window.dispatchEvent(
                            new CustomEvent('customers-tab-open', { detail: { customerId: r.id } }),
                          );
                        }, 200);
                      }}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <PoundSterling className="h-6 w-6 text-amber-600" />
            Collect Payments
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Customers with a scheduled payment collection date.
            {totalDue > 0 && (
              <span className="ml-2 font-semibold text-red-700">
                {totalDue} due now
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 w-64"
              placeholder="Search name, email, reg, phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <div>
          <strong>How staff add "Collect later":</strong> in the <em>Customers</em> tab, next to
          each customer row is a small <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1 font-semibold text-amber-800">£ Collect</span> pill and a
          calendar <span className="rounded-full border px-1">＋</span> button. Click the plus, pick
          a date the customer has agreed to pay by, and it appears here automatically. Click the ×
          on the pill to clear it once paid.
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No customers with scheduled payment collections.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {renderGroup(`Overdue`, buckets.overdue, 'red')}
          {renderGroup(`Due today`, buckets.today, 'orange')}
          {renderGroup(`Upcoming`, buckets.upcoming, 'amber')}
        </div>
      )}
    </div>
  );
};

export default CollectPaymentsTab;
