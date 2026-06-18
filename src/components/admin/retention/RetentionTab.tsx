import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Repeat, Phone, Mail, Loader2, CheckCircle2, AlertCircle, TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';

type SegmentId = 'due_soon' | 'renewal_window' | 'upsell' | 'lapsed';

const SEGMENTS: { id: SegmentId; label: string; description: string }[] = [
  { id: 'due_soon', label: 'Renewal Due Soon', description: 'Policy expires in the next 0–60 days — priority calls' },
  { id: 'renewal_window', label: 'Renewal Window', description: 'Expires in 61–180 days — warm-up calls' },
  { id: 'upsell', label: 'Upsell Opportunities', description: 'Active policy with room to upgrade claim limit or add-ons' },
  { id: 'lapsed', label: 'Lapsed (Win-Back)', description: 'Expired 0–180 days ago, not yet renewed' },
];

const OUTCOMES = [
  { value: 'renewed', label: 'Renewed' },
  { value: 'upgraded', label: 'Upgraded' },
  { value: 'renewed_upgraded', label: 'Renewed + Upgraded' },
  { value: 'still_considering', label: 'Still considering' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'declined', label: 'Declined' },
  { value: 'cancelled_at_renewal', label: 'Cancelled at renewal' },
  { value: 'lost_to_competitor', label: 'Lost to competitor' },
];

// Statuses that mean "do not contact for retention"
const EXCLUDED_STATUSES = "('cancelled','refunded','expired','voided','deleted')";
const PAGE_SIZE = 100;

interface PolicyRow {
  id: string;
  customer_id: string | null;
  policy_number: string | null;
  warranty_number: string | null;
  plan_type: string | null;
  status: string | null;
  policy_start_date: string | null;
  policy_end_date: string | null;
  claim_limit: number | null;
  tyre_cover: boolean | null;
  wear_tear: boolean | null;
  breakdown_recovery: boolean | null;
  vehicle_rental: boolean | null;
  europe_cover: boolean | null;
  mot_repair: boolean | null;
  retention_worked_at: string | null;
  retention_outcome: string | null;
  customer_full_name: string | null;
  email: string | null;
  customers?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    registration_plate: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
    status: string | null;
  } | null;
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function expiryBadge(days: number | null) {
  if (days == null) return <Badge variant="outline">—</Badge>;
  if (days < 0) return <Badge className="bg-red-100 text-red-800 border-red-200">Expired {Math.abs(days)}d</Badge>;
  if (days <= 14) return <Badge className="bg-red-100 text-red-800 border-red-200">{days}d</Badge>;
  if (days <= 30) return <Badge className="bg-amber-100 text-amber-800 border-amber-200">{days}d</Badge>;
  return <Badge variant="outline">{days}d</Badge>;
}

function upsellPotential(p: PolicyRow): string[] {
  const opts: string[] = [];
  if ((p.claim_limit ?? 0) < 2000) opts.push('Higher claim limit');
  if (!p.tyre_cover) opts.push('Tyre cover');
  if (!p.wear_tear) opts.push('Wear & tear');
  if (!p.breakdown_recovery) opts.push('Breakdown');
  if (!p.vehicle_rental) opts.push('Vehicle rental');
  if (!p.europe_cover) opts.push('Europe');
  if (!p.mot_repair) opts.push('MOT repair');
  return opts;
}

