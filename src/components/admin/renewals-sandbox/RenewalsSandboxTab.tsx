import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw, Repeat, ShieldOff, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { RenewalsEngineLiveSwitch } from './RenewalsEngineLiveSwitch';
import { RenewalDrawer } from './RenewalDrawer';
import type { SandboxRow } from './types';

type BandId = 'hot' | 'due_8_14' | 'due_15_30' | 'due_31_60' | 'lapsed' | 'all';

const BANDS: { id: BandId; label: string; hint: string }[] = [
  { id: 'hot',        label: 'Hot (0–7 days)',  hint: 'Expiring within a week — call today.' },
  { id: 'due_8_14',   label: 'Due 8–14',        hint: 'Expiring in 8–14 days.' },
  { id: 'due_15_30',  label: 'Due 15–30',       hint: 'Expiring in 15–30 days.' },
  { id: 'due_31_60',  label: 'Due 31–60',       hint: 'Expiring in 31–60 days.' },
  { id: 'lapsed',     label: 'Lapsed',          hint: 'Already expired, not yet renewed.' },
  { id: 'all',        label: 'All renewals',    hint: 'Every renewal candidate in the next 180 days.' },
];

const EXCLUDED_STATUSES = "('cancelled','refunded','expired','voided','deleted')";
const RENEWED_OUTCOMES = new Set(['renewed', 'upgraded', 'renewed_upgraded']);
const INELIGIBLE_OUTCOMES = new Set(['do_not_contact', 'vehicle_sold', 'bought_elsewhere']);
const PAGE_SIZE = 200;

const daysLeft = (end: string | null) => {
  if (!end) return null;
  const e = new Date(end); e.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((e.getTime() - today.getTime()) / 86400000);
};

const dayIso = (offset: number) => {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};

const bandBadge = (d: number | null) => {
  if (d === null) return 'bg-muted text-muted-foreground border-border';
  if (d < 0) return 'bg-slate-200 text-slate-800 border-slate-300';
  if (d <= 7) return 'bg-red-100 text-red-800 border-red-200';
  if (d <= 14) return 'bg-orange-100 text-orange-800 border-orange-200';
  if (d <= 30) return 'bg-amber-100 text-amber-900 border-amber-200';
  return 'bg-blue-100 text-blue-800 border-blue-200';
};

interface Props {
  userRole?: string | null;
}

