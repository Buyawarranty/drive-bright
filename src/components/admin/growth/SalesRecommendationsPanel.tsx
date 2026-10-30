import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { buildRecommendations, computeSalesGap, type SalesSnapshot } from '@/lib/salesRecommendations';
import { isCompanySalesValueTabBlocked } from '@/lib/tabAccess';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const gbp = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
const EXCLUDED = ['cancelled', 'refunded'];

const sourceLabel = (s: string | null) => {
  const v = (s || '').toLowerCase();
  if (v.includes('google')) return 'Google';
  if (v.includes('social') || v.includes('facebook') || v.includes('meta')) return 'Meta';
  if (v.includes('renewal')) return 'Renewals';
  if (!v) return 'Other';
  return v.includes('organic') || v === 'website' ? 'Organic' : 'Agent / other';
};

export default function SalesRecommendationsPanel() {
  const [open, setOpen] = useState(true);
  const [snap, setSnap] = useState<SalesSnapshot | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        const { data: staff, error: staffError } = await supabase.from('admin_users')
          .select('role, is_active').eq('user_id', auth.user.id).maybeSingle();
        if (staffError || !staff?.is_active || isCompanySalesValueTabBlocked('growth-sales', staff.role)) return;
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastSameDay = new Date(today.getFullYear(), today.getMonth() - 1, Math.min(today.getDate(), new Date(today.getFullYear(), today.getMonth(), 0).getDate()));
        const [{ data: rows, error: e1 }, { data: tgt }] = await Promise.all([
          supabase.from('customers').select('final_amount,signup_date,status,purchase_source,is_deleted')
            .gte('signup_date', iso(lastStart)).lte('signup_date', `${iso(today)}T23:59:59`)
            .not('email', 'ilike', '%@test.com%').limit(5000),
          supabase.from('monthly_revenue_targets').select('target_amount').eq('target_month', iso(monthStart)).maybeSingle(),
        ]);
        if (e1) throw e1;
        const s: SalesSnapshot = { today, target: Number(tgt?.target_amount) || 0, monthRevenue: 0, monthSales: 0, lastMonthSameDayRevenue: 0, lastMonthSameDaySales: 0, bySource: {} };
        for (const r of (rows || []) as any[]) {
          if (r.is_deleted || EXCLUDED.includes(String(r.status || '').toLowerCase())) continue;
          const d = String(r.signup_date).slice(0, 10);
          const amt = Number(r.final_amount) || 0;
          if (d >= iso(monthStart)) {
            s.monthRevenue += amt; s.monthSales++;
            const k = sourceLabel(r.purchase_source);
            s.bySource[k] = s.bySource[k] || { sales: 0, revenue: 0 };
            s.bySource[k].sales++; s.bySource[k].revenue += amt;
          } else if (d <= iso(lastSameDay)) {
            s.lastMonthSameDayRevenue += amt; s.lastMonthSameDaySales++;
          }
        }
        if (active) setSnap(s);
      } catch {
        if (active) setError('Sales figures are unavailable for this login, so recommendations can’t be calculated.');
      }
    })();
    return () => { active = false; };
  }, []);

  const gap = snap ? computeSalesGap(snap) : null;
  const recs = snap ? buildRecommendations(snap) : [];
  const tone = { high: 'border-l-destructive', medium: 'border-l-primary', low: 'border-l-muted-foreground' } as const;

  return (
    <section className="mb-4 rounded-lg border bg-card">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between p-3 text-left">
        <span className="flex items-center gap-2 font-semibold"><Target className="h-4 w-4 text-primary" />Sales recommendations this month</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <div className="px-3 pb-3 max-h-[40vh] overflow-y-auto">
        {error && <p className="text-sm text-muted-foreground">{error}</p>}
        {!snap && !error && <p className="text-sm text-muted-foreground">Working out targets and gaps…</p>}
        {snap && gap && <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-sm">
            <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Revenue so far</div><div className="font-semibold">{gbp(snap.monthRevenue)}</div></div>
            <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Monthly goal</div><div className="font-semibold">{snap.target ? gbp(snap.target) : 'Not set'}</div></div>
            <div className="rounded border p-2"><div className="text-muted-foreground text-xs">{gap.gap > 0 ? 'Behind pace' : 'Ahead of pace'}</div><div className="font-semibold">{snap.target ? gbp(Math.abs(gap.gap)) : '—'}</div></div>
            <div className="rounded border p-2"><div className="text-muted-foreground text-xs">Needed per day</div><div className="font-semibold">{snap.target ? gbp(gap.neededPerDay) : '—'}</div></div>
          </div>
          <ol className="space-y-2">
            {recs.map((r, i) => (
              <li key={i} className={`border-l-4 ${tone[r.priority]} pl-3`}>
                <div className="text-sm font-medium">{i + 1}. {r.title} <span className="text-xs text-muted-foreground capitalize">· {r.priority} priority</span></div>
                <div className="text-sm text-muted-foreground">{r.detail}</div>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground mt-2">Suggestions only — nothing is changed. Ask the assistant below for a deeper plan.</p>
        </>}
      </div>}
    </section>
  );
}
