import React, { useState } from 'react';
import { Target, Headphones, ShieldAlert, Star, Coffee, CalendarDays, ChevronRight, Info } from 'lucide-react';

/**
 * Per-agent progress strip — every sales agent sees their OWN figures.
 * Purely presentational layout (no lead logic, no writes). One single line,
 * horizontally scrollable on narrow screens.
 */

const Cell: React.FC<{
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  children: React.ReactNode;
  link?: string;
  className?: string;
}> = ({ icon, iconClass, label, children, link, className }) => (
  <div className={`shrink-0 px-4 py-2.5 flex gap-2.5 items-start ${className || ''}`}>
    <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${iconClass}`}>{icon}</div>
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
      {link && (
        <button type="button" className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
          {link} <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  </div>
);

const Divider = () => <div className="shrink-0 w-px self-stretch bg-border" />;

export const ProgressOverviewStrip: React.FC = () => {
  const [showReviewInfo, setShowReviewInfo] = useState(false);
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">My progress today</span>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          Your own figures · sample layout
        </span>
      </div>

      <div className="flex items-stretch overflow-x-auto rounded-xl border border-border bg-card shadow-sm divide-x divide-border">
        <Cell
          icon={<Target className="h-4 w-4 text-orange-600" />}
          iconClass="bg-orange-100"
          label="My target · August"
        >
          <div className="flex items-baseline gap-2 whitespace-nowrap">
            <span className="text-lg font-bold">£16,249</span>
            <span className="text-xs text-muted-foreground">of £32,000 · 51%</span>
          </div>
          <div className="mt-1 h-1.5 w-40 rounded-full bg-muted">
            <div className="h-1.5 rounded-full bg-orange-500" style={{ width: '51%' }} />
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground whitespace-nowrap">£1,432 a day to hit target</div>
        </Cell>

        <Cell
          icon={<CalendarDays className="h-4 w-4 text-emerald-600" />}
          iconClass="bg-emerald-100"
          label="My attendance · this week"
        >
          <div className="mt-0.5 flex gap-1">
            {days.map((d, i) => (
              <span
                key={i}
                className={`h-6 w-6 rounded-md text-[11px] font-semibold flex items-center justify-center ${
                  i < 5
                    ? 'bg-emerald-600 text-primary-foreground'
                    : i === 5
                      ? 'bg-emerald-600/60 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                } ${i === 3 ? 'ring-2 ring-orange-500' : ''}`}
              >
                {d}
              </span>
            ))}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground whitespace-nowrap">5 full days · Sat half day</div>
        </Cell>

        <Cell
          icon={<Headphones className="h-4 w-4 text-indigo-600" />}
          iconClass="bg-indigo-100"
          label="My phone status"
        >
          <div className="text-sm font-semibold text-emerald-600 whitespace-nowrap">Available</div>
          <div className="text-[11px] text-muted-foreground whitespace-nowrap">18 calls today · 12 connected</div>
        </Cell>

        <Cell
          icon={<Coffee className="h-4 w-4 text-sky-600" />}
          iconClass="bg-sky-100"
          label="My break time"
        >
          <div className="text-sm font-semibold whitespace-nowrap">42 min used</div>
          <div className="text-[11px] text-muted-foreground whitespace-nowrap">Lunch (1 hour) allowance</div>
        </Cell>

        <Cell
          icon={<ShieldAlert className="h-4 w-4 text-purple-600" />}
          iconClass="bg-purple-100"
          label="My lead access"
          link="Lead rules"
        >
          <div className="text-sm font-semibold text-emerald-600 whitespace-nowrap">Receiving leads</div>
          <div className="text-[11px] text-muted-foreground whitespace-nowrap">1 sale or fewer for 2 days pauses leads</div>
        </Cell>

        <Cell
          icon={<Star className="h-4 w-4 text-emerald-700" />}
          iconClass="bg-emerald-100"
          label="My reviews I've asked for · this week"
        >
          <div className="flex items-baseline gap-2 whitespace-nowrap">
            <span className="text-sm"><span className="font-semibold text-emerald-600">4</span> named reviews</span>
            <span className="text-sm"><span className="font-semibold text-orange-600">1</span> negative removed</span>
          </div>
          <div className="text-sm font-semibold whitespace-nowrap">£30 review bonus potential</div>
          <button
            type="button"
            onClick={() => setShowReviewInfo((v) => !v)}
            className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            <Info className="h-3 w-3" /> How this bonus works
          </button>
        </Cell>
      </div>

      {showReviewInfo && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1.5">
          <div className="font-semibold text-foreground">How the review bonus works</div>
          <p>
            These numbers are <span className="font-medium text-foreground">not</span> pulled from the Trustpilot API and they are
            not the automated review emails our marketing sends out. They only count reviews you personally asked the customer for
            &mdash; on a phone call, over WhatsApp or by email &mdash; where the customer{' '}
            <span className="font-medium text-foreground">mentions your name in the review</span>.
          </p>
          <p>
            Commission: <span className="font-medium text-foreground">£5</span> for every positive review that names you, and{' '}
            <span className="font-medium text-foreground">£10</span> for every negative review you get resolved and removed.
            A review only counts once, and only where your name is clearly in the review text so it can be verified.
          </p>
          <p>Bonuses are checked at the end of each week and paid with your normal commission run.</p>
        </div>
      )}
    </div>
  );
};

export default ProgressOverviewStrip;
