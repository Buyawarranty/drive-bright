import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

interface QuickMonthFilterProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  className?: string;
}

/**
 * Compact prev / current-month / next month navigator.
 * Sets the date range to the full selected month.
 */
export const QuickMonthFilter: React.FC<QuickMonthFilterProps> = ({
  dateRange,
  onDateRangeChange,
  className,
}) => {
  // Anchor month: use dateRange.from if it represents a full month, else current month
  const anchor = dateRange?.from ?? new Date();

  const goTo = (date: Date) => {
    onDateRangeChange({ from: startOfMonth(date), to: endOfMonth(date) });
  };

  const isCurrentMonth = isSameMonth(anchor, new Date()) && dateRange?.from;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => goTo(subMonths(anchor, 1))}
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={isCurrentMonth ? 'default' : 'outline'}
        className="h-9 min-w-[140px] font-semibold"
        onClick={() => goTo(new Date())}
      >
        {format(anchor, 'MMMM yyyy')}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0"
        onClick={() => goTo(addMonths(anchor, 1))}
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};
