import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Signpost, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Minus, MapPin, PoundSterling } from 'lucide-react';
import { format, subMonths, startOfMonth, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useIsManagement } from '@/hooks/useIsManagement';
import BillboardDemographicsPanel from './BillboardDemographicsPanel';


interface Campaign {
  id: string;
  name: string;
  campaign_type: string;
  location: string | null;
  postcode_prefixes: string[];
  install_date: string;
  end_date: string | null;
  monthly_cost: number | null;
  notes: string | null;
  is_active: boolean;
}

interface MonthStat { month: string; sales: number; revenue: number; organic_sales?: number; organic_revenue?: number }

const CAMPAIGN_TYPES = [
  { value: 'banner', label: 'Motorway banner' },
  { value: 'billboard', label: 'Billboard' },
  { value: 'bus', label: 'Bus / transport' },
  { value: 'print', label: 'Print / leaflet' },
  { value: 'other', label: 'Other' },
];

const emptyForm = {
  name: '',
  campaign_type: 'banner',
  location: '',
  postcode_prefixes: '',
  install_date: format(new Date(), 'yyyy-MM-dd'),
  end_date: '',
  monthly_cost: '',
  notes: '',
  is_active: true,
};

const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;

const CampaignForm: React.FC<{
  campaign?: Campaign;
  onDone: () => void;
}> = ({ campaign, onDone }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(
    campaign
      ? {
          name: campaign.name,
          campaign_type: campaign.campaign_type,
          location: campaign.location ?? '',
          postcode_prefixes: (campaign.postcode_prefixes || []).join(', '),
          install_date: campaign.install_date,
          end_date: campaign.end_date ?? '',
          monthly_cost: campaign.monthly_cost != null ? String(campaign.monthly_cost) : '',
          notes: campaign.notes ?? '',
          is_active: campaign.is_active,
        }
      : emptyForm
  );

  const save = useMutation({
    mutationFn: async () => {
      const prefixes = form.postcode_prefixes
        .split(',')
        .map((p) => p.trim().toUpperCase())
        .filter(Boolean);
      if (!form.name.trim()) throw new Error('Name is required');
      if (prefixes.length === 0) throw new Error('Add at least one postcode area (e.g. HD, WF)');
      const payload = {
        name: form.name.trim(),
        campaign_type: form.campaign_type,
        location: form.location.trim() || null,
        postcode_prefixes: prefixes,
        install_date: form.install_date,
        end_date: form.end_date || null,
        monthly_cost: form.monthly_cost ? Number(form.monthly_cost) : 0,
        notes: form.notes.trim() || null,
        is_active: form.is_active,
      };
      if (campaign) {
        const { error } = await supabase.from('offline_campaigns').update(payload).eq('id', campaign.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('offline_campaigns').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(campaign ? 'Campaign updated' : 'Campaign added');
      queryClient.invalidateQueries({ queryKey: ['offline-campaigns'] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="M62 J23 Huddersfield" />
        </div>
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Select value={form.campaign_type} onValueChange={(v) => setForm({ ...form, campaign_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CAMPAIGN_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Location</Label>
          <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="M62 Junction 23, northbound" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Catchment postcode areas</Label>
          <Input
            value={form.postcode_prefixes}
            onChange={(e) => setForm({ ...form, postcode_prefixes: e.target.value })}
            placeholder="HD, HX, WF"
          />
          <p className="text-xs text-muted-foreground">Comma separated. Sales are matched on customer postcode starting with these.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Install date</Label>
          <Input type="date" value={form.install_date} onChange={(e) => setForm({ ...form, install_date: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>End date (optional)</Label>
          <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Monthly cost (£)</Label>
          <Input type="number" value={form.monthly_cost} onChange={(e) => setForm({ ...form, monthly_cost: e.target.value })} placeholder="750" />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          <Label className="mb-0">Currently live</Label>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : campaign ? 'Save changes' : 'Add campaign'}
        </Button>
      </DialogFooter>
    </div>
  );
};

const CampaignCard: React.FC<{ campaign: Campaign; canManage: boolean; monthsWindow: number }> = ({
  campaign,
  canManage,
  monthsWindow,
}) => {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const install = parseISO(campaign.install_date);
  const from = format(startOfMonth(subMonths(install, monthsWindow)), 'yyyy-MM-dd');
  const to = format(new Date(), 'yyyy-MM-dd');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['offline-campaign-stats', campaign.id, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('offline_campaign_monthly_stats', {
        _prefixes: campaign.postcode_prefixes,
        _from: from,
        _to: to,
      });
      if (error) throw error;
      return (data || []) as MonthStat[];
    },
  });

  const analysis = useMemo(() => {
    const rows = stats || [];
    const installMonth = format(startOfMonth(install), 'yyyy-MM-dd');
    const before = rows.filter((r) => r.month < installMonth);
    const after = rows.filter((r) => r.month >= installMonth);
    const avg = (arr: MonthStat[], key: 'sales' | 'revenue') =>
      arr.length ? arr.reduce((s, r) => s + Number(r[key] || 0), 0) / arr.length : 0;
    const beforeAvg = avg(before, 'sales');
    const afterAvg = avg(after, 'sales');
    const change = beforeAvg > 0 ? ((afterAvg - beforeAvg) / beforeAvg) * 100 : afterAvg > 0 ? 100 : 0;
    const afterRevenue = after.reduce((s, r) => s + Number(r.revenue || 0), 0);
    const afterOrganic = after.reduce((s, r) => s + Number(r.organic_sales || 0), 0);
    const afterOrganicRevenue = after.reduce((s, r) => s + Number(r.organic_revenue || 0), 0);
    const beforeOrganic = before.reduce((s, r) => s + Number(r.organic_sales || 0), 0);
    const afterSales = after.reduce((s, r) => s + Number(r.sales || 0), 0);
    const spend = (campaign.monthly_cost || 0) * Math.max(after.length, 0);
    return {
      rows, before, after, beforeAvg, afterAvg, change, afterRevenue, spend, installMonth,
      afterOrganic, afterOrganicRevenue, beforeOrganic, afterSales,
      organicShare: afterSales ? (afterOrganic / afterSales) * 100 : 0,
      organicPerMonth: after.length ? afterOrganic / after.length : 0,
      beforeOrganicPerMonth: before.length ? beforeOrganic / before.length : 0,
    };
  }, [stats, campaign.monthly_cost, install]);

  const maxSales = Math.max(1, ...analysis.rows.map((r) => Number(r.sales)));

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('offline_campaigns').delete().eq('id', campaign.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Campaign removed');
      queryClient.invalidateQueries({ queryKey: ['offline-campaigns'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const TrendIcon = analysis.change > 3 ? TrendingUp : analysis.change < -3 ? TrendingDown : Minus;
  const trendClass =
    analysis.change > 3 ? 'text-emerald-600' : analysis.change < -3 ? 'text-red-600' : 'text-muted-foreground';

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Signpost className="h-4 w-4 text-primary" />
              {campaign.name}
              {campaign.is_active ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">Live</Badge>
              ) : (
                <Badge variant="secondary">Ended</Badge>
              )}
            </CardTitle>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {campaign.location || '—'}
              </span>
              <span>Installed {format(install, 'd MMM yyyy')}</span>
              {!!campaign.monthly_cost && (
                <span className="inline-flex items-center gap-1">
                  <PoundSterling className="h-3 w-3" />
                  {gbp(campaign.monthly_cost)}/month
                </span>
              )}
              <span>{campaign.postcode_prefixes.join(', ')}</span>
            </p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" /></Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>Edit campaign</DialogTitle></DialogHeader>
                  <CampaignForm campaign={campaign} onDone={() => setEditOpen(false)} />
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
                onClick={() => { if (confirm(`Remove "${campaign.name}"?`)) remove.mutate(); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading sales data…</p>
        ) : (
          <>
            {/* Before / after summary */}
            <div className="grid gap-3 sm:grid-cols-5">
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Avg sales / month before</p>
                <p className="text-xl font-bold">{analysis.beforeAvg.toFixed(1)}</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Avg sales / month since</p>
                <p className="text-xl font-bold">{analysis.afterAvg.toFixed(1)}</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Change</p>
                <p className={`flex items-center gap-1 text-xl font-bold ${trendClass}`}>
                  <TrendIcon className="h-4 w-4" />
                  {analysis.change > 0 ? '+' : ''}{analysis.change.toFixed(0)}%
                </p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Revenue since install</p>
                <p className="text-xl font-bold">{gbp(analysis.afterRevenue)}</p>
                {analysis.spend > 0 && (
                  <p className="text-xs text-muted-foreground">Spend {gbp(analysis.spend)}</p>
                )}
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
                <p className="text-xs text-muted-foreground">Organic sales since install</p>
                <p className="text-xl font-bold text-emerald-700">{analysis.afterOrganic}</p>
                <p className="text-xs text-muted-foreground">
                  {analysis.organicShare.toFixed(0)}% of sales · {gbp(analysis.afterOrganicRevenue)} · {analysis.organicPerMonth.toFixed(1)}/month
                  {analysis.before.length ? ` (was ${analysis.beforeOrganicPerMonth.toFixed(1)}/month)` : ''}
                </p>
              </div>
            </div>

            {/* Organic sales per month */}
            {analysis.rows.length > 0 && (
              <div className="rounded-md border bg-muted/20 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Organic sales per month (no paid ad click — the only way a billboard sale can land)
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        <th className="py-1 pr-3 text-left font-medium">Month</th>
                        <th className="py-1 pr-3 text-right font-medium">Total sales</th>
                        <th className="py-1 pr-3 text-right font-medium">Organic sales</th>
                        <th className="py-1 pr-3 text-right font-medium">Organic %</th>
                        <th className="py-1 text-right font-medium">Organic revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.rows.map((r) => {
                        const total = Number(r.sales || 0);
                        const org = Number(r.organic_sales || 0);
                        const isAfter = r.month >= analysis.installMonth;
                        return (
                          <tr key={r.month} className="border-t border-border/60">
                            <td className="py-1.5 pr-3 font-medium">
                              {format(parseISO(r.month), 'MMM yyyy')}
                              {isAfter && (
                                <span className="ml-2 text-[10px] font-normal text-emerald-600">since install</span>
                              )}
                            </td>
                            <td className="py-1.5 pr-3 text-right">{total}</td>
                            <td className="py-1.5 pr-3 text-right font-semibold text-emerald-700">{org}</td>
                            <td className="py-1.5 pr-3 text-right">{total ? `${((org / total) * 100).toFixed(0)}%` : '—'}</td>
                            <td className="py-1.5 text-right">{gbp(Number(r.organic_revenue || 0))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Monthly bars with install marker */}
            <div>
              <div className="flex items-end gap-1.5 overflow-x-auto pb-1">
                {analysis.rows.map((r) => {
                  const isAfter = r.month >= analysis.installMonth;
                  const isInstallMonth = r.month === analysis.installMonth;
                  return (
                    <div key={r.month} className="flex min-w-[38px] flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold">{r.sales}</span>
                      <div
                        className={`w-full rounded-t ${isAfter ? 'bg-emerald-500' : 'bg-slate-300'} ${
                          isInstallMonth ? 'ring-2 ring-primary' : ''
                        }`}
                        style={{ height: `${Math.max(4, (Number(r.sales) / maxSales) * 90)}px` }}
                        title={`${format(parseISO(r.month), 'MMM yyyy')}: ${r.sales} sales · ${gbp(Number(r.revenue))}`}
                      />
                      <span className="text-[10px] text-muted-foreground">{format(parseISO(r.month), 'MMM')}</span>
                    </div>
                  );
                })}
                {analysis.rows.length === 0 && (
                  <p className="text-sm text-muted-foreground">No sales found in these postcode areas yet.</p>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Grey = before install · Green = since install · Ringed bar = install month
              </p>
            </div>

            {campaign.notes && <p className="text-xs text-muted-foreground">{campaign.notes}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export const OfflineCampaignsTab: React.FC = () => {
  const { isManagement } = useIsManagement();
  const [addOpen, setAddOpen] = useState(false);
  const [monthsWindow, setMonthsWindow] = useState(3);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['offline-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offline_campaigns')
        .select('*')
        .order('install_date', { ascending: false });
      if (error) throw error;
      return (data || []) as Campaign[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Banners / Billboards</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track offline campaigns and see whether sales in the catchment postcodes went up or down after install.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(monthsWindow)} onValueChange={(v) => setMonthsWindow(Number(v))}>
            <SelectTrigger className="h-9 w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 months before install</SelectItem>
              <SelectItem value="3">3 months before install</SelectItem>
              <SelectItem value="6">6 months before install</SelectItem>
              <SelectItem value="12">12 months before install</SelectItem>
            </SelectContent>
          </Select>
          {isManagement && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-1.5 h-4 w-4" />Add campaign</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Add banner / billboard</DialogTitle></DialogHeader>
                <CampaignForm onDone={() => setAddOpen(false)} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading campaigns…</p>
      ) : (campaigns || []).length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Signpost className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No banners or billboards tracked yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add one with its install date and catchment postcodes to start measuring impact.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(campaigns || []).map((c) => (
            <CampaignCard key={c.id} campaign={c} canManage={isManagement} monthsWindow={monthsWindow} />
          ))}
        </div>
      )}

      <BillboardDemographicsPanel />

    </div>
  );
};

export default OfflineCampaignsTab;
