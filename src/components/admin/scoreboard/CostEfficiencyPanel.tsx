import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, PoundSterling, TrendingDown, Target, AlertTriangle, Pencil, Save, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { toast } from 'sonner';

interface Props {
  currentUserRole: string | null;
  referenceDate?: Date; // anchor month (defaults to today)
}

interface Stats {
  totalLeads: number;
  paidLeads: number;
  lostLeads: number;
  unworkedLeads: number;
  spend: number;
}

const isoMonthStart = (d: Date) => format(startOfMonth(d), 'yyyy-MM-dd');

export const CostEfficiencyPanel: React.FC<Props> = ({ currentUserRole, referenceDate }) => {
  const isSuperAdmin = currentUserRole === 'super_admin';
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ totalLeads: 0, paidLeads: 0, lostLeads: 0, unworkedLeads: 0, spend: 0 });
  const [editing, setEditing] = useState(false);
  const [spendInput, setSpendInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [visible, setVisible] = useState(false);

  const anchor = referenceDate || new Date();
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);

  const fetchAll = async () => {
    if (!isSuperAdmin) return;
    setLoading(true);
    try {
      const fromIso = monthStart.toISOString();
      const toIso = monthEnd.toISOString();

      const [totalQ, paidQ, lostQ, unworkedQ, spendQ] = await Promise.all([
        supabase.from('sales_leads').select('id', { count: 'exact', head: true })
          .gte('created_at', fromIso).lte('created_at', toIso),
        supabase.from('sales_leads').select('id', { count: 'exact', head: true })
          .gte('created_at', fromIso).lte('created_at', toIso).eq('is_paid', true),
        supabase.from('sales_leads').select('id', { count: 'exact', head: true })
          .gte('created_at', fromIso).lte('created_at', toIso).in('status', ['lost', 'fake_lead']),
        supabase.from('sales_leads').select('id', { count: 'exact', head: true })
          .gte('created_at', fromIso).lte('created_at', toIso).eq('status', 'new'),
        supabase.from('marketing_spend').select('amount').eq('month_start', isoMonthStart(anchor)).maybeSingle(),
      ]);

      setStats({
        totalLeads: totalQ.count || 0,
        paidLeads: paidQ.count || 0,
        lostLeads: lostQ.count || 0,
        unworkedLeads: unworkedQ.count || 0,
        spend: Number(spendQ.data?.amount || 0),
      });
      setSpendInput(spendQ.data?.amount ? String(spendQ.data.amount) : '');
    } catch (e) {
      console.error('CostEfficiencyPanel fetch error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (visible) fetchAll(); /* eslint-disable-next-line */ }, [isSuperAdmin, monthStart.getTime(), visible]);

  const saveSpend = async () => {
    const amount = parseFloat(spendInput);
    if (isNaN(amount) || amount < 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('marketing_spend')
        .select('id')
        .eq('month_start', isoMonthStart(anchor))
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase.from('marketing_spend')
          .update({ amount, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('marketing_spend')
          .insert({ month_start: isoMonthStart(anchor), amount });
        if (error) throw error;
      }
      toast.success('Ad spend saved');
      setEditing(false);
      fetchAll();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const metrics = useMemo(() => {
    const cpl = stats.totalLeads > 0 ? stats.spend / stats.totalLeads : 0;
    const cpa = stats.paidLeads > 0 ? stats.spend / stats.paidLeads : 0;
    const wasted = cpl * (stats.lostLeads + stats.unworkedLeads);
    return { cpl, cpa, wasted };
  }, [stats]);

  if (!isSuperAdmin) return null;

  if (!visible) {
    return (
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => setVisible(true)}>
          <Eye className="h-3.5 w-3.5" />
          Show Cost Efficiency
          <Badge variant="outline" className="ml-1 text-[10px] border-amber-400 text-amber-700">Super admin</Badge>
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50/40 to-orange-50/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-4 w-4 text-amber-600" />
            Cost Efficiency — {format(anchor, 'MMMM yyyy')}
            <Badge variant="outline" className="ml-2 text-[10px] border-amber-400 text-amber-700">Super admin only</Badge>
          </CardTitle>
          <Popover open={editing} onOpenChange={setEditing}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Pencil className="h-3.5 w-3.5" />
                {stats.spend > 0 ? `£${stats.spend.toLocaleString()} ad spend` : 'Set ad spend'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="end">
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-semibold">Ad spend for {format(anchor, 'MMM yyyy')}</div>
                  <div className="text-xs text-muted-foreground">Total marketing spend this month (£)</div>
                </div>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={spendInput}
                  onChange={(e) => setSpendInput(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
                <Button onClick={saveSpend} disabled={saving} className="w-full" size="sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" /> Save</>}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => setVisible(false)}>
            <EyeOff className="h-3.5 w-3.5" />
            Hide
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric
              icon={<PoundSterling className="h-4 w-4" />}
              label="Cost per lead"
              value={stats.spend > 0 ? `£${metrics.cpl.toFixed(2)}` : '—'}
              sub={`${stats.totalLeads.toLocaleString()} leads`}
            />
            <Metric
              icon={<Target className="h-4 w-4" />}
              label="Cost per sale"
              value={stats.spend > 0 && stats.paidLeads > 0 ? `£${metrics.cpa.toFixed(2)}` : '—'}
              sub={`${stats.paidLeads.toLocaleString()} paid`}
            />
            <Metric
              icon={<TrendingDown className="h-4 w-4 text-red-500" />}
              label="£ wasted on lost"
              value={stats.spend > 0 ? `£${(metrics.cpl * stats.lostLeads).toFixed(0)}` : '—'}
              sub={`${stats.lostLeads} lost`}
              tone="danger"
            />
            <Metric
              icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
              label="£ at risk (unworked)"
              value={stats.spend > 0 ? `£${(metrics.cpl * stats.unworkedLeads).toFixed(0)}` : '—'}
              sub={`${stats.unworkedLeads} unworked`}
              tone="warning"
            />
          </div>
        )}
        {stats.spend === 0 && !loading && (
          <p className="text-xs text-muted-foreground mt-3">
            Set this month's ad spend to calculate CPL, CPA and £ lost on dropped leads.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

interface MetricProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: 'default' | 'danger' | 'warning';
}

const Metric: React.FC<MetricProps> = ({ icon, label, value, sub, tone = 'default' }) => {
  const valueClass =
    tone === 'danger' ? 'text-red-600' :
    tone === 'warning' ? 'text-orange-600' :
    'text-foreground';
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon}
        <span className="font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
};
