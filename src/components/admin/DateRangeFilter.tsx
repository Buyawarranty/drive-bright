import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface DateRangeFilterProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  className?: string;
}

type PresetKey = 'today' | 'yesterday' | 'this_week' | 'last_7' | 'last_week' | 'last_14' | 'this_month' | 'last_30' | 'last_month' | 'all_time' | 'custom';

interface Preset {
  key: PresetKey;
  label: string;
  getRange: () => DateRange | undefined;
}

const presets: Preset[] = [
  {
    key: 'today',
    label: 'Today',
    getRange: () => {
      const today = new Date();
      return { from: today, to: today };
    },
  },
  {
    key: 'yesterday',
    label: 'Yesterday',
    getRange: () => {
      const yesterday = subDays(new Date(), 1);
      return { from: yesterday, to: yesterday };
    },
  },
  {
    key: 'this_week',
    label: 'This week (Mon – Today)',
    getRange: () => {
      const today = new Date();
      return { from: startOfWeek(today, { weekStartsOn: 1 }), to: today };
    },
  },
  {
    key: 'last_7',
    label: 'Last 7 days',
    getRange: () => ({ from: subDays(new Date(), 6), to: new Date() }),
  },
  {
    key: 'last_week',
    label: 'Last week (Mon – Sun)',
    getRange: () => {
      const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
      return { from: lastWeekStart, to: endOfWeek(lastWeekStart, { weekStartsOn: 1 }) };
    },
  },
  {
    key: 'last_14',
    label: 'Last 14 days',
    getRange: () => ({ from: subDays(new Date(), 13), to: new Date() }),
  },
  {
    key: 'this_month',
    label: 'This month',
    getRange: () => ({ from: startOfMonth(new Date()), to: new Date() }),
  },
  {
    key: 'last_30',
    label: 'Last 30 days',
    getRange: () => ({ from: subDays(new Date(), 29), to: new Date() }),
  },
  {
    key: 'last_month',
    label: 'Last month',
    getRange: () => {
      const lm = subMonths(new Date(), 1);
      return { from: startOfMonth(lm), to: endOfMonth(lm) };
    },
  },
  {
    key: 'all_time',
    label: 'All time',
    getRange: () => undefined,
  },
];

function getActivePreset(dateRange: DateRange | undefined): PresetKey {
  if (!dateRange?.from) return 'all_time';
  for (const preset of presets) {
    if (preset.key === 'all_time' || preset.key === 'custom') continue;
    const r = preset.getRange();
    if (
      r?.from && r?.to && dateRange.to &&
      format(r.from, 'yyyy-MM-dd') === format(dateRange.from, 'yyyy-MM-dd') &&
      format(r.to, 'yyyy-MM-dd') === format(dateRange.to, 'yyyy-MM-dd')
    ) {
      return preset.key;
    }
  }
  return 'custom';
}

function getDisplayLabel(dateRange: DateRange | undefined): string {
  if (!dateRange?.from) return 'All time';
  const active = getActivePreset(dateRange);
  const preset = presets.find(p => p.key === active);
  if (preset && active !== 'custom') return preset.label;
  if (dateRange.to && format(dateRange.from, 'yyyy-MM-dd') === format(dateRange.to, 'yyyy-MM-dd')) {
    return format(dateRange.from, 'MMM d, yyyy');
  }
  if (dateRange.to) {
    return `${format(dateRange.from, 'MMM d, yyyy')} – ${format(dateRange.to, 'MMM d, yyyy')}`;
  }
  return format(dateRange.from, 'MMM d, yyyy');
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  dateRange,
  onDateRangeChange,
  className
}) => {
  const [open, setOpen] = useState(false);

  const handlePreset = (preset: Preset) => {
    const range = preset.getRange();
    onDateRangeChange(range);
    if (preset.key !== 'custom') {
      setOpen(false);
    }
  };

  const navigateDay = (direction: -1 | 1) => {
    if (!dateRange?.from || !dateRange?.to) return;
    const diffMs = dateRange.to.getTime() - dateRange.from.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const shift = diffDays === 0 ? 1 : diffDays + 1;
    const newFrom = addDays(dateRange.from, direction * shift);
    const newTo = addDays(dateRange.to, direction * shift);
    // Don't navigate into the future
    if (newTo > new Date()) return;
    onDateRangeChange({ from: newFrom, to: newTo });
  };

  const handleQuickLast30 = () => {
    const range = presets.find(p => p.key === 'last_30')!.getRange();
    onDateRangeChange(range);
  };

  const activePreset = getActivePreset(dateRange);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Main date display with dropdown */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-between text-left font-normal h-9 px-3 min-w-[180px]",
              !dateRange && "text-muted-foreground"
            )}
          >
            <span className="truncate text-sm">{getDisplayLabel(dateRange)}</span>
            <ChevronDown className="ml-2 h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 z-50"
          align="start"
          side="bottom"
          sideOffset={4}
          avoidCollisions
        >
          <div className="flex">
            {/* Presets sidebar */}
            <div className="w-[180px] border-r py-1">
              <button
                className={cn(
                  "w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors",
                  activePreset === 'custom' && "text-primary font-medium bg-accent"
                )}
                onClick={() => {/* just keep popover open for manual selection */}}
              >
                Custom
              </button>
              {presets.map(preset => (
                <button
                  key={preset.key}
                  className={cn(
                    "w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors",
                    activePreset === preset.key && "text-primary font-medium bg-accent"
                  )}
                  onClick={() => handlePreset(preset)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {/* Calendar */}
            <div className="p-0">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from || subMonths(new Date(), 1)}
                selected={dateRange}
                onSelect={(range) => {
                  onDateRangeChange(range);
                }}
                numberOfMonths={2}
                className="pointer-events-auto"
                disabled={(date) => date > new Date()}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Prev / Next navigation arrows */}
      {dateRange?.from && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => navigateDay(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => navigateDay(1)}
            disabled={dateRange?.to ? dateRange.to >= new Date() : true}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      )}

      {/* Quick "Show last 30 days" link */}
      <Button
        variant="link"
        size="sm"
        className="text-primary text-xs px-2 whitespace-nowrap"
        onClick={handleQuickLast30}
      >
        Show last 30 days
      </Button>

      {/* Clear button */}
      {dateRange && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => onDateRangeChange(undefined)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
};
