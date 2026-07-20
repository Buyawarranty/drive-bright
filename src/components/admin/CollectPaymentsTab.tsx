import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { PaymentDueDatePicker } from './PaymentDueDatePicker';
import { PoundSterling, Phone, Mail, Search, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
  status: string | null;
  assigned_to: string | null;
  assigned_to_name?: string | null;
  payment_collected_at: string | null;
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
  const [showCollected, setShowCollected] = useState(false);

  const isManagement = MANAGEMENT.has(userRole || '');

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, phone, registration_plate, plan_type, final_amount, payment_due_date, status, assigned_to, payment_collected_at')
        .not('payment_due_date', 'is', null)
        .order('payment_due_date', { ascending: true })
        .limit(500);
      if (error) throw error;

      const list = (data as any[]) || [];
      const assigneeIds = Array.from(new Set(list.map((r) => r.assigned_to).filter(Boolean)));
      const nameMap: Record<string, string> = {};
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

  const markCollected = async (row: Row, collected: boolean) => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('customers')
        .update({
          payment_collected_at: collected ? new Date().toISOString() : null,
          payment_collected_by: collected ? auth?.user?.id ?? null : null,
        })
        .eq('id', row.id);
      if (error) throw error;
      toast.success(collected ? 'Marked as collected' : 'Marked as not collected');
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, payment_collected_at: collected ? new Date().toISOString() : null }
            : r,
        ),
      );
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to update: ' + (e?.message || 'unknown'));
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows;
    if (!showCollected) list = list.filter((r) => !r.payment_collected_at);
    if (!q) return list;
    return list.filter(
      (r) =>
        (r.email || '').toLowerCase().includes(q) ||
        (r.first_name || '').toLowerCase().includes(q) ||
        (r.last_name || '').toLowerCase().includes(q) ||
        (r.registration_plate || '').toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q) ||
        (r.assigned_to_name || '').toLowerCase().includes(q),
    );
  }, [rows, search, showCollected]);

  const stats = useMemo(() => {
    let overdue = 0;
    let today = 0;
    let upcoming = 0;
    for (const r of filtered) {
      if (r.payment_collected_at) continue;
      const d = parseISO(r.payment_due_date);
      if (isToday(d)) today++;
      else if (isPast(d)) overdue++;
      else upcoming++;
    }
    return { overdue, today, upcoming };
  }, [filtered]);

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

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <PoundSterling className="h-6 w-6 text-amber-600" />
            Collect Payments
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Customers with a scheduled payment collection date.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 w-64"
              placeholder="Search name, email, reg, agent…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
            <Checkbox
              checked={showCollected}
              onCheckedChange={(v) => setShowCollected(Boolean(v))}
            />
            Show collected
          </label>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Warning strip */}
      {(stats.overdue > 0 || stats.today > 0) && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-600" />
          <div>
            <strong>Action required:</strong>{' '}
            {stats.overdue > 0 && (
              <span className="mr-3">
                <span className="font-bold">{stats.overdue}</span> overdue
              </span>
            )}
            {stats.today > 0 && (
              <span className="mr-3">
                <span className="font-bold">{stats.today}</span> due today
              </span>
            )}
            {stats.upcoming > 0 && (
              <span className="text-red-800/80">
                · {stats.upcoming} upcoming
              </span>
            )}
            <div className="text-xs mt-0.5 text-red-800/80">
              Chase up the customer, take payment, then tick “Collected”.
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="p-12 text-center text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No customers with scheduled payment collections.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Done</th>
                  <th className="text-left px-3 py-2 font-medium">Due</th>
                  <th className="text-left px-3 py-2 font-medium">Customer</th>
                  <th className="text-left px-3 py-2 font-medium">Reg</th>
                  <th className="text-left px-3 py-2 font-medium">Plan / Amount</th>
                  <th className="text-left px-3 py-2 font-medium">Sales agent</th>
                  <th className="text-left px-3 py-2 font-medium">Contact</th>
                  <th className="text-right px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((r) => {
                  const d = parseISO(r.payment_due_date);
                  const days = differenceInCalendarDays(d, new Date());
                  const isOverdue = !r.payment_collected_at && isPast(d) && !isToday(d);
                  const isDueToday = !r.payment_collected_at && isToday(d);
                  const daysLabel =
                    days === 0 ? 'Today' : days < 0 ? `${Math.abs(days)}d overdue` : `in ${days}d`;
                  const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || '(no name)';
                  const rowCls = r.payment_collected_at
                    ? 'bg-green-50/60'
                    : isOverdue
                    ? 'bg-red-50/60'
                    : isDueToday
                    ? 'bg-orange-50/60'
                    : '';

                  return (
                    <tr key={r.id} className={`${rowCls} hover:bg-muted/40 transition-colors`}>
                      <td className="px-3 py-2 align-middle">
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            checked={!!r.payment_collected_at}
                            onCheckedChange={(v) => markCollected(r, Boolean(v))}
                          />
                          {r.payment_collected_at && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-middle whitespace-nowrap">
                        <div className="font-semibold">{format(d, 'EEE dd MMM')}</div>
                        <div
                          className={`text-xs ${
                            isOverdue
                              ? 'text-red-700 font-semibold'
                              : isDueToday
                              ? 'text-orange-700 font-semibold'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {isOverdue && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}
                          {daysLabel}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <div className="font-medium">{name}</div>
                        {r.email && (
                          <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                            {r.email}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        {r.registration_plate ? (
                          <Badge variant="outline" className="font-mono">
                            {r.registration_plate}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <div className="text-xs text-muted-foreground">{r.plan_type || '—'}</div>
                        <div className="font-semibold">
                          {r.final_amount ? `£${Number(r.final_amount).toFixed(2)}` : '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-middle text-xs">
                        {r.assigned_to_name ? (
                          <span className="font-medium">{r.assigned_to_name}</span>
                        ) : (
                          <span className="text-muted-foreground italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <div className="flex items-center gap-2 text-xs">
                          {r.phone && (
                            <a
                              href={`tel:${r.phone}`}
                              className="inline-flex items-center gap-1 hover:underline"
                              title={r.phone}
                            >
                              <Phone className="h-3 w-3" />
                              Call
                            </a>
                          )}
                          {r.email && (
                            <a
                              href={`mailto:${r.email}`}
                              className="inline-flex items-center gap-1 hover:underline"
                              title={r.email}
                            >
                              <Mail className="h-3 w-3" />
                              Email
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-middle text-right">
                        <div className="inline-flex items-center gap-1">
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
                                  new CustomEvent('customers-tab-open', {
                                    detail: { customerId: r.id },
                                  }),
                                );
                              }, 200);
                            }}
                          >
                            Open
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectPaymentsTab;
