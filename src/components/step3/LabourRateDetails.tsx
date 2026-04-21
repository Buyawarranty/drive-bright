import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Info,
  CheckCircle2,
  Wrench,
  ListChecks,
  Clock,
  ChevronRight,
} from 'lucide-react';

interface LabourRateDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLabourRate: number;
  onConfirm: (rate: number) => void;
}

interface RateOption {
  rate: number;
  name: string;
  description: string;
  badge: string;
  badgeClass: string;
  pct: number;
  coverageLabel: string;
  note: React.ReactNode;
  example: React.ReactNode;
}

const RATES: RateOption[] = [
  {
    rate: 50,
    name: 'Local Garages',
    description: 'Smaller local garages & budget-friendly repairs',
    badge: 'Great value',
    badgeClass: 'bg-success/10 text-success border-success/30',
    pct: 40,
    coverageLabel: 'Local & budget garages',
    note: (
      <>
        Perfect if you use a local mechanic or smaller garage.{' '}
        <strong className="text-foreground">
          Most routine repairs — brake pads, sensors, exhausts — are carried out at this rate.
        </strong>
      </>
    ),
    example: (
      <>
        Your alternator needs replacing. The job takes 2 hours. At £50/hr that's{' '}
        <strong className="text-foreground">£100 in labour</strong> — we pay that directly to your
        garage, plus the cost of the part. Total out of pocket: your excess only.
      </>
    ),
  },
  {
    rate: 70,
    name: 'Independent Garages',
    description: 'Covers most trusted local & independent garages',
    badge: 'Most popular',
    badgeClass: 'bg-primary text-primary-foreground border-primary',
    pct: 68,
    coverageLabel: 'Independent & local garages',
    note: (
      <>
        The most popular choice.{' '}
        <strong className="text-foreground">
          Covers the majority of trusted independent garages across the UK
        </strong>{' '}
        — the kind of place most people use week to week.
      </>
    ),
    example: (
      <>
        Your clutch needs replacing. The job takes 4 hours. At £70/hr that's{' '}
        <strong className="text-foreground">£280 in labour</strong> — we pay that straight to the
        garage, plus parts. You only pay your excess.
      </>
    ),
  },
  {
    rate: 100,
    name: 'Approved Garages',
    description: 'All independents plus approved national networks',
    badge: 'Wider choice',
    badgeClass: 'bg-success/10 text-success border-success/30',
    pct: 91,
    coverageLabel: 'Independent, approved & national chains',
    note: (
      <>
        Covers nearly every independent plus national chains like Halfords Autocentre and Kwik
        Fit.{' '}
        <strong className="text-foreground">
          Ideal if you prefer a well-known name or nationwide network.
        </strong>
      </>
    ),
    example: (
      <>
        Your gearbox needs a repair. The job takes 5 hours. At £100/hr that's{' '}
        <strong className="text-foreground">£500 in labour</strong> — we pay the garage directly,
        plus the parts cost. You pay your excess only.
      </>
    ),
  },
  {
    rate: 200,
    name: 'Expert Garages',
    description: 'Main dealers, EV specialists & prestige brands',
    badge: 'Specialists',
    badgeClass: 'bg-muted text-muted-foreground border-border',
    pct: 99,
    coverageLabel: 'All garages including main dealers',
    note: (
      <>
        Covers main dealers and EV specialists.{' '}
        <strong className="text-foreground">
          Best suited to prestige vehicles, hybrids or electric cars where dealer servicing is
          required.
        </strong>
      </>
    ),
    example: (
      <>
        Your BMW needs a diagnostic and repair at the main dealer. At £200/hr for 3 hours that's{' '}
        <strong className="text-foreground">£600 in labour</strong> — we settle it directly. You
        pay your excess only.
      </>
    ),
  },
];

