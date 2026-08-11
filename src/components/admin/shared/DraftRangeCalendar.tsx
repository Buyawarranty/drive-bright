import React, { useEffect, useState } from 'react';
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DraftRangeCalendarProps {
  /** Currently applied range (used only as the starting draft / default month). */
  value?: DateRange;
  /** Called when the user presses Apply with a complete range. */
  onApply: (range: DateRange | undefined) => void;
  /** Optional: called when the user presses Cancel. */
  onCancel?: () => void;
  numberOfMonths?: number;
  disableFuture?: boolean;
  className?: string;
  /** Reset draft whenever this key changes (e.g. popover open state). */
  resetKey?: unknown;
}

/**
 * Shared range picker used by every admin date selector.
 *
 * Fixes the long-standing bug where a click landed on top of the already
 * applied range (making it look like three dates were selected and making it
 * impossible to pick a fresh range). Here the draft starts empty: the first
 * click sets the start, the second click sets the end, and nothing is applied
 * until Apply is pressed.
 */
export const DraftRangeCalendar: React.FC<DraftRangeCalendarProps> = ({
  value,
  onApply,
  onCancel,
  numberOfMonths = 2,
  disableFuture = true,
  className,
  resetKey,
}) => {
  const [draft, setDraft] = useState<DateRange | undefined>();

  useEffect(() => {
    setDraft(undefined);
  }, [resetKey]);

  const handleDayClick = (day: Date, modifiers: Record<string, boolean>) => {
    if (modifiers?.disabled) return;
    const from = draft?.from;
    if (!from || draft?.to) {
      // Fresh selection (nothing picked yet, or previous range completed).
      setDraft({ from: day, to: undefined });
      return;
    }
    setDraft(day < from ? { from: day, to: from } : { from, to: day });
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Calendar
        mode="range"
        selected={draft}
        onSelect={() => { /* selection handled in onDayClick */ }}
        onDayClick={handleDayClick}
        defaultMonth={draft?.from ?? value?.from ?? new Date()}
        numberOfMonths={numberOfMonths}
        disabled={disableFuture ? (date) => date > new Date() : undefined}
        className="p-3 pointer-events-auto"
        classNames={{
          // Today must never look selected — only the draft range is filled.
          day_today: 'font-semibold ring-1 ring-primary text-foreground rounded-md aria-selected:ring-0',
          day_range_middle: 'aria-selected:bg-primary/20 aria-selected:text-foreground rounded-none',
        }}
      />
      <div className="flex items-center justify-between gap-2 border-t pt-2 px-1">
        <span className="text-xs text-muted-foreground">
          {draft?.from && !draft?.to
            ? 'Now pick the end date'
            : draft?.from && draft?.to
              ? 'Press Apply to use this range'
              : 'Click a start date, then an end date'}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-xs"
            onClick={() => { setDraft(undefined); onApply(undefined); }}
          >
            Clear
          </Button>
          {onCancel && (
            <Button size="sm" variant="ghost" className="text-xs" onClick={onCancel}>Cancel</Button>
          )}
          <Button
            size="sm"
            className="text-xs"
            disabled={!draft?.from || !draft?.to}
            onClick={() => { if (draft?.from && draft?.to) onApply(draft); }}
          >
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DraftRangeCalendar;
