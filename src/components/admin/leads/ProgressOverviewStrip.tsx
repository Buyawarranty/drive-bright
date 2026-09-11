import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Target, ShieldAlert, Star, Coffee, CalendarDays, Info, Loader2, Plus, Play, Minus, BadgePercent } from 'lucide-react';
import { endOfMonth, startOfMonth, startOfWeek, addDays, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { buildSaleCreditResolver, fetchSalesCreditAgentIds } from '@/lib/saleCredit';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { withBackgroundPriority } from '@/lib/requestQueue';

/**
 * Per-agent progress strip — every sales agent sees ONLY their own figures.
 *
 * No team-wide numbers, no sample data: every value is read live for the signed-in
 * agent. Reviews are self-logged by the agent (there is no Trustpilot API feed),
 * so the card starts at zero until they tick a review they personally asked for.
 * Guidance is delivered by hover tooltips rather than dead "expand" links.
 */

const gbp = (n: number) => `£${Math.round(n || 0).toLocaleString('en-GB')}`;

type CustomerHit = {
  id: string;
  name: string | null;
  email: string | null;
  registration_plate: string | null;
  plan_type: string | null;
};

const Cell: React.FC<{
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  help: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, iconClass, label, help, children }) => (
  <div className="shrink-0 px-4 py-2.5 flex gap-2.5 items-start">
    <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${iconClass}`}>{icon}</div>
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" aria-label={`About ${label}`} className="text-muted-foreground hover:text-foreground">
              <Info className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs normal-case tracking-normal text-xs leading-relaxed text-left">
            {help}
          </TooltipContent>
        </Tooltip>
      </div>
      {children}
    </div>
  </div>
);

type BreakStatus = 'available' | 'break' | 'lunch' | 'training' | 'meeting' | 'off';

interface MyData {
  revenue: number;
  target: number | null;
  workDays: Record<string, string>; // yyyy-MM-dd -> day_type
  breakStatus: BreakStatus;
  breakStartedAt: string | null;
  breakSessionsToday: number;
  breakMinutesToday: number;
  lowSaleDays: number; // completed rota'd service days since my last sale
  lastSaleAt: string | null;
  salesReadFailed: boolean;
  lastSaleProof: string | null;
  positives: number;
  negatives: number;
  monthPositives: number;
  monthNegatives: number;
  // Authoritative allocation state, straight from agent_distribution_caps — the
  // same row the New leads freeze banner and the manager panels read. Never
  // re-derive "paused" locally, or the strip contradicts the banner.
  allocationPaused: boolean;
  freezeSource: string | null;
  freezeReason: string | null;
  frozenUntil: string | null;
}

const EMPTY: MyData = {
  revenue: 0,
  target: null,
  workDays: {},
  breakStatus: 'available',
  breakStartedAt: null,
  breakSessionsToday: 0,
  breakMinutesToday: 0,
  lowSaleDays: 0,
  lastSaleAt: null,
  salesReadFailed: false,
  lastSaleProof: null,
  positives: 0,
  negatives: 0,
  monthPositives: 0,
  monthNegatives: 0,
  allocationPaused: false,
  freezeSource: null,
  freezeReason: null,
  frozenUntil: null,
};

export const ProgressOverviewStrip: React.FC = () => {
  const adminId = useCurrentAdminId();
  const [data, setData] = useState<MyData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewName, setReviewName] = useState('');
  const [reviewChannel, setReviewChannel] = useState('call');
  const [results, setResults] = useState<CustomerHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<CustomerHit | null>(null);
  // "Save online sale" authorisation — shown only when management have switched
  // it on for this agent (save_online_sale_agents.enabled).
  const [saveOnline, setSaveOnline] = useState<{ pct: number; authorisedAt: string | null; open: number } | null>(null);


  const now = new Date();
  const weekStart = useMemo(() => startOfWeek(now, { weekStartsOn: 1 }), [now.toDateString()]);
  const monthStart = useMemo(() => startOfMonth(now), [now.getMonth()]);

  const load = useCallback(async () => {
    if (!adminId) return;
    setLoading(true);
    try {
      const todayStr = format(now, 'yyyy-MM-dd');
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const weekEndStr = format(addDays(weekStart, 6), 'yyyy-MM-dd');
      const dayStart = new Date(`${todayStr}T00:00:00.000Z`).toISOString();

      // allSettled, never all: one failing read (scoreboard RPC, rota RLS, break
      // tables) must not wipe out every other cell. Before this, a single rejection
      // left the whole strip on EMPTY — which showed "Receiving leads / no working
      // days without a sale / no sale in the last 180 days" for agents who plainly
      // had sales in Customer Management.
      const settled = await withBackgroundPriority(() => Promise.allSettled([
        supabase.rpc('get_team_scoreboard', {
          p_start: monthStart.toISOString(),
          p_end: endOfMonth(now).toISOString(),
        }),
        (supabase as any)
          .from('agent_working_days')
          .select('work_date, day_type')
          .eq('admin_user_id', adminId)
          .gte('work_date', format(addDays(now, -21), 'yyyy-MM-dd'))
          .lte('work_date', weekEndStr),
        (supabase as any)
          .from('agent_break_status')
          .select('status, started_at')
          .eq('admin_user_id', adminId)
          .maybeSingle(),
        (supabase as any)
          .from('agent_break_log')
          .select('minutes, started_at')
          .eq('admin_user_id', adminId)
          .gte('started_at', dayStart),
        (supabase as any)
          .from('agent_review_claims')
          .select('kind')
          .eq('admin_user_id', adminId)
          .eq('week_start', weekStartStr),
        // My own sales, filtered server-side on every attribution column so the
        // row can never be lost to a page limit. Same four credit columns that
        // Customer Management uses, so the two screens always agree. 180-day
        // window so the "last sale" proof is always found after a long gap.
        supabase
          .from('customers')
          .select('signup_date, name, registration_plate, final_amount, status, sale_credit_admin_user_id, payment_confirmed_by, quote_sent_by, assigned_to')
          .eq('is_deleted', false)
          .or(
            `sale_credit_admin_user_id.eq.${adminId},payment_confirmed_by.eq.${adminId},quote_sent_by.eq.${adminId},assigned_to.eq.${adminId}`
          )
          .gte('signup_date', addDays(now, -180).toISOString())
          .order('signup_date', { ascending: false })
          .limit(1000),
        // Month-to-date reviews, for the 10-a-month minimum target.
        (supabase as any)
          .from('agent_review_claims')
          .select('kind')
          .eq('admin_user_id', adminId)
          .gte('created_at', monthStart.toISOString()),
        // Authoritative allocation state — same row as the freeze banner.
        (supabase as any)
          .from('agent_distribution_caps')
          .select('paused, freeze_source, freeze_reason, frozen_until')
          .eq('admin_user_id', adminId)
          .maybeSingle(),
      ]));

      const val = (i: number): any => (settled[i].status === 'fulfilled' ? (settled[i] as any).value : null);
      settled.forEach((s, i) => {
        if (s.status === 'rejected') console.warn('[ProgressOverviewStrip] read failed', i, s.reason);
        else if ((s.value as any)?.error) console.warn('[ProgressOverviewStrip] read error', i, (s.value as any).error);
      });
      const [scoreRes, daysRes, statusRes, logRes, reviewRes, salesRes, monthReviewRes, capsRes] = [0, 1, 2, 3, 4, 5, 6, 7].map(val);
      const caps = (capsRes as any)?.data || null;



      const mine = ((scoreRes.data || []) as any[]).find((r) => r.admin_user_id === adminId);

      const workDays: Record<string, string> = {};
      ((daysRes as any)?.data || []).forEach((r: any) => {
        workDays[String(r.work_date)] = r.day_type || 'worked';
      });

      const logs = ((logRes as any)?.data || []) as Array<{ minutes: number | null }>;
      const breakMinutesToday = logs.reduce((s, l) => s + (Number(l.minutes) || 0), 0);

      const reviews = ((reviewRes as any)?.data || []) as Array<{ kind: string }>;
      const positives = reviews.filter((r) => r.kind === 'positive').length;
      const negatives = reviews.filter((r) => r.kind === 'negative_removed').length;

      const monthReviews = ((monthReviewRes as any)?.data || []) as Array<{ kind: string }>;
      const monthPositives = monthReviews.filter((r) => r.kind === 'positive').length;
      const monthNegatives = monthReviews.filter((r) => r.kind === 'negative_removed').length;

      // My own sales per day, plus the date of my most recent sale. Cancelled and
      // refunded rows never count as a sale; anything else does. A sale belongs to
      // exactly ONE agent, so the same single-credit rule the scoreboard uses is
      // applied here — otherwise a deal a colleague confirmed would be counted twice.
      const DEAD_STATUSES = ['cancelled', 'canceled', 'refunded'];
      const resolveCredit = buildSaleCreditResolver(await fetchSalesCreditAgentIds());
      const perDay = new Map<string, number>();
      let lastSaleAt: string | null = null;
      let lastSaleProof: string | null = null;
      ((salesRes as any)?.data || []).forEach((s: any) => {
        if (!s.signup_date) return;
        const st = String(s.status || '').toLowerCase();
        if (DEAD_STATUSES.some((d) => st.includes(d))) return;
        if (resolveCredit(s) !== adminId) return;
        const key = format(new Date(s.signup_date), 'yyyy-MM-dd');
        perDay.set(key, (perDay.get(key) || 0) + 1);
        if (!lastSaleAt || new Date(s.signup_date) > new Date(lastSaleAt)) {
          lastSaleAt = s.signup_date;
          lastSaleProof = [s.name, s.registration_plate, s.final_amount != null ? gbp(Number(s.final_amount)) : null]
            .filter(Boolean)
            .join(' · ') || null;
        }
      });



      // Completed service days since my last sale. Today is still in progress so it
      // never counts, Sundays are not service days, and a day I was not rota'd on
      // (day off, holiday, sick) is skipped rather than held against me. Any day
      // with a sale resets the run — so a sale three days ago means three days.
      // Rota day types that mean "I was on service that day". The rota card stores
      // full_day/half_day; timesheet-style rows use worked/wfh/training. Anything
      // else (off, holiday, sick, unpaid) is skipped rather than held against me.
      const SERVICE_TYPES = new Set(['full_day', 'half_day', 'worked', 'wfh', 'training']);
      const isServiceDay = (d: Date) => {
        if (d.getDay() === 0) return false;
        const type = workDays[format(d, 'yyyy-MM-dd')];
        if (!type) return d.getDay() !== 6; // no rota row: weekdays count, Saturdays don't
        return SERVICE_TYPES.has(String(type).toLowerCase());
      };

      // A sale today clears the run immediately — you can never be shown as paused
      // on a day you have already sold. Otherwise count back over completed
      // service days until the day of your last sale.
      let lowSaleDays = 0;
      const soldToday = (perDay.get(format(now, 'yyyy-MM-dd')) || 0) > 0;
      if (!soldToday) {
        for (let i = 1; i <= 21; i++) {
          const d = addDays(now, -i);
          if (!isServiceDay(d)) continue;
          if ((perDay.get(format(d, 'yyyy-MM-dd')) || 0) > 0) break;
          lowSaleDays += 1;
        }
      }

      setData({
        salesReadFailed: !salesRes || !!(salesRes as any)?.error,
        lastSaleAt,
        lastSaleProof,
        revenue: Number(mine?.revenue) || 0,
        target: mine?.revenue_target != null ? Number(mine.revenue_target) : null,
        workDays,
        breakStatus: ((statusRes as any)?.data?.status as BreakStatus) || 'available',
        breakStartedAt: (statusRes as any)?.data?.started_at || null,
        breakSessionsToday: logs.length,
        breakMinutesToday,
        lowSaleDays,
        positives,
        negatives,
        monthPositives,
        monthNegatives,
        allocationPaused: caps?.paused === true,
        freezeSource: caps?.freeze_source ?? null,
        freezeReason: caps?.freeze_reason ?? null,
        frozenUntil: caps?.frozen_until ?? null,
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId, weekStart.toDateString()]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!adminId) return;
    let cancelled = false;
    (async () => {
      const [permRes, leadRes] = await Promise.all([
        (supabase as any)
          .from('save_online_sale_agents')
          .select('enabled, commission_pct, authorised_at')
          .eq('admin_user_id', adminId)
          .maybeSingle(),
        (supabase as any)
          .from('sales_leads')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', adminId)
          .eq('save_online_sale', true)
          .not('status', 'in', '(converted,lost,archived)'),
      ]);
      if (cancelled) return;
      const perm = permRes?.data;
      setSaveOnline(
        perm?.enabled
          ? {
              pct: Number(perm.commission_pct ?? 4),
              authorisedAt: perm.authorised_at ?? null,
              open: leadRes?.count ?? 0,
            }
          : null,
      );
    })();
    return () => { cancelled = true; };
  }, [adminId]);


  const toggleBreak = async () => {
    if (!adminId) return;
    setSaving(true);
    const goingOnBreak = data.breakStatus === 'available';
    try {
      const { error } = await (supabase as any).from('agent_break_status').upsert(
        {
          admin_user_id: adminId,
          status: goingOnBreak ? 'break' : 'available',
          started_at: new Date().toISOString(),
        },
        { onConflict: 'admin_user_id' },
      );
      if (error) throw error;
      toast.success(goingOnBreak ? 'You are on break' : 'Welcome back — you are off break');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Could not update your break status');
    } finally {
      setSaving(false);
    }
  };

  // Look the customer up from the CRM by name, registration plate or email so the
  // claim is tied to a real record rather than a typed name.
  const searchCustomers = useCallback(async (term: string) => {
    const q = term.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const plate = q.replace(/\s+/g, '');
      const { data } = await supabase
        .from('customers')
        .select('id, name, email, registration_plate, plan_type')
        .eq('is_deleted', false)
        .or(`name.ilike.%${q}%,registration_plate.ilike.%${plate}%,email.ilike.%${q}%`)
        .order('signup_date', { ascending: false })
        .limit(8);
      setResults((data as CustomerHit[]) || []);
    } finally {
      setSearching(false);
    }
  }, []);

  const logReview = async (kind: 'positive' | 'negative_removed') => {
    if (!adminId) return;
    if (!picked) {
      toast.error('Find and select the customer this review is for');
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('agent_review_claims').insert({
        admin_user_id: adminId,
        week_start: format(weekStart, 'yyyy-MM-dd'),
        kind,
        customer_id: picked.id,
        customer_name: picked.name,
        registration_plate: picked.registration_plate,
        channel: reviewChannel,
      });
      if (error) throw error;

      // Reflect it on the customer record so Customer management shows the review.
      if (kind === 'positive') {
        await supabase
          .from('customers')
          .update({
            trustpilot_review_completed: true,
            trustpilot_review_completed_at: new Date().toISOString(),
          })
          .eq('id', picked.id);
      }

      toast.success(
        kind === 'positive'
          ? `Positive review logged for ${picked.name}`
          : `Negative review removal logged for ${picked.name}`,
      );
      setPicked(null);
      setReviewName('');
      setResults([]);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Could not log that review');
    } finally {
      setSaving(false);
    }
  };

  const removeLastReview = async (kind: 'positive' | 'negative_removed') => {
    if (!adminId) return;
    setSaving(true);
    try {
      const { data: rows } = await (supabase as any)
        .from('agent_review_claims')
        .select('id')
        .eq('admin_user_id', adminId)
        .eq('week_start', format(weekStart, 'yyyy-MM-dd'))
        .eq('kind', kind)
        .order('created_at', { ascending: false })
        .limit(1);
      const id = rows?.[0]?.id;
      if (!id) {
        toast.info('Nothing logged to remove');
        return;
      }
      await (supabase as any).from('agent_review_claims').delete().eq('id', id);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const pct = data.target && data.target > 0 ? Math.min(100, Math.round((data.revenue / data.target) * 100)) : null;
  const onBreak = data.breakStatus !== 'available' && data.breakStatus !== 'off';
  const bonus = data.positives * 5 + data.negatives * 10;
  const REVIEW_MONTH_TARGET = 10;
  const monthReviewsTotal = data.monthPositives + data.monthNegatives;

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  // "Paused" is whatever agent_distribution_caps says — the same source as the
  // New leads freeze banner, so the two can never disagree. lowSaleDays is only
  // ever used as an early "at risk" warning while allocation is still on.
  const frozen = data.allocationPaused;
  const atRisk = !frozen && !data.salesReadFailed && data.lowSaleDays >= 1;

  if (!adminId) return null;

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">My progress</span>
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Your own figures only
          </span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>

        <div className="flex items-stretch overflow-x-auto rounded-xl border border-border bg-card shadow-sm divide-x divide-border">
          <Cell
            icon={<Target className="h-4 w-4 text-orange-600" />}
            iconClass="bg-orange-100"
            label={`My target · ${format(now, 'MMMM')}`}
            help="Your own confirmed sales this month against your monthly revenue target, taken from the same figures as the Sales Scoreboard."
          >
            <div className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="text-lg font-bold">{gbp(data.revenue)}</span>
              <span className="text-xs text-muted-foreground">
                {data.target ? `of ${gbp(data.target)}${pct != null ? ` · ${pct}%` : ''}` : 'no target set'}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-40 rounded-full bg-muted">
              <div className="h-1.5 rounded-full bg-orange-500" style={{ width: `${pct ?? 0}%` }} />
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground whitespace-nowrap">
              {data.target ? `${gbp(Math.max(0, data.target - data.revenue))} to go` : 'Ask your manager to set a target'}
            </div>
          </Cell>

          {saveOnline && (
            <Cell
              icon={<BadgePercent className="h-4 w-4 text-emerald-600" />}
              iconClass="bg-emerald-100"
              label="Save online sale"
              help="Your manager has authorised you to receive imported online sales. Each one you close pays you a percentage of the full value of the sale. Phone these customers first."
            >
              <div className="flex items-baseline gap-2 whitespace-nowrap">
                <span className="text-lg font-bold">{saveOnline.pct}%</span>
                <span className="text-xs text-muted-foreground">of the full sale value</span>
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground whitespace-nowrap">
                Turned on{saveOnline.authorisedAt ? ` ${format(new Date(saveOnline.authorisedAt), 'd MMM')}` : ''} ·{' '}
                {saveOnline.open} open {saveOnline.open === 1 ? 'lead' : 'leads'}
              </div>
            </Cell>
          )}



          <Cell
            icon={<CalendarDays className="h-4 w-4 text-emerald-600" />}
            iconClass="bg-emerald-100"
            label="My attendance · this week"
            help="The days you have marked yourself as working on the rota calendar. Only your own days are shown here."
          >
            <div className="mt-0.5 flex gap-1">
              {dayLabels.map((d, i) => {
                const date = addDays(weekStart, i);
                const key = format(date, 'yyyy-MM-dd');
                const type = data.workDays[key];
                const working = !!type && type !== 'off';
                const isToday = format(now, 'yyyy-MM-dd') === key;
                return (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled={saving}
                        aria-pressed={working}
                        onClick={() => toggleMyWorkingDay(key, type)}
                        className={`h-6 w-6 rounded-md border text-[11px] font-semibold flex items-center justify-center transition-colors ${
                          working
                            ? 'bg-emerald-600 text-primary-foreground border-emerald-700'
                            : 'bg-background text-muted-foreground border-dashed border-border'
                        } ${isToday ? 'ring-2 ring-orange-500' : ''} disabled:opacity-60`}
                      >
                        {d}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {format(date, 'EEE d MMM')} · {working ? 'working' : type === 'off' ? 'not working' : 'not marked'} — tap to change
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground whitespace-nowrap">
              {Object.values(data.workDays).filter((t) => t && t !== 'off').length} day
              {Object.values(data.workDays).filter((t) => t && t !== 'off').length === 1 ? '' : 's'} marked
            </div>
          </Cell>

          <Cell
            icon={<Coffee className="h-4 w-4 text-sky-600" />}
            iconClass="bg-sky-100"
            label="My break"
            help="One tap to go on break and one to come back. Your average break length today is worked out from your own logged breaks."
          >
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${onBreak ? 'text-amber-600' : 'text-emerald-600'}`}>
                {onBreak ? 'On break' : 'On duty'}
              </span>
              <Button size="sm" variant={onBreak ? 'default' : 'outline'} className="h-6 gap-1 px-2 text-[11px]" disabled={saving} onClick={toggleBreak}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : onBreak ? <Play className="h-3 w-3" /> : <Coffee className="h-3 w-3" />}
                {onBreak ? 'On duty' : 'On break'}
              </Button>

            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground whitespace-nowrap">
              {data.breakSessionsToday > 0
                ? `${Math.round(data.breakMinutesToday / data.breakSessionsToday)} min average · ${data.breakSessionsToday} today`
                : 'No breaks logged today'}
            </div>
          </Cell>

          <Cell
            icon={<ShieldAlert className={`h-4 w-4 ${frozen ? 'text-red-600' : atRisk ? 'text-amber-600' : 'text-purple-600'}`} />}
            iconClass={frozen ? 'bg-red-100' : atRisk ? 'bg-amber-100' : 'bg-purple-100'}
            label="My lead access"
            help={
              <div className="space-y-2">
                <p className="font-semibold">Lead access</p>
                <p>
                  Lead access is managed by hand. Nothing pauses your leads automatically — only a manager can pause or
                  resume new leads from the lead allocation section.
                </p>
                <p className="text-muted-foreground">
                  The sales-day counter below is for information only and never affects allocation.
                </p>
              </div>
            }
          >
            <div className={`text-sm font-semibold whitespace-nowrap ${frozen ? 'text-red-600' : atRisk ? 'text-amber-600' : 'text-emerald-600'}`}>
              {frozen ? 'Leads paused' : atRisk ? 'At risk' : 'Receiving leads'}
            </div>
            <div className="text-[11px] text-muted-foreground max-w-[240px] leading-tight">
              {frozen ? (
                <>
                  {data.freezeReason || 'A manager has paused your new leads.'}
                </>
              ) : data.salesReadFailed ? (
                'Sales figures unavailable — refresh'
              ) : data.lowSaleDays === 0 ? (
                'No service days without a sale'
              ) : (
                `${data.lowSaleDays} service day${data.lowSaleDays === 1 ? '' : 's'} without a sale`
              )}
            </div>

            <div className="mt-1 rounded border border-border bg-muted/40 px-1.5 py-1 text-[11px] leading-tight">
              {data.lastSaleAt ? (
                <>
                  <div className="font-semibold whitespace-nowrap">
                    Last sale: {format(new Date(data.lastSaleAt), 'EEE d MMM yyyy, HH:mm')}
                  </div>
                  {data.lastSaleProof && (
                    <div className="text-muted-foreground truncate max-w-[220px]" title={data.lastSaleProof}>
                      {data.lastSaleProof}
                    </div>
                  )}
                </>
              ) : (
                <div className="font-semibold text-muted-foreground whitespace-nowrap">
                  {data.salesReadFailed
                    ? 'Could not read your sales — refresh the page'
                    : 'No sale recorded in the last 180 days'}
                </div>
              )}
            </div>
          </Cell>

          <Cell
            icon={<Star className="h-4 w-4 text-emerald-700" />}
            iconClass="bg-emerald-100"
            label="My reviews · this week"
            help="Target: minimum 10 named reviews a month. These are not pulled from Trustpilot and they are not the marketing review emails. Add a review only when you personally asked the customer on a call, WhatsApp or email and they name you in it. £5 per named positive review, £10 per negative review you get resolved and removed."
          >
            <div className="flex items-baseline gap-3 whitespace-nowrap">
              <span className="text-sm">
                <span className="font-semibold text-emerald-600">{data.positives}</span> positive
              </span>
              <span className="text-sm">
                <span className="font-semibold text-orange-600">{data.negatives}</span> removed
              </span>
              <span className="text-sm font-semibold">{gbp(bonus)} bonus</span>
            </div>
            <div className="mt-1 flex items-center gap-2 whitespace-nowrap">
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                  monthReviewsTotal >= REVIEW_MONTH_TARGET
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {monthReviewsTotal}/{REVIEW_MONTH_TARGET} this month
              </span>
              <span className="text-[11px] text-muted-foreground">
                {monthReviewsTotal >= REVIEW_MONTH_TARGET
                  ? 'Monthly minimum met'
                  : `${REVIEW_MONTH_TARGET - monthReviewsTotal} more to hit the 10 a month minimum`}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full ${monthReviewsTotal >= REVIEW_MONTH_TARGET ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, Math.round((monthReviewsTotal / REVIEW_MONTH_TARGET) * 100))}%` }}
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="mt-1 h-6 gap-1 px-2 text-[11px]">
                  <Plus className="h-3 w-3" /> Add a review
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 space-y-3 text-xs">
                <div className="font-semibold text-sm">Log a review you asked for</div>
                <div className="rounded-md border-2 border-emerald-500 bg-emerald-50 px-2 py-1 text-[11px] font-bold leading-snug text-emerald-900">
                  Only add reviews where the customer names you following a call, WhatsApp or personal email. Nothing here
                  comes from Trustpilot automatic emails.
                </div>

                <div className="space-y-1">
                  <label className="font-medium" htmlFor="review-customer-name">
                    Find the customer — name or reg plate <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="review-customer-name"
                    value={reviewName}
                    onChange={(e) => {
                      setReviewName(e.target.value);
                      setPicked(null);
                      searchCustomers(e.target.value);
                    }}
                    placeholder="e.g. Tim Hubbard or YN73WZH"
                    className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
                  />
                  {searching && <p className="text-[10px] text-muted-foreground">Searching…</p>}
                  {picked ? (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1">
                      <span className="truncate font-semibold text-emerald-900">
                        {picked.name || 'Unnamed'}
                        {picked.registration_plate ? ` · ${picked.registration_plate}` : ''}
                      </span>
                      <button
                        type="button"
                        className="text-[10px] underline text-emerald-800"
                        onClick={() => {
                          setPicked(null);
                          setReviewName('');
                        }}
                      >
                        change
                      </button>
                    </div>
                  ) : results.length > 0 ? (
                    <div className="max-h-32 overflow-y-auto rounded-md border">
                      {results.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className="block w-full px-2 py-1 text-left hover:bg-muted"
                          onClick={() => {
                            setPicked(r);
                            setReviewName(r.name || '');
                            setResults([]);
                          }}
                        >
                          <span className="font-medium">{r.name || 'Unnamed'}</span>
                          {r.registration_plate ? (
                            <span className="ml-1 text-muted-foreground">· {r.registration_plate}</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex gap-1 pt-1">
                    {['call', 'whatsapp', 'email'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setReviewChannel(c)}
                        className={`rounded-full border px-2 py-0.5 text-[10px] capitalize ${
                          reviewChannel === c ? 'border-primary bg-primary/10 font-semibold' : 'border-border text-muted-foreground'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    The customer record is marked as reviewed in Customer management, and managers check the named review
                    on Trustpilot before it is paid.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span>Positive review (£5)</span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" className="h-6 w-6 p-0" disabled={saving} onClick={() => removeLastReview('positive')}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center font-semibold">{data.positives}</span>
                      <Button size="sm" className="h-6 w-6 p-0" disabled={saving} onClick={() => logReview('positive')}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>Negative review removed (£10)</span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" className="h-6 w-6 p-0" disabled={saving} onClick={() => removeLastReview('negative_removed')}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-5 text-center font-semibold">{data.negatives}</span>
                      <Button size="sm" className="h-6 w-6 p-0" disabled={saving} onClick={() => logReview('negative_removed')}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Checked at the end of each week and paid with your normal commission run.
                </p>
              </PopoverContent>
            </Popover>
          </Cell>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ProgressOverviewStrip;
