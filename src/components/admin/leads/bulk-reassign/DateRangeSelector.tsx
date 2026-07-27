import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DateRangeSelectorProps {
  /** yyyy-MM-dd */
  from: string;
  /** yyyy-MM-dd */
  to: string;
  onChange: (from: string, to: string) => void;
  className?: string;
}

const toKey = (d?: Date) => (d ? format(d, 'yyyy-MM-dd') : '');
const parseKey = (s: string) => (s ? new Date(`${s}T00:00:00`) : undefined);

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({ from, to, onChange, className }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>({ from: parseKey(from), to: parseKey(to) });

  useEffect(() => {
    if (open) setDraft({ from: parseKey(from), to: parseKey(to) });
  }, [open, from, to]);

  const label = from || to
    ? `${from ? format(parseKey(from)!, 'd MMM yyyy') : '…'} → ${to ? format(parseKey(to)!, 'd MMM yyyy') : '…'}`
    : 'Any date (newest leads first)';

  const preset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setDraft({ from: start, to: end });
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn('h-9 flex-1 justify-start text-left font-normal', !from && !to && 'text-muted-foreground')}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
          <div className="flex flex-wrap gap-1 border-b p-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDraft({ from: new Date(), to: new Date() })}>Today</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => preset(7)}>Last 7 days</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => preset(30)}>Last 30 days</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => preset(90)}>Last 90 days</Button>
          </div>
          <Calendar
            mode="range"
            numberOfMonths={2}
            defaultMonth={draft?.from ?? new Date()}
            selected={draft}
            onSelect={setDraft}
            initialFocus
            className={cn('p-3 pointer-events-auto')}
          />
          <div className="flex items-center justify-between gap-2 border-t p-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              onClick={() => setDraft(undefined)}
            >
              Clear
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => {
                  onChange(toKey(draft?.from), toKey(draft?.to ?? draft?.from));
                  setOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {(from || to) && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9 shrink-0"
          aria-label="Clear date range"
          onClick={() => onChange('', '')}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
