import React, { useEffect, useState } from 'react';
import { Clock, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRebalanceWindow } from '@/lib/rebalanceWindow';
import { cn } from '@/lib/utils';

const toInputValue = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * Lets a manager change the "counting from" point for the Rebalance Leads tools.
 * Defaults to 6pm yesterday; any date/time can be chosen instead.
 */
export const RebalanceWindowPicker: React.FC<{ className?: string }> = ({ className }) => {
  const { from, custom, label, setFrom, reset } = useRebalanceWindow();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(toInputValue(from));

  useEffect(() => {
    if (open) setDraft(toInputValue(from));
  }, [open, from]);

  const applyPreset = (hoursAgo: number) => {
    const d = new Date();
    d.setHours(d.getHours() - hoursAgo, 0, 0, 0);
    setFrom(d);
    setOpen(false);
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
        <PopoverContent align="start" className="w-72 p-3 space-y-3 bg-popover z-50">
          <div>
            <p className="text-sm font-semibold text-foreground">Count leads from</p>
            <p className="text-xs text-muted-foreground">
              Default is 6pm yesterday. Pick any date and time to widen or narrow the window.
            </p>
          </div>
          <Input
            type="datetime-local"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-9"
          />
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
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={!draft}
              onClick={() => {
                const d = new Date(draft);
                if (!Number.isNaN(d.getTime())) setFrom(d);
                setOpen(false);
              }}
            >
              Apply
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
