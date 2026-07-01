import React from 'react';
import { PoundSterling, Timer, CalendarDays } from 'lucide-react';

interface PerformanceKpiStripProps {
  avgPayout: number;
  avgResolutionDays: number;
  avgClaimsPerMonth: number;
}

interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  /** brand-aligned accent: 'orange' | 'blue' | 'slate' */
  accent: 'orange' | 'blue' | 'slate';
}

const ACCENT: Record<KpiProps['accent'], { bar: string; iconBg: string; iconFg: string }> = {
  orange: { bar: 'bg-orange-500', iconBg: 'bg-orange-100', iconFg: 'text-orange-600' },
  blue:   { bar: 'bg-blue-600',   iconBg: 'bg-blue-100',   iconFg: 'text-blue-700'  },
  slate:  { bar: 'bg-slate-700',  iconBg: 'bg-slate-200',  iconFg: 'text-slate-800' },
};

const PerfCard: React.FC<KpiProps> = ({ label, value, sub, icon, accent }) => {
  const a = ACCENT[accent];
  return (
    <div className="relative bg-card border border-border rounded-lg overflow-hidden shadow-sm">
      <div className={`h-[3px] w-full ${a.bar}`} />
      <div className="p-4 flex items-start gap-3">
        <div className={`shrink-0 w-10 h-10 rounded-md ${a.iconBg} ${a.iconFg} flex items-center justify-center`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">{label}</div>
          <div className="mt-1 text-2xl font-bold leading-none text-slate-900">{value}</div>
          {sub && <div className="mt-1 text-xs text-slate-600">{sub}</div>}
        </div>
      </div>
    </div>
  );
};

export const PerformanceKpiStrip: React.FC<PerformanceKpiStripProps> = ({
  avgPayout,
  avgResolutionDays,
  avgClaimsPerMonth,
}) => {
  const payoutLabel = avgPayout > 0 ? `£${avgPayout.toLocaleString()}` : '—';
  const resolutionLabel = avgResolutionDays > 0 ? `${avgResolutionDays} days` : '—';
  const perMonthLabel = avgClaimsPerMonth > 0 ? `${avgClaimsPerMonth}` : '—';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <PerfCard
        label="Average payout"
        value={payoutLabel}
        sub="Per settled claim"
        icon={<PoundSterling className="h-5 w-5" />}
        accent="orange"
      />
      <PerfCard
        label="Average resolution"
        value={resolutionLabel}
        sub="Submission → decision"
        icon={<Timer className="h-5 w-5" />}
        accent="blue"
      />
      <PerfCard
        label="Claims per month"
        value={perMonthLabel}
        sub="Rolling average"
        icon={<CalendarDays className="h-5 w-5" />}
        accent="slate"
      />
    </div>
  );
};
