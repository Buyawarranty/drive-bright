import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, X } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

export type DateScope = 'signup' | 'payment' | 'deals' | 'revenue';
export type PeriodKey =
  | 'all' | 'today' | 'yesterday'
  | '7days' | '14days' | '30days' | '60days'
  | 'this_month' | 'last_month' | 'custom';

const PERIOD_LABEL: Record<PeriodKey, string> = {
  all: 'All time',
  today: 'Today',
  yesterday: 'Yesterday',
  '7days': 'Last 7 days',
  '14days': 'Last 14 days',
  '30days': 'Last 30 days',
  '60days': 'Last 60 days',
  this_month: 'This month',
  last_month: 'Last month',
  custom: 'Custom range',
};

const SCOPE_LABEL: Record<DateScope, string> = {
  signup: 'Signup date',
  payment: 'Payment received',
  deals: 'Sales / Deals',
  revenue: 'Revenue',
};

export function periodToRange(key: PeriodKey): DateRange | undefined {
  const today = new Date();
  switch (key) {
    case 'all':
    case 'custom':
      return undefined;
    case 'today': return { from: today, to: today };
    case 'yesterday': { const d = subDays(today, 1); return { from: d, to: d }; }
    case '7days': return { from: subDays(today, 6), to: today };
    case '14days': return { from: subDays(today, 13), to: today };
    case '30days': return { from: subDays(today, 29), to: today };
    case '60days': return { from: subDays(today, 59), to: today };
    case 'this_month': return { from: startOfMonth(today), to: today };
    case 'last_month': { const lm = subMonths(today, 1); return { from: startOfMonth(lm), to: endOfMonth(lm) }; }
  }
}

interface UnifiedDateFilterProps {
  scope: DateScope;
  period: PeriodKey;
  customRange: DateRange | undefined;
  onChange: (next: { scope: DateScope; period: PeriodKey; customRange: DateRange | undefined }) => void;
  availableScopes: DateScope[];
  className?: string;
}

export const UnifiedDateFilter: React.FC<UnifiedDateFilterProps> = ({
  scope, period, customRange, onChange, availableScopes, className,
}) => {
  const [open, setOpen] = useState(false);

  const isActive = period !== 'all' || (period === 'custom' && !!customRange?.from);

  const buttonLabel = useMemo(() => {
    if (!isActive) return 'Date filter: Off';
    let periodText = PERIOD_LABEL[period];
    if (period === 'custom' && customRange?.from) {
      periodText = customRange.to && format(customRange.from, 'yyyy-MM-dd') !== format(customRange.to, 'yyyy-MM-dd')
        ? `${format(customRange.from, 'd MMM')} – ${format(customRange.to, 'd MMM yyyy')}`
        : format(customRange.from, 'd MMM yyyy');
    }
    return `${SCOPE_LABEL[scope]}: ${periodText}`;
  }, [scope, period, customRange, isActive]);

  const presets: PeriodKey[] = ['all', 'today', 'yesterday', '7days', '14days', '30days', '60days', 'this_month', 'last_month'];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isActive ? 'default' : 'outline'}
          className={cn('h-9 justify-between gap-2 min-w-[240px]', className)}
        >
          <span className="flex items-center gap-2 truncate">
            <CalendarIcon className="h-4 w-4 shrink-0" />
            <span className="truncate text-sm">{buttonLabel}</span>
          </span>
          {isActive && (
            <X
              className="h-3.5 w-3.5 opacity-70 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ scope, period: 'all', customRange: undefined });
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-4 space-y-4 z-50" align="start">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            1. Filter by
          </label>
          <Select
            value={scope}
            onValueChange={(v) => onChange({ scope: v as DateScope, period, customRange })}
          >
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableScopes.map((s) => (
                <SelectItem key={s} value={s}>{SCOPE_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Choose which data the date filter applies to.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            2. Period
          </label>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <Button
                key={p}
                size="sm"
                variant={period === p ? 'default' : 'outline'}
                className="h-8 text-xs"
                onClick={() => onChange({ scope, period: p, customRange: undefined })}
              >
                {PERIOD_LABEL[p]}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Or pick a custom range
          </label>
          <Calendar
            mode="range"
            selected={customRange}
            onSelect={(r) => onChange({ scope, period: 'custom', customRange: r })}
            numberOfMonths={1}
            className="pointer-events-auto"
            disabled={(d) => d > new Date()}
          />
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button size="sm" onClick={() => setOpen(false)}>Done</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
