import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, X } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface DateRangeFilterProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  className?: string;
}

interface QuickFilter {
  label: string;
  key: string;
  getRange: () => DateRange | undefined;
}

const quickFilters: QuickFilter[] = [
  { label: 'All Time', key: 'all_time', getRange: () => undefined },
  { label: 'Today', key: 'today', getRange: () => { const t = new Date(); return { from: t, to: t }; } },
  { label: 'Yesterday', key: 'yesterday', getRange: () => { const y = subDays(new Date(), 1); return { from: y, to: y }; } },
  { label: 'Last 7 days', key: 'last_7', getRange: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: 'Last 30 days', key: 'last_30', getRange: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: 'Last 90 days', key: 'last_90', getRange: () => ({ from: subDays(new Date(), 89), to: new Date() }) },
];

function getActiveQuickFilter(dateRange: DateRange | undefined): string | null {
  if (!dateRange?.from) return 'all_time';
  for (const filter of quickFilters) {
    if (filter.key === 'all_time') continue;
    const r = filter.getRange();
    if (
      r?.from && r?.to && dateRange.to &&
      format(r.from, 'yyyy-MM-dd') === format(dateRange.from, 'yyyy-MM-dd') &&
      format(r.to, 'yyyy-MM-dd') === format(dateRange.to, 'yyyy-MM-dd')
    ) return filter.key;
  }
  return null;
}

function getDisplayLabel(dateRange: DateRange | undefined): string {
  if (!dateRange?.from) return 'All time';
  const active = getActiveQuickFilter(dateRange);
  const match = quickFilters.find(f => f.key === active);
  if (match) return match.label;
  if (dateRange.to && format(dateRange.from, 'yyyy-MM-dd') === format(dateRange.to, 'yyyy-MM-dd')) {
    return format(dateRange.from, 'MMM d, yyyy');
  }
  if (dateRange.to) return `${format(dateRange.from, 'MMM d')} – ${format(dateRange.to, 'MMM d, yyyy')}`;
  return format(dateRange.from, 'MMM d, yyyy');
}

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  dateRange,
  onDateRangeChange,
  className,
}) => {
  const [open, setOpen] = useState(false);

  const activeQuick = getActiveQuickFilter(dateRange);

  // Determine selected month/year from dateRange
  const selectedMonth = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return '';
    const from = dateRange.from;
    const to = dateRange.to;
    const monthStart = startOfMonth(from);
    const monthEnd = endOfMonth(from);
    if (
      format(from, 'yyyy-MM-dd') === format(monthStart, 'yyyy-MM-dd') &&
      format(to, 'yyyy-MM-dd') === format(monthEnd, 'yyyy-MM-dd')
    ) {
      return String(from.getMonth());
    }
    return '';
  }, [dateRange]);

  const selectedYear = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return '';
    const from = dateRange.from;
    const to = dateRange.to;
    const yearStart = startOfYear(from);
    const yearEnd = endOfYear(from);
    if (
      format(from, 'yyyy-MM-dd') === format(yearStart, 'yyyy-MM-dd') &&
      format(to, 'yyyy-MM-dd') === format(yearEnd, 'yyyy-MM-dd')
    ) {
      return String(from.getFullYear());
    }
    return '';
  }, [dateRange]);

  // Generate year options (last 5 years + current)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => currentYear - i);
  }, []);

  const handleQuickFilter = (filter: QuickFilter) => {
    onDateRangeChange(filter.getRange());
  };

  const handleMonthSelect = (monthIdx: string) => {
    if (!monthIdx) { onDateRangeChange(undefined); return; }
    const now = new Date();
    const year = selectedYear ? parseInt(selectedYear) : now.getFullYear();
    const monthDate = new Date(year, parseInt(monthIdx), 1);
    onDateRangeChange({ from: startOfMonth(monthDate), to: endOfMonth(monthDate) });
  };

  const handleYearSelect = (year: string) => {
    if (!year) { onDateRangeChange(undefined); return; }
    const yearDate = new Date(parseInt(year), 0, 1);
    onDateRangeChange({ from: startOfYear(yearDate), to: endOfYear(yearDate) });
  };

  return (
    <div className={cn('', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'justify-between text-left font-normal h-9 px-3 min-w-[180px]',
              !dateRange && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            <span className="truncate text-sm">{getDisplayLabel(dateRange)}</span>
            {dateRange && (
              <X
                className="ml-2 h-3.5 w-3.5 opacity-50 hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); onDateRangeChange(undefined); }}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4 z-50 space-y-4" align="start" sideOffset={4}>
          {/* Quick Filters */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Quick filters</p>
            <div className="flex flex-wrap gap-2">
              {quickFilters.map((filter) => (
                <Button
                  key={filter.key}
                  variant={activeQuick === filter.key ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handleQuickFilter(filter)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>

          {/* By Month / By Year */}
          <div className="flex gap-4">
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-muted-foreground">By Month</p>
              <Select value={selectedMonth} onValueChange={handleMonthSelect}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month, i) => (
                    <SelectItem key={i} value={String(i)}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-muted-foreground">By Year</p>
              <Select value={selectedYear} onValueChange={handleYearSelect}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom Range Calendar */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Custom Range</p>
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from || subMonths(new Date(), 1)}
              selected={dateRange}
              onSelect={(range) => onDateRangeChange(range)}
              numberOfMonths={2}
              className="pointer-events-auto"
              disabled={(date) => date > new Date()}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
