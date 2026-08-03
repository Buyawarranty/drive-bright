import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format, subDays, startOfMonth, endOfMonth, subMonths, addDays,
  startOfWeek, endOfWeek, isValid, parse, isSameDay, differenceInCalendarDays,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

export type DateScope = 'signup' | 'payment' | 'deals' | 'revenue' | 'claim_opened' | 'renewal_due';
export type PeriodKey =
  | 'all' | 'today' | 'yesterday'
  | 'this_week' | '7days' | 'last_week'
  | '14days' | 'this_month' | '30days' | 'last_month'
  | 'custom';

const SCOPE_LABEL: Record<DateScope, string> = {
  signup: 'Signup date',
  payment: 'Payment received',
  deals: 'Sales / Deals',
  revenue: 'Revenue',
  claim_opened: 'Claim opened',
  renewal_due: 'Renewal due',
};

const PRESETS: { key: PeriodKey; label: string }[] = [
  { key: 'custom', label: 'Custom' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This week (Sun – Today)' },
  { key: '7days', label: 'Last 7 days' },
  { key: 'last_week', label: 'Last week (Sun – Sat)' },
  { key: '14days', label: 'Last 14 days' },
  { key: 'this_month', label: 'This month' },
  { key: '30days', label: 'Last 30 days' },
  { key: 'last_month', label: 'Last month' },
  { key: 'all', label: 'All time' },
];

export function periodToRange(key: PeriodKey): DateRange | undefined {
  const today = new Date();
  switch (key) {
    case 'all':
    case 'custom':
      return undefined;
    case 'today': return { from: today, to: today };
    case 'yesterday': { const d = subDays(today, 1); return { from: d, to: d }; }
    case 'this_week': return { from: startOfWeek(today, { weekStartsOn: 0 }), to: today };
    case '7days': return { from: subDays(today, 6), to: today };
    case 'last_week': {
      const lastWeekDay = subDays(today, 7);
      return { from: startOfWeek(lastWeekDay, { weekStartsOn: 0 }), to: endOfWeek(lastWeekDay, { weekStartsOn: 0 }) };
    }
    case '14days': return { from: subDays(today, 13), to: today };
    case 'this_month': return { from: startOfMonth(today), to: today };
    case '30days': return { from: subDays(today, 29), to: today };
    case 'last_month': { const lm = subMonths(today, 1); return { from: startOfMonth(lm), to: endOfMonth(lm) }; }
  }
}

function detectPreset(range: DateRange | undefined): PeriodKey {
  if (!range?.from) return 'all';
  for (const p of PRESETS) {
    if (p.key === 'all' || p.key === 'custom') continue;
    const r = periodToRange(p.key);
    if (r?.from && r?.to && range.to &&
      isSameDay(r.from, range.from) && isSameDay(r.to, range.to)) {
      return p.key;
    }
  }
  return 'custom';
}

interface UnifiedDateFilterProps {
  scope: DateScope;
  period: PeriodKey;
  customRange: DateRange | undefined;
  onChange: (next: { scope: DateScope; period: PeriodKey; customRange: DateRange | undefined }) => void;
  availableScopes: DateScope[];
  className?: string;
  showLabel?: boolean;
  hideQuickLinks?: boolean;
}

function fmtInput(d: Date | undefined): string {
  return d && isValid(d) ? format(d, 'M/d/yyyy') : '';
}

function tryParseInput(raw: string): Date | null {
  const cleaned = raw.trim().replace(/[.\-\s]/g, '/');
  for (const fmt of ['M/d/yyyy', 'MM/dd/yyyy', 'd/M/yyyy', 'yyyy-MM-dd']) {
    const p = parse(cleaned, fmt, new Date());
    if (isValid(p)) return p;
  }
  return null;
}

export const UnifiedDateFilter: React.FC<UnifiedDateFilterProps> = ({
  scope, period, customRange, onChange, availableScopes, className, showLabel = true, hideQuickLinks = false,
}) => {
  const [open, setOpen] = useState(false);

  // The actual active range derived from period
  const activeRange = useMemo<DateRange | undefined>(() => {
    if (period === 'custom') return customRange;
    return periodToRange(period);
  }, [period, customRange]);

  // Local draft inside popover (only committed on Apply)
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(activeRange);
  const [draftScope, setDraftScope] = useState<DateScope>(scope);
  const [startText, setStartText] = useState(fmtInput(activeRange?.from));
  const [endText, setEndText] = useState(fmtInput(activeRange?.to));

  // Seed the draft ONLY when the popover opens. Parents often rebuild the
  // customRange object on every render (busy dashboards re-render constantly),
  // so reacting to activeRange here would wipe the user's in-progress
  // start/end selection before they can press Apply.
  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraftRange(activeRange);
      setDraftScope(scope);
      setStartText(fmtInput(activeRange?.from));
      setEndText(fmtInput(activeRange?.to));
    }
    wasOpenRef.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const draftPreset = detectPreset(draftRange);

  const handlePreset = (key: PeriodKey) => {
    if (key === 'all') { setDraftRange(undefined); setStartText(''); setEndText(''); return; }
    if (key === 'custom') return;
    const r = periodToRange(key);
    setDraftRange(r);
    setStartText(fmtInput(r?.from));
    setEndText(fmtInput(r?.to));
  };

  const handleCalendarSelect = (r: DateRange | undefined) => {
    setDraftRange(r);
    setStartText(fmtInput(r?.from));
    setEndText(fmtInput(r?.to));
  };

  const commitStart = () => {
    const d = tryParseInput(startText);
    if (d) {
      const to = draftRange?.to && draftRange.to >= d ? draftRange.to : d;
      setDraftRange({ from: d, to });
      setEndText(fmtInput(to));
    } else {
      setStartText(fmtInput(draftRange?.from));
    }
  };
  const commitEnd = () => {
    const d = tryParseInput(endText);
    if (d && draftRange?.from) {
      setDraftRange({ from: draftRange.from, to: d });
    } else if (!d) {
      setEndText(fmtInput(draftRange?.to));
    }
  };

  const apply = () => {
    if (!draftRange?.from) {
      onChange({ scope: draftScope, period: 'all', customRange: undefined });
    } else {
      const preset = detectPreset(draftRange);
      onChange({
        scope: draftScope,
        period: preset,
        customRange: preset === 'custom' ? draftRange : undefined,
      });
    }
    setOpen(false);
  };

  const cancel = () => setOpen(false);

  // Trigger button label (Google style: "<Period name> | <date range> ▼")
  const triggerLabel = useMemo(() => {
    const preset = detectPreset(activeRange);
    const presetLabel = PRESETS.find(p => p.key === preset)?.label ?? 'Custom';
    if (!activeRange?.from) return { name: presetLabel, range: 'All time' };
    const range = activeRange.to && !isSameDay(activeRange.from, activeRange.to)
      ? `${format(activeRange.from, 'MMM d')} – ${format(activeRange.to, 'MMM d, yyyy')}`
      : format(activeRange.from, 'MMM d, yyyy');
    return { name: presetLabel.replace(/\s*\(.+\)/, ''), range };
  }, [activeRange]);

  // Step navigation (◀ ▶) — shifts the active range by its length, like Google
  const shiftRange = (direction: -1 | 1) => {
    if (!activeRange?.from || !activeRange.to) return;
    const days = differenceInCalendarDays(activeRange.to, activeRange.from) + 1;
    const newFrom = addDays(activeRange.from, direction * days);
    const newTo = addDays(activeRange.to, direction * days);
    onChange({ scope, period: 'custom', customRange: { from: newFrom, to: newTo } });
  };

  const showLast30 = period !== '30days';
  const showToday = period !== 'today';
  const showYesterday = period !== 'yesterday';
  const showThisMonth = period !== 'this_month';
  const showLastMonth = period !== 'last_month';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && (
        <span className="text-sm text-muted-foreground hidden md:inline">{SCOPE_LABEL[scope]}:</span>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="h-9 gap-2 px-3 font-normal border-input min-w-[220px] justify-between"
          >
            <span className="flex items-center gap-2 text-sm">
              <span className="font-medium">{triggerLabel.name}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{triggerLabel.range}</span>
            </span>
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>

        {/* Step backward / forward */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!activeRange?.from}
          onClick={() => shiftRange(-1)}
          aria-label="Previous period"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!activeRange?.from}
          onClick={() => shiftRange(1)}
          aria-label="Next period"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {!hideQuickLinks && showToday && (
          <button
            type="button"
            onClick={() => onChange({ scope, period: 'today', customRange: undefined })}
            className="text-sm text-primary hover:underline"
          >
            Today
          </button>
        )}
        {!hideQuickLinks && showYesterday && (
          <button
            type="button"
            onClick={() => onChange({ scope, period: 'yesterday', customRange: undefined })}
            className="text-sm text-primary hover:underline"
          >
            Yesterday
          </button>
        )}
        {!hideQuickLinks && showThisMonth && (
          <button
            type="button"
            onClick={() => onChange({ scope, period: 'this_month', customRange: undefined })}
            className="text-sm text-primary hover:underline"
          >
            This month
          </button>
        )}
        {!hideQuickLinks && showLastMonth && (
          <button
            type="button"
            onClick={() => onChange({ scope, period: 'last_month', customRange: undefined })}
            className="text-sm text-primary hover:underline"
          >
            Last month
          </button>
        )}
        {!hideQuickLinks && showLast30 && (
          <button
            type="button"
            onClick={() => onChange({ scope, period: '30days', customRange: undefined })}
            className="text-sm text-primary hover:underline"
          >
            Show last 30 days
          </button>
        )}

        <PopoverContent className="p-0 w-[560px] max-w-[calc(100vw-2rem)] z-50 overflow-hidden" align="end" sideOffset={6} collisionPadding={16}>
          <div className="flex">
            {/* Left: presets */}
            <div className="w-[180px] shrink-0 border-r bg-muted/30 max-h-[440px] overflow-y-auto py-1">
              {PRESETS.map((p) => {
                const active = p.key === draftPreset || (p.key === 'custom' && draftPreset === 'custom');
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handlePreset(p.key)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors',
                      active && 'bg-primary/10 text-primary font-medium',
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Right: scope + date inputs + calendar */}
            <div className="flex-1 min-w-0 p-3 space-y-3">
              {availableScopes.length > 1 && (
                <div>
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Filter applies to
                  </label>
                  <Select value={draftScope} onValueChange={(v) => setDraftScope(v as DateScope)}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableScopes.map((s) => (
                        <SelectItem key={s} value={s}>{SCOPE_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Start date
                  </label>
                  <Input
                    value={startText}
                    onChange={(e) => setStartText(e.target.value)}
                    onBlur={commitStart}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    placeholder="m/d/yyyy"
                    className="h-9 mt-1"
                  />
                </div>
                <span className="pb-2 text-muted-foreground">—</span>
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                    End date
                  </label>
                  <Input
                    value={endText}
                    onChange={(e) => setEndText(e.target.value)}
                    onBlur={commitEnd}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                    placeholder="m/d/yyyy"
                    className="h-9 mt-1"
                  />
                </div>
              </div>

              <Calendar
                mode="range"
                selected={draftRange}
                onSelect={handleCalendarSelect}
                numberOfMonths={1}
                defaultMonth={draftRange?.from ?? new Date()}
                disabled={(d) => d > new Date()}
                className="pointer-events-auto"
              />

              <div className="flex justify-end gap-2 pt-1 border-t">
                <Button variant="ghost" size="sm" onClick={cancel}>Cancel</Button>
                <Button size="sm" onClick={apply}>Apply</Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
