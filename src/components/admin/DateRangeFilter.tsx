import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface DateRangeFilterProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  className?: string;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  dateRange,
  onDateRangeChange,
  className
}) => {
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDateRangeChange(undefined);
  };

  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-sm font-medium">Date Range</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal h-10",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <span className="flex-1 truncate">
                  {format(dateRange.from, "dd MMM yyyy")} - {format(dateRange.to, "dd MMM yyyy")}
                </span>
              ) : (
                <span className="flex-1 truncate">
                  {format(dateRange.from, "dd MMM yyyy")}
                </span>
              )
            ) : (
              <span>Select date range</span>
            )}
            {dateRange && (
              <X 
                className="ml-2 h-4 w-4 hover:text-destructive" 
                onClick={handleClear}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50" align="start" side="bottom" sideOffset={4} avoidCollisions>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={onDateRangeChange}
            numberOfMonths={2}
            className="pointer-events-auto"
          />
          <div className="flex items-center justify-between p-3 border-t">
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const startOfWeek = new Date(today);
                  startOfWeek.setDate(today.getDate() - today.getDay());
                  onDateRangeChange({ from: startOfWeek, to: today });
                }}
              >
                This Week
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                  onDateRangeChange({ from: startOfMonth, to: today });
                }}
              >
                This Month
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const today = new Date();
                  const last30Days = new Date(today);
                  last30Days.setDate(today.getDate() - 30);
                  onDateRangeChange({ from: last30Days, to: today });
                }}
              >
                Last 30 Days
              </Button>
            </div>
            {dateRange && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => onDateRangeChange(undefined)}
              >
                Clear
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