export const RetentionTab: React.FC = () => {
  const [segment, setSegment] = useState<SegmentId>('due_soon');
  const [rows, setRows] = useState<PolicyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<Record<SegmentId, number>>({} as any);
  const [search, setSearch] = useState('');
  const [workedToday, setWorkedToday] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [totalActive, setTotalActive] = useState<number | null>(null);
  const [renewals12mo, setRenewals12mo] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const applySegment = useCallback((q: any, id: SegmentId) => {
    const now = new Date();
    const in60 = new Date(now.getTime() + 60 * 86400000).toISOString();
    const in61 = new Date(now.getTime() + 61 * 86400000).toISOString();
    const in180 = new Date(now.getTime() + 180 * 86400000).toISOString();
    const ago180 = new Date(now.getTime() - 180 * 86400000).toISOString();
    const nowIso = now.toISOString();

    switch (id) {
      case 'due_soon':
        return q.gte('policy_end_date', nowIso).lte('policy_end_date', in60);
      case 'renewal_window':
        return q.gte('policy_end_date', in61).lte('policy_end_date', in180);
      case 'upsell':
        // Active policies still well within their term, with claim limit under top tier
        return q.gt('policy_end_date', in180).lt('claim_limit', 2000);
      case 'lapsed':
        return q.gte('policy_end_date', ago180).lt('policy_end_date', nowIso);
      default:
        return q;
    }
  }, []);

  const baseSelect =
    'id, customer_id, policy_number, warranty_number, plan_type, status, ' +
    'policy_start_date, policy_end_date, claim_limit, tyre_cover, wear_tear, ' +
    'breakdown_recovery, vehicle_rental, europe_cover, mot_repair, ' +
    'retention_worked_at, retention_outcome, customer_full_name, email, ' +
    'customers!customer_policies_customer_id_fkey ( id, first_name, last_name, name, email, phone, registration_plate, vehicle_make, vehicle_model, status )';

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      let q: any = (supabase.from('customer_policies') as any)
        .select(baseSelect)
        .not('status', 'in', EXCLUDED_STATUSES)
        .or('is_deleted.is.null,is_deleted.eq.false');
      q = applySegment(q, segment);
      q = q
        .order('retention_worked_at', { ascending: true, nullsFirst: true })
        .order('policy_end_date', { ascending: true })
        .limit(PAGE_SIZE);
      const { data, error } = await q;
      if (error) throw error;
      // Filter out policies whose linked customer is cancelled/refunded
      const filtered = ((data as any) || []).filter((r: PolicyRow) => {
        const cs = (r.customers?.status || '').toLowerCase();
        return !['cancelled', 'refunded', 'deleted'].includes(cs);
      });
      setRows(filtered);
    } catch (e: any) {
      toast.error('Failed to load retention list', { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [applySegment, segment]);

  const fetchCounts = useCallback(async () => {
    const results = await Promise.all(
      SEGMENTS.map(async (s) => {
        try {
          let q: any = (supabase.from('customer_policies') as any)
            .select('id', { count: 'exact', head: true })
            .not('status', 'in', EXCLUDED_STATUSES)
            .or('is_deleted.is.null,is_deleted.eq.false');
          q = applySegment(q, s.id);
          const { count } = await q;
          return [s.id, count || 0] as const;
        } catch {
          return [s.id, 0] as const;
        }
      })
    );
    setCounts(Object.fromEntries(results) as any);
  }, [applySegment]);

  const fetchWorkedToday = useCallback(async () => {
    if (!currentUserId) return;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    // Worked today = policies whose retention_worked_at is today by this user (we approximate via timestamp + admin_notes)
    const { count } = await (supabase.from('customer_policies') as any)
      .select('id', { count: 'exact', head: true })
      .gte('retention_worked_at', startOfDay.toISOString());
    setWorkedToday(count || 0);
  }, [currentUserId]);

  const fetchTotals = useCallback(async () => {
    try {
      const nowIso = new Date().toISOString();
      const in12mo = new Date(Date.now() + 365 * 86400000).toISOString();
      const baseFilter = (q: any) => q
        .not('status', 'in', EXCLUDED_STATUSES)
        .or('is_deleted.is.null,is_deleted.eq.false');
      const totalQ = baseFilter((supabase.from('customer_policies') as any).select('id', { count: 'exact', head: true }));
      const renewQ = baseFilter((supabase.from('customer_policies') as any).select('id', { count: 'exact', head: true }))
        .gte('policy_end_date', nowIso)
        .lte('policy_end_date', in12mo);
      const [{ count: total }, { count: renew12 }] = await Promise.all([totalQ, renewQ]);
      setTotalActive(total || 0);
      setRenewals12mo(renew12 || 0);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);
  useEffect(() => { fetchWorkedToday(); }, [fetchWorkedToday]);
  useEffect(() => { fetchTotals(); }, [fetchTotals]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) =>
      [
        r.customer_full_name,
        r.email,
        r.customers?.email,
        r.customers?.phone,
        r.customers?.first_name,
        r.customers?.last_name,
        r.customers?.registration_plate,
        r.policy_number,
        r.warranty_number,
      ]
        .some((v) => (v || '').toString().toLowerCase().includes(s))
    );
  }, [rows, search]);

  const markWorked = useCallback(
    async (row: PolicyRow, outcome?: string) => {
      try {
        const updates: any = { retention_worked_at: new Date().toISOString() };
        if (outcome) updates.retention_outcome = outcome;
        const { error } = await (supabase.from('customer_policies') as any)
          .update(updates)
          .eq('id', row.id);
        if (error) throw error;

        toast.success('Worked', {
          description: outcome ? `Outcome: ${outcome.replace(/_/g, ' ')}` : 'Logged retention attempt',
        });
        setWorkedToday((n) => n + 1);
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updates } : r)));
      } catch (e: any) {
        toast.error('Could not mark as worked', { description: e.message });
      }
    },
    []
  );

  const currentSegment = SEGMENTS.find((s) => s.id === segment)!;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Repeat className="h-6 w-6 text-primary" />
            Retention
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Renewals and upsells for active customers. Excludes cancelled, refunded, and deleted policies.
          </p>
        </div>
        <Card className="border-primary/30">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <div className="text-xs text-muted-foreground">Worked today</div>
              <div className="text-xl font-semibold">{workedToday}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={segment} onValueChange={(v) => setSegment(v as SegmentId)}>
        <TabsList className="w-full justify-start flex-wrap h-auto">
          {SEGMENTS.map((s) => (
            <TabsTrigger key={s.id} value={s.id} className="gap-2">
              {s.label}
              <Badge variant="secondary" className="ml-1">{counts[s.id] ?? '…'}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={segment} className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{currentSegment.description}</p>
            <Input
              placeholder="Search name, email, phone, reg, policy…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading retention list…
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No customers in this segment right now.
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Customer</th>
                      <th className="text-left p-3">Contact</th>
                      <th className="text-left p-3">Vehicle</th>
                      <th className="text-left p-3">Plan</th>
                      <th className="text-left p-3">Expiry</th>
                      <th className="text-left p-3">Upsell ideas</th>
                      <th className="text-left p-3">Last worked</th>
                      <th className="text-right p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const days = daysUntil(r.policy_end_date);
                      const upsell = upsellPotential(r);
                      const name =
                        [r.customers?.first_name, r.customers?.last_name].filter(Boolean).join(' ') ||
                        r.customers?.name ||
                        r.customer_full_name ||
                        '—';
                      return (
                        <tr key={r.id} className="border-t hover:bg-muted/30">
                          <td className="p-3">
                            <div className="font-medium">{name}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.policy_number || r.warranty_number || '—'}
                            </div>
                          </td>
                          <td className="p-3 text-xs">
                            {r.customers?.phone && (
                              <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.customers.phone}</div>
                            )}
                            {(r.customers?.email || r.email) && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Mail className="h-3 w-3" />{r.customers?.email || r.email}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-xs">
                            <div>{[r.customers?.vehicle_make, r.customers?.vehicle_model].filter(Boolean).join(' ') || '—'}</div>
                            <div className="text-muted-foreground">{r.customers?.registration_plate || ''}</div>
                          </td>
                          <td className="p-3 text-xs">
                            <div>{r.plan_type || '—'}</div>
                            <div className="text-muted-foreground">£{r.claim_limit ?? '—'} claim</div>
                          </td>
                          <td className="p-3">
                            <div>{expiryBadge(days)}</div>
                            {r.policy_end_date && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {format(new Date(r.policy_end_date), 'd MMM yyyy')}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-xs">
                            {upsell.length === 0 ? (
                              <span className="text-muted-foreground">Fully loaded</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {upsell.slice(0, 3).map((u) => (
                                  <Badge key={u} variant="outline" className="text-[10px] gap-1">
                                    <TrendingUp className="h-2.5 w-2.5" />{u}
                                  </Badge>
                                ))}
                                {upsell.length > 3 && (
                                  <Badge variant="outline" className="text-[10px]">+{upsell.length - 3}</Badge>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {r.retention_worked_at
                              ? formatDistanceToNow(new Date(r.retention_worked_at), { addSuffix: true })
                              : 'Never'}
                            {r.retention_outcome && (
                              <div className="text-[10px] capitalize">{r.retention_outcome.replace(/_/g, ' ')}</div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-2">
                              <Select onValueChange={(v) => markWorked(r, v)}>
                                <SelectTrigger className="h-8 w-[170px]">
                                  <SelectValue placeholder="Outcome…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {OUTCOMES.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button size="sm" variant="outline" onClick={() => markWorked(r)}>
                                Worked
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RetentionTab;
