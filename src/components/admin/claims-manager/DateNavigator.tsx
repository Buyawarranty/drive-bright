import React from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export type DatePeriod = 'day' | 'week' | 'month';

export interface DateRangeValue {
  period: DatePeriod | null; // null = no filter
  // Anchor ISO date (YYYY-MM-DD) — represents the start of the active range
  anchor: string;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const startOfWeek = (d: Date) => {
  // Monday-start week
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Sun .. 6 Sat
  const diff = (day + 6) % 7; // back to Monday
  x.setDate(x.getDate() - diff);
  return x;
};
const startOfMonth = (d: Date) => {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
};

export const todayAnchor = (period: DatePeriod): string => {
  const now = new Date();
  const start = period === 'day' ? startOfDay(now) : period === 'week' ? startOfWeek(now) : startOfMonth(now);
  return toISO(start);
};

const toISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getRange = (value: DateRangeValue): { start: Date; end: Date } | null => {
  if (!value.period) return null;
  const anchor = new Date(value.anchor + 'T00:00:00');
  const start =
    value.period === 'day'
      ? startOfDay(anchor)
      : value.period === 'week'
      ? startOfWeek(anchor)
      : startOfMonth(anchor);
  const end = new Date(start);
  if (value.period === 'day') end.setDate(end.getDate() + 1);
  else if (value.period === 'week') end.setDate(end.getDate() + 7);
  else end.setMonth(end.getMonth() + 1);
  return { start, end };
};

const shift = (value: DateRangeValue, direction: 1 | -1): DateRangeValue => {
  if (!value.period) return value;
  const anchor = new Date(value.anchor + 'T00:00:00');
  if (value.period === 'day') anchor.setDate(anchor.getDate() + direction);
  else if (value.period === 'week') anchor.setDate(anchor.getDate() + 7 * direction);
  else anchor.setMonth(anchor.getMonth() + direction);
  return { ...value, anchor: toISO(anchor) };
};

const formatLabel = (value: DateRangeValue): string => {
  const range = getRange(value);
  if (!range) return 'All dates';
  const { start, end } = range;
  const endInclusive = new Date(end);
  endInclusive.setDate(endInclusive.getDate() - 1);
  if (value.period === 'day') {
    return start.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }
  if (value.period === 'month') {
    return start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  // week
  const sameMonth = start.getMonth() === endInclusive.getMonth() && start.getFullYear() === endInclusive.getFullYear();
  const left = start.toLocaleDateString('en-GB', { day: '2-digit', month: sameMonth ? undefined : 'short' });
  const right = endInclusive.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${left} – ${right}`;
};

interface Props {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
}

const btn = 'h-9 px-3 rounded-md border border-border bg-card text-sm text-foreground hover:bg-muted transition-colors';
const btnActive = 'h-9 px-3 rounded-md border border-primary bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors';
const iconBtn = 'inline-flex items-center justify-center h-9 w-9 rounded-md border border-border bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

export const DateNavigator: React.FC<Props> = ({ value, onChange }) => {
  const setPeriod = (period: DatePeriod) => {
    if (value.period === period) {
      onChange({ period: null, anchor: value.anchor });
      return;
    }
    onChange({ period, anchor: todayAnchor(period) });
  };

  const goToday = () => {
    if (!value.period) {
      onChange({ period: 'day', anchor: todayAnchor('day') });
      return;
    }
    onChange({ ...value, anchor: todayAnchor(value.period) });
  };

  const goPrev = () => onChange(shift(value, -1));
  const goNext = () => onChange(shift(value, 1));

  return (
    <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap items-center gap-2 shadow-sm">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => setPeriod('day')} className={value.period === 'day' ? btnActive : btn} aria-pressed={value.period === 'day'}>
          Day
        </button>
        <button type="button" onClick={() => setPeriod('week')} className={value.period === 'week' ? btnActive : btn} aria-pressed={value.period === 'week'}>
          Week
        </button>
        <button type="button" onClick={() => setPeriod('month')} className={value.period === 'month' ? btnActive : btn} aria-pressed={value.period === 'month'}>
          Month
        </button>
      </div>

      <div className="flex items-center gap-1 ml-1">
        <button
          type="button"
          onClick={goPrev}
          disabled={!value.period}
          aria-label={`Previous ${value.period ?? 'period'}`}
          title={value.period ? `Previous ${value.period}` : 'Pick a period first'}
          className={iconBtn}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div
          className="min-w-[180px] text-center px-3 py-1.5 rounded-md border border-border bg-muted/30 text-sm font-semibold text-foreground"
          aria-live="polite"
        >
          {formatLabel(value)}
        </div>
        <button
          type="button"
          onClick={goNext}
          disabled={!value.period}
          aria-label={`Next ${value.period ?? 'period'}`}
          title={value.period ? `Next ${value.period}` : 'Pick a period first'}
          className={iconBtn}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <button type="button" onClick={goToday} className={btn}>
        Today
      </button>

      {value.period && (
        <button
          type="button"
          onClick={() => onChange({ period: null, anchor: value.anchor })}
          className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-border bg-card text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Clear date
        </button>
      )}
    </div>
  );
};