export const RenewalsSandboxTab: React.FC<Props> = ({ userRole }) => {
  const [live, setLive] = useState(false);
  const [band, setBand] = useState<BandId>('hot');
  const [rows, setRows] = useState<SandboxRow[]>([]);
  const [counts, setCounts] = useState<Record<BandId, number>>({} as any);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SandboxRow | null>(null);

  const applyBand = useCallback((q: any, id: BandId) => {
    switch (id) {
      case 'hot':       return q.gte('policy_end_date', dayIso(0)).lte('policy_end_date', dayIso(7));
      case 'due_8_14':  return q.gt('policy_end_date', dayIso(7)).lte('policy_end_date', dayIso(14));
      case 'due_15_30': return q.gt('policy_end_date', dayIso(14)).lte('policy_end_date', dayIso(30));
      case 'due_31_60': return q.gt('policy_end_date', dayIso(30)).lte('policy_end_date', dayIso(60));
      case 'lapsed':    return q.gte('policy_end_date', dayIso(-180)).lt('policy_end_date', dayIso(0));
      default:          return q.gte('policy_end_date', dayIso(-180)).lte('policy_end_date', dayIso(180));
    }
  }, []);

  const base = (q: any) => q
    .not('status', 'in', EXCLUDED_STATUSES)
    .or('is_deleted.is.null,is_deleted.eq.false');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q: any = base((supabase.from('customer_policies') as any).select(
        'id, customer_id, policy_number, plan_type, payment_type, policy_start_date, policy_end_date, ' +
        'claim_limit, voluntary_excess, payment_amount, retention_outcome, customer_full_name, email, ' +
        'customers!fk_customer_policies_customer_id ( id, first_name, last_name, name, email, phone, registration_plate, ' +
        'vehicle_make, vehicle_model, vehicle_year, vehicle_fuel_type, vehicle_transmission, mileage, assigned_to, status )'
      ));
      q = applyBand(q, band)
        .order('policy_end_date', { ascending: true, nullsFirst: false })
        .limit(PAGE_SIZE);
      const { data, error } = await q;
      if (error) throw error;
      const list = ((data as any[]) || []).filter((r) => {
        const cs = (r.customers?.status || '').toLowerCase();
        if (['cancelled', 'refunded', 'deleted'].includes(cs)) return false;
        if (RENEWED_OUTCOMES.has(r.retention_outcome || '')) return false;
        if (INELIGIBLE_OUTCOMES.has(r.retention_outcome || '')) return false;
        return true;
      });
      setRows(list as SandboxRow[]);
    } catch (e: any) {
      toast.error('Failed to load renewals sandbox', { description: e.message });
    } finally {
      setLoading(false);
    }
  }, [applyBand, band]);

  const loadCounts = useCallback(async () => {
    const res = await Promise.all(BANDS.map(async (b) => {
      try {
        const q = applyBand(
          base((supabase.from('customer_policies') as any).select('id', { count: 'exact', head: true })),
          b.id,
        );
        const { count } = await q;
        return [b.id, count || 0] as const;
      } catch { return [b.id, 0] as const; }
    }));
    setCounts(Object.fromEntries(res) as any);
  }, [applyBand]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  const activeBand = useMemo(() => BANDS.find(b => b.id === band), [band]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const c = r.customers;
      return [
        c?.first_name, c?.last_name, c?.name, c?.email, r.email, c?.phone,
        c?.registration_plate, c?.vehicle_make, c?.vehicle_model, r.policy_number,
      ].filter(Boolean).some((v) => String(v).toLowerCase().includes(term));
    });
  }, [rows, search]);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <RenewalsEngineLiveSwitch userRole={userRole} onChange={setLive} />

      {!live && (
        <div className="flex items-start gap-2 rounded-md border border-dashed border-amber-300 bg-amber-50/60 p-3 text-sm text-amber-900">
          <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Sandbox mode: this list is read-only. No renewal is written into New Leads, no agent is assigned,
            and no customer is contacted. Flip the switch above when you want renewals flowing into New Leads.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {BANDS.map((b) => (
          <Button
            key={b.id}
            size="sm"
            variant={band === b.id ? 'default' : 'outline'}
            onClick={() => setBand(b.id)}
            title={b.hint}
          >
            {b.label}
            <Badge variant="secondary" className="ml-2">{counts[b.id] ?? '—'}</Badge>
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => { load(); loadCounts(); }} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, reg, phone, email, policy"
            className="pl-8"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Days left</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 font-medium">Vehicle</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">Renewal offer</th>
                  <th className="px-3 py-2 font-medium">Expires</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td></tr>
                )}
                {!loading && visible.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    No renewals in {activeBand?.label}.
                  </td></tr>
                )}
                {!loading && visible.map((r) => {
                  const d = daysLeft(r.policy_end_date);
                  const c = r.customers;
                  const name = [c?.first_name, c?.last_name].filter(Boolean).join(' ') || c?.name || r.customer_full_name || '—';
                  return (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-t hover:bg-muted/40"
                      onClick={() => setSelected(r)}
                    >
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="border-purple-200 bg-purple-100 text-purple-800">
                          <Repeat className="mr-1 h-3 w-3" /> Renewal
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className={bandBadge(d)}>
                          {d === null ? '—' : d < 0 ? `${Math.abs(d)}d overdue` : `${d}d`}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-muted-foreground">{c?.phone || c?.email || r.email || '—'}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{[c?.vehicle_make, c?.vehicle_model].filter(Boolean).join(' ') || '—'}</div>
                        <div className="text-xs uppercase text-muted-foreground">{c?.registration_plate || '—'}</div>
                      </td>
                      <td className="px-3 py-2">{r.plan_type || '—'}</td>
                      <td className="px-3 py-2">
                        {(() => {
                          const q = priceRenewal(r);
                          if (q.blocked) return <span className="text-xs text-amber-800">Needs review</span>;
                          return (
                            <div>
                              <div className="font-medium">£{q.loyaltyPrice.toLocaleString('en-GB')}</div>
                              <div className="text-xs text-muted-foreground">min £{q.agentFloorPrice.toLocaleString('en-GB')}</div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2">
                        {r.policy_end_date ? format(new Date(r.policy_end_date), 'd MMM yyyy') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <RenewalDrawer
        row={selected}
        live={live}
        open={!!selected}
        onOpenChange={(o) => { if (!o) setSelected(null); }}
      />
    </div>
  );
};

export default RenewalsSandboxTab;
