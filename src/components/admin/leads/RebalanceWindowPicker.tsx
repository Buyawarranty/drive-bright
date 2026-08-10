import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Clock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRebalanceWindow } from '@/lib/rebalanceWindow';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const toTimeValue = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Combine a picked calendar day with a "HH:mm" time into one local Date. */
const combine = (day: Date | undefined, time: string): Date | null => {
  if (!day) return null;
  const [h, m] = (time || '00:00').split(':').map(Number);
  const d = new Date(day);
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
};

/**
 * Lets a manager pick the date/time window for the Rebalance Leads tools:
 * a start date/time and an optional end date/time, then Save.
 * Uses an in-popover calendar (the browser's native date overlay used to close
 * the popover the moment you clicked a day, which made it look broken).
 */
export const RebalanceWindowPicker: React.FC<{ className?: string }> = ({ className }) => {
  const { from, to, custom, label, setWindow, reset } = useRebalanceWindow();
  const [open, setOpen] = useState(false);
  const [fromDay, setFromDay] = useState<Date | undefined>(from);
  const [fromTime, setFromTime] = useState(toTimeValue(from));
  const [toDay, setToDay] = useState<Date | undefined>(to ?? undefined);
  const [toTime, setToTime] = useState(to ? toTimeValue(to) : '23:59');

  useEffect(() => {
    if (open) {
      setFromDay(from);
      setFromTime(toTimeValue(from));
      setToDay(to ?? undefined);
      setToTime(to ? toTimeValue(to) : '23:59');
    }
  }, [open, from, to]);

  const applyPreset = (hoursAgo: number) => {
    const d = new Date();
    d.setHours(d.getHours() - hoursAgo, 0, 0, 0);
    setWindow(d, null);
    setOpen(false);
  };

  /** Whole days — the common case for covering someone's holiday. */
  const applyDayRange = (startDaysAgo: number, endDaysAgo = 0) => {
    const start = new Date();
    start.setDate(start.getDate() - startDaysAgo);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() - endDaysAgo);
    end.setHours(23, 59, 59, 999);
    setWindow(start, endDaysAgo === 0 ? null : end);
    setOpen(false);
  };

  const save = () => {
    const start = combine(fromDay, fromTime);
    if (!start) {
      toast({ title: 'Pick a start date', description: 'Choose the day and time to count leads from.', variant: 'destructive' });
      return;
    }
    const end = combine(toDay, toTime);
    if (end && end.getTime() <= start.getTime()) {
      toast({ title: 'End must be after start', description: 'Pick an end date and time later than the start.', variant: 'destructive' });
      return;
    }
    setWindow(start, end);
    setOpen(false);
    toast({
      title: 'Window saved',
      description: end
        ? `Counting leads created between ${format(start, 'd MMM HH:mm')} and ${format(end, 'd MMM HH:mm')}.`
        : `Counting leads created from ${format(start, 'd MMM HH:mm')} until now.`,
    });
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs font-medium">
            <Clock className="h-3.5 w-3.5" />
            Counting from: {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto max-w-[95vw] p-3 space-y-3 bg-popover z-50">
          <div>
            <p className="text-sm font-semibold text-foreground">Count leads from</p>
            <p className="text-xs text-muted-foreground">
              Default is 6pm yesterday until now. Pick the start day and time, and an end day if you want a fixed window
              (for example the days someone was on holiday).
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                From {fromDay ? <span className="text-muted-foreground font-normal">— {format(fromDay, 'd MMM yyyy')}</span> : null}
              </Label>
              <Calendar
                mode="single"
                selected={fromDay}
                onSelect={(d) => d && setFromDay(d)}
                className={cn('rounded-md border p-2 pointer-events-auto')}
              />
              <Input
                type="time"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
                className="h-9"
                aria-label="Start time"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">
                To <span className="text-muted-foreground font-normal">(optional — blank means up to now)</span>
              </Label>
              <Calendar
                mode="single"
                selected={toDay}
                onSelect={(d) => setToDay(d ?? undefined)}
                disabled={fromDay ? { before: fromDay } : undefined}
                className={cn('rounded-md border p-2 pointer-events-auto')}
              />
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value)}
                  className="h-9"
                  aria-label="End time"
                  disabled={!toDay}
                />
                {toDay && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs text-muted-foreground"
                    onClick={() => setToDay(undefined)}
                  >
                    Clear end
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => applyPreset(6)}>Last 6 hours</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => applyPreset(24)}>Last 24 hours</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => applyDayRange(6)}>Last 7 days</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => applyDayRange(13)}>Last 14 days</Button>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={() => { reset(); setOpen(false); }}
            >
              <RotateCcw className="h-3 w-3" />
              6pm yesterday
            </Button>
            <Button size="sm" className="h-7 text-xs" disabled={!fromDay} onClick={save}>
              Save window
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {custom && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={reset}
        >
          Reset
        </Button>
      )}
    </div>
  );
};


export default RebalanceWindowPicker;
