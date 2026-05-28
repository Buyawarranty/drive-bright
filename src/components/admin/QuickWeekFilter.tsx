import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameWeek } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

interface QuickWeekFilterProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  className?: string;
}

/**
 * Compact prev / current-week / next-week navigator (Monday-start).
 * Sets the date range to the full selected week.
 */
export const QuickWeekFilter: React.FC<QuickWeekFilterProps> = ({
  dateRange,
  onDateRangeChange,
  className,
}) => {
  const anchor = dateRange?.from ?? new Date();
  const opts = { weekStartsOn: 1 as const };

  const goTo = (date: Date) => {
    onDateRangeChange({ from: startOfWeek(date, opts), to: endOfWeek(date, opts) });
  };

  const isCurrentWeek = isSameWeek(anchor, new Date(), opts) && dateRange?.from;
  const start = startOfWeek(anchor, opts);
  const end = endOfWeek(anchor, opts);
  const label = `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => goTo(subWeeks(anchor, 1))}
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={isCurrentWeek ? 'default' : 'outline'}
        className="h-9 min-w-[160px] font-semibold"
        onClick={() => goTo(new Date())}
      >
        {label}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => goTo(addWeeks(anchor, 1))}
        aria-label="Next week"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};
