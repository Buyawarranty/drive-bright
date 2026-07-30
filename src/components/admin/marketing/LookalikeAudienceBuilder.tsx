import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Download, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

type PaymentMethod = 'all' | 'stripe' | 'bumper' | 'other';
type SortKey = 'amount_desc' | 'amount_asc' | 'newest_vehicle' | 'recent_signup';

interface Row {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  postcode: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  registration_plate: string | null;
  final_amount: number | null;
  payment_type: string | null;
  plan_type: string | null;
  stripe_session_id: string | null;
  bumper_order_id: string | null;
  signup_date: string | null;
  created_at: string;
  purchase_source: string | null;
}

const currentYear = new Date().getFullYear();

const methodOf = (r: Row): Exclude<PaymentMethod, 'all'> =>
  r.stripe_session_id ? 'stripe' : r.bumper_order_id ? 'bumper' : 'other';

export const LookalikeAudienceBuilder: React.FC = () => {
  const [maxAge, setMaxAge] = useState<string>('6');
  const [minAmount, setMinAmount] = useState<string>('0');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [method, setMethod] = useState<PaymentMethod>('stripe');
  const [term, setTerm] = useState<string>('all');
  const [make, setMake] = useState<string>('all');
  const [source, setSource] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('amount_desc');
  const [limit, setLimit] = useState<string>('500');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['lookalike-audience-base'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, first_name, last_name, name, email, phone, postcode, vehicle_make, vehicle_model, vehicle_year, registration_plate, final_amount, payment_type, plan_type, stripe_session_id, bumper_order_id, signup_date, created_at, purchase_source')
        .eq('is_deleted', false)
        .not('status', 'ilike', '%cancelled%')
        .not('status', 'ilike', '%refunded%')
        .order('final_amount', { ascending: false })
        .limit(3000);
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const makes = useMemo(() => {
    const s = new Set<string>();
    (data || []).forEach(r => { if (r.vehicle_make) s.add(r.vehicle_make.trim()); });
    return Array.from(s).sort();
  }, [data]);

  const filtered = useMemo(() => {
    const rows = (data || []).filter(r => {
      // Vehicle age
      if (maxAge !== 'any') {
        const y = parseInt((r.vehicle_year || '').slice(0, 4), 10);
        if (!y || currentYear - y > parseInt(maxAge, 10)) return false;
      }
      // Amount
      const amt = Number(r.final_amount || 0);
      if (minAmount && amt < Number(minAmount)) return false;
      if (maxAmount && amt > Number(maxAmount)) return false;
      // Payment method
      if (method !== 'all' && methodOf(r) !== method) return false;
      // Term
      if (term !== 'all') {
        const t = (r.payment_type || '').toLowerCase();
        const map: Record<string, string[]> = {
          '12': ['12months', 'yearly', '1-year', '12'],
          '24': ['24months', '2-year', 'twoyear', '24'],
          '36': ['36months', '3-year', 'threeyear', '36'],
        };
        if (!map[term].some(k => t.includes(k))) return false;
      }
      if (make !== 'all' && (r.vehicle_make || '').trim().toLowerCase() !== make.toLowerCase()) return false;
      if (source !== 'all' && (r.purchase_source || 'unknown') !== source) return false;
      return true;
    });

    rows.sort((a, b) => {
      switch (sort) {
        case 'amount_asc': return Number(a.final_amount || 0) - Number(b.final_amount || 0);
        case 'newest_vehicle': return parseInt(b.vehicle_year || '0', 10) - parseInt(a.vehicle_year || '0', 10);
        case 'recent_signup': return new Date(b.signup_date || b.created_at).getTime() - new Date(a.signup_date || a.created_at).getTime();
        default: return Number(b.final_amount || 0) - Number(a.final_amount || 0);
      }
    });

    return rows.slice(0, parseInt(limit, 10));
  }, [data, maxAge, minAmount, maxAmount, method, term, make, source, sort, limit]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s, r) => s + Number(r.final_amount || 0), 0);
    const years = filtered.map(r => parseInt(r.vehicle_year || '0', 10)).filter(Boolean);
    return {
      count: filtered.length,
      revenue: total,
      avg: filtered.length ? total / filtered.length : 0,
      avgAge: years.length ? currentYear - years.reduce((a, b) => a + b, 0) / years.length : 0,
    };
  }, [filtered]);

  const exportCsv = () => {
    if (!filtered.length) { toast.error('No customers match these filters'); return; }
    const header = ['Email', 'Phone', 'First Name', 'Last Name', 'Zip', 'Country', 'Vehicle', 'Year', 'Amount Paid', 'Payment Method', 'Term', 'Signup Date'];
    const lines = filtered.map(r => {
      const [fn, ...rest] = (r.name || '').split(' ');
      return [
        r.email || '',
        r.phone || '',
        r.first_name || fn || '',
        r.last_name || rest.join(' ') || '',
        r.postcode || '',
        'GB',
        `${r.vehicle_make || ''} ${r.vehicle_model || ''}`.trim(),
        r.vehicle_year || '',
        Number(r.final_amount || 0).toFixed(2),
        methodOf(r),
        r.payment_type || '',
        (r.signup_date || r.created_at || '').slice(0, 10),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lookalike-audience-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} customers for Customer Match`);
  };

  return (
    <Card className="border-emerald-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              Lookalike audience builder
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Filter your best customers by vehicle age, amount paid and payment method, then export the list
              as a Google Ads Customer Match seed for lookalike (similar audience) targeting.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button size="sm" onClick={exportCsv} className="bg-emerald-600 hover:bg-emerald-700">
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Vehicle age</Label>
            <Select value={maxAge} onValueChange={setMaxAge}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="3">Up to 3 years</SelectItem>
                <SelectItem value="5">Up to 5 years</SelectItem>
                <SelectItem value="6">Up to 6 years</SelectItem>
                <SelectItem value="8">Up to 8 years</SelectItem>
                <SelectItem value="10">Up to 10 years</SelectItem>
                <SelectItem value="any">Any age</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Min paid (£)</Label>
            <Input className="h-8 text-xs" type="number" value={minAmount} onChange={e => setMinAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max paid (£)</Label>
            <Input className="h-8 text-xs" type="number" placeholder="No cap" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Payment method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="stripe">Stripe (card)</SelectItem>
                <SelectItem value="bumper">Bumper (finance)</SelectItem>
                <SelectItem value="other">Other / manual</SelectItem>
                <SelectItem value="all">All methods</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Term</Label>
            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">All terms</SelectItem>
                <SelectItem value="12">12 months</SelectItem>
                <SelectItem value="24">24 months</SelectItem>
                <SelectItem value="36">36 months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Make</Label>
            <Select value={make} onValueChange={setMake}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-background z-50 max-h-64">
                <SelectItem value="all">All makes</SelectItem>
                {makes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Channel</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">All channels</SelectItem>
                <SelectItem value="google_ads">Google Ads</SelectItem>
                <SelectItem value="facebook_ads">Facebook Ads</SelectItem>
                <SelectItem value="website">Website / organic</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sort / size</Label>
            <div className="flex gap-1">
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="amount_desc">Highest paid</SelectItem>
                  <SelectItem value="amount_asc">Lowest paid</SelectItem>
                  <SelectItem value="newest_vehicle">Newest vehicle</SelectItem>
                  <SelectItem value="recent_signup">Most recent</SelectItem>
                </SelectContent>
              </Select>
              <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger className="h-8 text-xs w-20"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="250">250</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="1000">1000</SelectItem>
                  <SelectItem value="3000">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg border bg-emerald-50/40">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Audience size</p>
            <p className="text-xl font-bold">{isLoading ? '…' : stats.count}</p>
          </div>
          <div className="p-3 rounded-lg border bg-emerald-50/40">
            <p className="text-xs text-muted-foreground">Total revenue</p>
            <p className="text-xl font-bold">£{stats.revenue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="p-3 rounded-lg border bg-emerald-50/40">
            <p className="text-xs text-muted-foreground">Average paid</p>
            <p className="text-xl font-bold">£{stats.avg.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="p-3 rounded-lg border bg-emerald-50/40">
            <p className="text-xs text-muted-foreground">Average vehicle age</p>
            <p className="text-xl font-bold">{stats.avgAge ? `${stats.avgAge.toFixed(1)} yrs` : '—'}</p>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-auto max-h-[420px]">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="text-left">
                <th className="p-2 font-medium">Customer</th>
                <th className="p-2 font-medium">Vehicle</th>
                <th className="p-2 font-medium">Year</th>
                <th className="p-2 font-medium">Postcode</th>
                <th className="p-2 font-medium">Paid</th>
                <th className="p-2 font-medium">Method</th>
                <th className="p-2 font-medium">Term</th>
                <th className="p-2 font-medium">Signup</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Loading customers…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">No customers match these filters.</td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="p-2">
                    <div className="font-medium">{r.name || `${r.first_name || ''} ${r.last_name || ''}`.trim() || '—'}</div>
                    <div className="text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="p-2">{`${r.vehicle_make || ''} ${r.vehicle_model || ''}`.trim() || '—'}</td>
                  <td className="p-2">{r.vehicle_year || '—'}</td>
                  <td className="p-2">{r.postcode || '—'}</td>
                  <td className="p-2 font-semibold">£{Number(r.final_amount || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}</td>
                  <td className="p-2">
                    <Badge variant="outline" className={methodOf(r) === 'stripe' ? 'border-emerald-300 text-emerald-700' : methodOf(r) === 'bumper' ? 'border-amber-300 text-amber-700' : ''}>
                      {methodOf(r)}
                    </Badge>
                  </td>
                  <td className="p-2">{r.payment_type || '—'}</td>
                  <td className="p-2">{(r.signup_date || r.created_at || '').slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground">
          Upload the CSV in Google Ads → Tools → Audience manager → Customer list, then create a similar/lookalike
          segment from it. Emails and phone numbers are hashed by Google on upload.
        </p>
      </CardContent>
    </Card>
  );
};

export default LookalikeAudienceBuilder;
