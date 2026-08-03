import React, { useEffect, useState } from 'react';
import { Clock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRebalanceWindow } from '@/lib/rebalanceWindow';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const toInputValue = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * Lets a manager pick the date/time window for the Rebalance Leads tools:
 * a start date/time and an optional end date/time, then Save.
 * Defaults to 6pm yesterday until now.
 */
export const RebalanceWindowPicker: React.FC<{ className?: string }> = ({ className }) => {
  const { from, to, custom, label, setWindow, reset } = useRebalanceWindow();
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(toInputValue(from));
  const [draftTo, setDraftTo] = useState(to ? toInputValue(to) : '');

  useEffect(() => {
    if (open) {
      setDraftFrom(toInputValue(from));
      setDraftTo(to ? toInputValue(to) : '');
    }
  }, [open, from, to]);

  const applyPreset = (hoursAgo: number) => {
    const d = new Date();
    d.setHours(d.getHours() - hoursAgo, 0, 0, 0);
    setWindow(d, null);
    setOpen(false);
  };

  const save = () => {
    const start = new Date(draftFrom);
    if (!draftFrom || Number.isNaN(start.getTime())) {
      toast({ title: 'Pick a start date', description: 'Choose the date and time to count leads from.', variant: 'destructive' });
      return;
    }
    let end: Date | null = null;
    if (draftTo) {
      const e = new Date(draftTo);
      if (Number.isNaN(e.getTime())) {
        toast({ title: 'Check the end date', description: 'That end date and time is not valid.', variant: 'destructive' });
        return;
      }
      if (e.getTime() <= start.getTime()) {
        toast({ title: 'End must be after start', description: 'Pick an end date and time later than the start.', variant: 'destructive' });
        return;
      }
      end = e;
    }
    setWindow(start, end);
    setOpen(false);
    toast({
      title: 'Window saved',
      description: end
        ? `Counting leads created between the two dates you picked.`
        : `Counting leads created from your chosen date and time until now.`,
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
        <PopoverContent align="start" className="w-80 p-3 space-y-3 bg-popover z-50">
          <div>
            <p className="text-sm font-semibold text-foreground">Count leads from</p>
            <p className="text-xs text-muted-foreground">
              Default is 6pm yesterday until now. Pick a start date and time, and an end if you want a fixed window.
            </p>
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="rebalance-from" className="text-xs font-medium">From</Label>
              <Input
                id="rebalance-from"
                type="datetime-local"
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rebalance-to" className="text-xs font-medium">
                To <span className="text-muted-foreground font-normal">(optional — leave blank for now)</span>
              </Label>
              <Input
                id="rebalance-to"
                type="datetime-local"
                value={draftTo}
                min={draftFrom || undefined}
                onChange={(e) => setDraftTo(e.target.value)}
                className="h-9"
              />
              {draftTo && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1 text-xs text-muted-foreground"
                  onClick={() => setDraftTo('')}
                >
                  Clear end date
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => applyPreset(6)}>Last 6 hours</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => applyPreset(24)}>Last 24 hours</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => applyPreset(72)}>Last 3 days</Button>
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
            <Button size="sm" className="h-7 text-xs" disabled={!draftFrom} onClick={save}>
              Save
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