const LabourRateDetails: React.FC<LabourRateDetailsProps> = ({
  open,
  onOpenChange,
  selectedLabourRate,
  onConfirm,
}) => {
  const [pending, setPending] = useState<number>(selectedLabourRate || 70);

  useEffect(() => {
    if (open) setPending(selectedLabourRate || 70);
  }, [open, selectedLabourRate]);

  const current = RATES.find((r) => r.rate === pending) ?? RATES[1];

  const handleConfirm = () => {
    onConfirm(pending);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-1rem)] sm:w-full p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col rounded-2xl">
        {/* Scrollable content */}
        <div className="overflow-y-auto px-4 sm:px-8 pt-7 sm:pt-8 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Info className="w-5 h-5 text-primary" />
            <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
              Understanding your labour rate
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm sm:text-[15px] text-muted-foreground mt-1 mb-4 pl-7">
            The hourly rate we use to pay your garage directly. Choose the rate that matches where
            you'd normally get your car fixed.
          </DialogDescription>

          {/* Insight banner */}
          <div className="flex gap-3 rounded-xl border-l-4 border-primary bg-primary/5 px-4 py-3 mb-5">
            <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-sm text-foreground leading-snug">
              <strong>Most independent garages charge £50–£100/hr.</strong> If you use a local or
              trusted garage, these two options cover the majority of repairs with no shortfall.
            </p>
          </div>

          <h3 className="font-bold text-foreground text-sm sm:text-base mb-3">
            Choose your labour rate
          </h3>

          {/* Rate options grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-6">
            {RATES.map((opt) => {
              const isSelected = pending === opt.rate;
              return (
                <button
                  key={opt.rate}
                  type="button"
                  onClick={() => setPending(opt.rate)}
                  className={cn(
                    'relative rounded-xl border-2 bg-card p-3 sm:p-4 pt-5 text-center transition-all',
                    isSelected
                      ? 'border-success bg-success/5 shadow-sm'
                      : 'border-border hover:border-success/40'
                  )}
                  aria-pressed={isSelected}
                >
                  <span
                    className={cn(
                      'absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border whitespace-nowrap',
                      opt.badgeClass
                    )}
                  >
                    {opt.badge}
                  </span>

                  {/* Radio */}
                  <div
                    className={cn(
                      'absolute top-2 right-2 w-4 h-4 rounded-full border-2 flex items-center justify-center',
                      isSelected ? 'border-success' : 'border-muted-foreground/40'
                    )}
                  >
                    {isSelected && <div className="w-2 h-2 rounded-full bg-success" />}
                  </div>

                  <div
                    className={cn(
                      'font-bold text-2xl leading-none',
                      isSelected ? 'text-success' : 'text-foreground'
                    )}
                  >
                    £{opt.rate}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">per hour</div>
                  <div className="text-[13px] font-semibold text-foreground mt-1.5">
                    {opt.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 leading-tight">
                    {opt.description}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Garage coverage bar */}
          <h4 className="font-bold text-foreground text-sm sm:text-base mb-2">
            Garages included at this rate
          </h4>
          <div className="mb-5">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>{current.coverageLabel}</span>
              <span className="font-bold text-success">{current.pct}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-success transition-all duration-500"
                style={{ width: `${current.pct}%` }}
              />
            </div>
            <p className="text-xs sm:text-[13px] text-muted-foreground mt-2 leading-snug">
              {current.note}
            </p>
          </div>

          {/* Real example */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 sm:p-4 mb-5">
            <div className="text-[10px] font-bold uppercase tracking-wide text-primary mb-1">
              Real example
            </div>
            <p className="text-sm text-foreground leading-relaxed">{current.example}</p>
          </div>

          {/* How it works */}
          <div className="rounded-xl border border-border bg-muted/30 p-3 sm:p-4 mb-5">
            {[
              {
                Icon: CheckCircle2,
                title: 'We pay your garage directly at this rate',
                sub: 'No cash needed upfront — we settle labour costs straight with the garage',
              },
              {
                Icon: ListChecks,
                title: 'Parts are covered on top',
                sub: 'Labour rate covers the work — parts are included separately up to your claim limit',
              },
              {
                Icon: Clock,
                title: 'You can upgrade before a claim',
                sub: 'If you switch garages, simply update your rate first — no penalty',
              },
            ].map((row, i, arr) => (
              <div
                key={row.title}
                className={cn(
                  'flex items-start gap-3 py-2',
                  i < arr.length - 1 && 'border-b border-border/60'
                )}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-success/10 border border-success/20 flex items-center justify-center">
                  <row.Icon className="w-4 h-4 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] sm:text-sm font-semibold text-foreground">
                    {row.title}
                  </div>
                  <div className="text-xs text-muted-foreground leading-snug">{row.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Trust strip */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 rounded-xl border border-border bg-card p-3">
            {[
              { title: 'We pay directly', sub: 'No cash upfront needed' },
              { title: 'Parts included', sub: 'Labour + parts, always' },
              { title: 'Change anytime', sub: 'Upgrade before a claim' },
            ].map((t) => (
              <div key={t.title} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                <div className="leading-tight">
                  <div className="text-[12px] sm:text-[13px] font-semibold text-foreground">
                    {t.title}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{t.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sticky footer CTA */}
        <div className="border-t border-border bg-background px-4 sm:px-8 py-4 flex-shrink-0">
          <button
            onClick={handleConfirm}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-success text-success-foreground font-bold text-base sm:text-lg px-5 py-3.5 sm:py-4 shadow-md hover:bg-success/90 transition-colors active:scale-[0.99]"
          >
            Confirm £{current.rate}/hr — {current.name}
            <ChevronRight className="w-5 h-5" />
          </button>
          <p className="text-center text-xs text-muted-foreground mt-2">
            You can change this anytime before making a claim.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LabourRateDetails;
