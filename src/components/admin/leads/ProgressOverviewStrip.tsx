import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Target, Users, Headphones, ShieldAlert, Star, Coffee, ChevronRight } from 'lucide-react';

/**
 * Design preview only — super_admin sees this. Purely presentational KPI strip
 * showing the layout we want for progress tracking (revenue first, then
 * attendance, phones, lead freeze, reviews, break time). No lead logic, no
 * writes, no API calls beyond the role check.
 */

const Card: React.FC<{
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  children: React.ReactNode;
  link?: string;
}> = ({ icon, iconClass, label, children, link }) => (
  <div className="min-w-[260px] flex-1 rounded-xl border border-border bg-card shadow-sm px-4 py-3 flex gap-3">
    <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${iconClass}`}>{icon}</div>
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      {children}
      {link && (
        <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          {link} <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  </div>
);

const ALLOWED = ['super_admin', 'admin'];

export const ProgressOverviewStrip: React.FC = () => {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      if (!uid) return;

      // Must be an active admin_users row with an allowed role AND hold that
      // role in user_roles — anything else (sales, sales_lead, managers) is hidden.
      const [{ data: adminRows }, { data: roleRows }] = await Promise.all([
        supabase.from('admin_users').select('role').eq('user_id', uid).eq('is_active', true),
        supabase.from('user_roles').select('role').eq('user_id', uid),
      ]);

      const adminRoles = (adminRows || []).map((r: any) => String(r.role));
      const userRoles = (roleRows || []).map((r: any) => String(r.role));
      const ok =
        adminRoles.some((r) => ALLOWED.includes(r)) &&
        userRoles.some((r) => ALLOWED.includes(r));

      if (mounted) setAllowed(ok);
    })();
    return () => { mounted = false; };
  }, []);

  if (!allowed) return null;

  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Progress overview</span>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          Design preview · super admin only · sample figures
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        <Card
          icon={<Target className="h-5 w-5 text-orange-600" />}
          iconClass="bg-orange-100"
          label="Team target · August"
          link="Agent breakdown"
        >
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xl font-bold">£16,249</span>
            <span className="text-xs text-muted-foreground">of £32,000 (51%)</span>
            <span className="text-xs text-muted-foreground">· £15,751 to go</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
            <div className="h-1.5 rounded-full bg-orange-500" style={{ width: '51%' }} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">£1,432 / day to hit target</div>
        </Card>

        <Card
          icon={<Users className="h-5 w-5 text-emerald-600" />}
          iconClass="bg-emerald-100"
          label="Team attendance"
          link="View attendance (6)"
        >
          <div className="text-lg font-semibold">5 of 6 working today</div>
          <div className="mt-1 flex gap-1">
            {days.map((d, i) => (
              <span
                key={i}
                className={`h-6 w-6 rounded-full text-[11px] font-semibold flex items-center justify-center ${
                  i < 5 ? 'bg-emerald-600 text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {d}
              </span>
            ))}
          </div>
        </Card>

        <Card
          icon={<Headphones className="h-5 w-5 text-indigo-600" />}
          iconClass="bg-indigo-100"
          label="On phones"
          link="View team"
        >
          <div className="text-lg font-semibold">
            5 <span className="text-emerald-600">Available</span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            <span className="text-amber-600">1</span> Away · 5 On phones
          </div>
        </Card>

        <Card
          icon={<ShieldAlert className="h-5 w-5 text-purple-600" />}
          iconClass="bg-purple-100"
          label="Lead access (assessment)"
          link="View lead rules"
        >
          <div className="text-lg font-semibold">4 Receiving leads</div>
          <div className="mt-1 flex gap-1.5 flex-wrap text-[11px]">
            <span className="rounded-md border border-amber-300 px-1.5 py-0.5 text-amber-700">1 At risk</span>
            <span className="rounded-md border border-destructive/40 px-1.5 py-0.5 text-destructive">1 Frozen</span>
            <span className="rounded-md border border-border px-1.5 py-0.5 text-primary">1 Review</span>
          </div>
        </Card>

        <Card
          icon={<Coffee className="h-5 w-5 text-sky-600" />}
          iconClass="bg-sky-100"
          label="Break time today"
          link="View break log"
        >
          <div className="text-lg font-semibold">42 min avg</div>
          <div className="mt-0.5 text-xs text-muted-foreground">2 on break now · 1 over allowance</div>
        </Card>

        <Card
          icon={<Star className="h-5 w-5 text-emerald-700" />}
          iconClass="bg-emerald-100"
          label="Trustpilot reviews this week"
          link="View review leaderboard"
        >
          <div className="text-sm">
            <span className="font-semibold text-emerald-600">24</span> positive reviews
          </div>
          <div className="text-sm">
            <span className="font-semibold text-orange-600">3</span> negative reviews removed
          </div>
          <div className="mt-1 text-sm font-semibold">£150 review bonus potential</div>
          <div className="text-[11px] text-muted-foreground">£5 per positive review · £10 per negative removal</div>
        </Card>
      </div>
    </div>
  );
};

export default ProgressOverviewStrip;
