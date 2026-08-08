import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWeekend, addMonths, subMonths, isToday, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Briefcase, Umbrella, HeartPulse, GraduationCap, Coffee, Check, X, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TimesheetEntry, TimesheetEntryType, TimesheetStats as Stats } from '@/hooks/useTimesheets';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface TimesheetCalendarProps {
  entries: TimesheetEntry[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  onEntryUpdate: (
    date: Date,
    entryType: TimesheetEntryType,
    hoursWorked?: number,
    startTime?: string,
    endTime?: string,
    breakMinutes?: number,
    notes?: string
  ) => Promise<void>;
  onEntryDelete: (date: Date) => Promise<void>;
  stats?: Stats;
}

const entryTypeConfig: Record<string, { icon: React.ElementType; label: string; color: string; bgColor: string; selectedBg: string }> = {
  worked: { icon: Briefcase, label: 'Worked', color: 'text-emerald-700', bgColor: 'bg-emerald-100', selectedBg: 'bg-emerald-500' },
  holiday: { icon: Umbrella, label: 'Holiday', color: 'text-amber-700', bgColor: 'bg-amber-100', selectedBg: 'bg-amber-500' },
  sick: { icon: HeartPulse, label: 'Sick', color: 'text-red-700', bgColor: 'bg-red-100', selectedBg: 'bg-red-500' },
  training: { icon: GraduationCap, label: 'Training', color: 'text-purple-700', bgColor: 'bg-purple-100', selectedBg: 'bg-purple-500' },
  unpaid_leave: { icon: Coffee, label: 'Leave', color: 'text-gray-700', bgColor: 'bg-gray-200', selectedBg: 'bg-gray-500' },
};

type DayType = 'full_day' | 'half_day';

function getDefaults(date: Date, dayType: DayType = 'full_day') {
  const weekend = isWeekend(date);
  if (dayType === 'half_day') {
    return { startTime: '09:00', endTime: '14:00', hoursWorked: 5, breakMinutes: 0 };
  }
  return {
    startTime: '09:00',
    endTime: weekend ? '14:00' : '18:00',
    hoursWorked: weekend ? 5 : 9,
    breakMinutes: weekend ? 0 : 30,
  };
}

function isHalfDay(entry: TimesheetEntry): boolean {
  return (entry.hours_worked || 0) <= 5;
}

function getDayLabel(entry: TimesheetEntry): string {
  if (entry.entry_type === 'worked' || entry.entry_type === 'wfh' || entry.entry_type === 'training') {
    return isHalfDay(entry) ? 'Half Day' : 'Full Day';
  }
  return entryTypeConfig[entry.entry_type]?.label || entry.entry_type;
}

export function TimesheetCalendar({
  entries,
  currentMonth,
  onMonthChange,
  onEntryUpdate,
  onEntryDelete,
  stats,
}: TimesheetCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [formData, setFormData] = useState({
    entryType: 'worked' as TimesheetEntryType,
    dayType: 'full_day' as DayType,
    notes: '',
  });

  const mStart = startOfMonth(currentMonth);
  const mEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: mStart, end: mEnd });

  // Mon-Fri-Sat-Sun layout: getDay() returns 0=Sun, we want Mon=0
  const mondayIndex = (getDay(mStart) + 6) % 7; // padding for Monday start

  const getEntryForDate = (date: Date) => {
    return entries.find(e => isSameDay(new Date(e.entry_date), date));
  };

  const handleDayClick = (date: Date, entry?: TimesheetEntry) => {
    // Always open the popover so the user can pick Worked / Half / Holiday / Sick / Training / Leave.
    setSelectedDate(date);
    if (entry) {
      setFormData({
        entryType: entry.entry_type === 'wfh' ? 'worked' : entry.entry_type,
        dayType: isHalfDay(entry) ? 'half_day' : 'full_day',
        notes: entry.notes || '',
      });
    } else {
      const weekend = isWeekend(date);
      setFormData({
        entryType: 'worked',
        dayType: weekend ? 'half_day' : 'full_day',
        notes: '',
      });
    }
  };

  const handleSave = async () => {
    if (!selectedDate) return;
    const defaults = getDefaults(selectedDate, formData.dayType);
    await onEntryUpdate(
      selectedDate,
      formData.entryType,
      defaults.hoursWorked,
      defaults.startTime,
      defaults.endTime,
      defaults.breakMinutes,
      formData.notes
    );
    setSelectedDate(null);
  };

  const handleDelete = async () => {
    if (!selectedDate) return;
    await onEntryDelete(selectedDate);
    setSelectedDate(null);
  };

  // Mon-Sun week headers
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => onMonthChange(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onMonthChange(new Date())}>Today</Button>
          <Button variant="outline" size="icon" onClick={() => onMonthChange(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Merged stats — same card as the calendar so totals sit beside the days */}
      {stats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-5">
          {[
            { label: 'Full Days', value: stats.fullDays, color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'Half Days', value: stats.halfDays, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Weekend', value: stats.weekendDays, color: 'text-indigo-700', bg: 'bg-indigo-50' },
            { label: 'Sick', value: stats.sickDays, color: 'text-red-700', bg: 'bg-red-50' },
            { label: 'Holidays', value: stats.holidayDays, color: 'text-amber-700', bg: 'bg-amber-50' },
            { label: 'Training', value: stats.trainingDays, color: 'text-purple-700', bg: 'bg-purple-50' },
          ].map((s) => (
            <div key={s.label} className={cn('rounded-lg p-2 text-center', s.bg)}>
              <div className={cn('text-lg font-bold leading-none', s.color)}>{s.value}</div>
              <div className="text-[10px] text-gray-600 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-400" />
          <span className="text-gray-600">Full day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-400" />
          <span className="text-gray-600">Half day</span>
        </div>
        {Object.entries(entryTypeConfig).filter(([t]) => t !== 'worked').map(([type, config]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded', config.bgColor)} />
            <span className="text-gray-600">{config.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <X className="h-3.5 w-3.5 text-red-600" strokeWidth={3} />
          <span className="text-gray-600">Day off</span>
        </div>
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-500 mb-3">
        Just mark the days you're <span className="font-semibold text-red-600">off</span> — click a day and pick Holiday, Sick, Training or Leave. Days off show a big red X. Worked days are Full (green) or Half (blue).
      </p>



      {/* Calendar Grid — Mon to Sun */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day, i) => (
          <div
            key={day}
            className={cn(
              'text-center text-xs font-medium py-2',
              i >= 5 ? 'text-blue-500' : 'text-gray-500'
            )}
          >
            {day}
          </div>
        ))}

        {Array.from({ length: mondayIndex }).map((_, i) => (
          <div key={`pad-${i}`} className="aspect-square" />
        ))}

        {days.map(day => {
          const entry = getEntryForDate(day);
          const entryType = entry?.entry_type === 'wfh' ? 'worked' : entry?.entry_type;
          const config = entryType ? entryTypeConfig[entryType] : null;
          const weekend = isWeekend(day);
          const today = isToday(day);
          const hasEntry = !!entry;
          const half = !!entry && (entryType === 'worked' || entryType === 'training') && isHalfDay(entry);
          const isDayOff = entryType === 'holiday' || entryType === 'sick' || entryType === 'unpaid_leave';
          // Full day = green, half day = blue, so they read differently at a glance.
          const cellBg = !hasEntry
            ? undefined
            : entryType === 'worked'
              ? (half ? 'bg-blue-100' : 'bg-emerald-100')
              : config?.bgColor;
          const cellText = !hasEntry
            ? undefined
            : entryType === 'worked'
              ? (half ? 'text-blue-700' : 'text-emerald-700')
              : config?.color;

          return (
            <Popover
              key={day.toISOString()}
              open={selectedDate ? isSameDay(selectedDate, day) : false}
              onOpenChange={(open) => !open && setSelectedDate(null)}
            >
              <PopoverTrigger asChild>
                <button
                  onClick={() => handleDayClick(day, entry)}
                  className={cn(
                    'aspect-square p-1 rounded-lg flex flex-col items-center justify-center gap-0.5 text-sm transition-all relative',
                    weekend && !hasEntry && 'bg-blue-50 text-blue-400',
                    !weekend && !hasEntry && 'hover:bg-gray-100',
                    cellBg,
                    isDayOff && 'border-2 border-red-400',
                    today && 'ring-2 ring-orange-500 ring-offset-1',
                  )}
                >
                  <span className={cn(
                    'font-medium',
                    today && 'text-orange-600',
                    cellText,
                  )}>
                    {format(day, 'd')}
                  </span>
                  {hasEntry && isDayOff && (
                    <X className="h-7 w-7 text-red-600 -my-1" strokeWidth={3.5} />
                  )}
                  {hasEntry && !isDayOff && (
                    <div className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center',
                      entryType === 'worked' ? (half ? 'bg-blue-500' : 'bg-emerald-500') : (config?.selectedBg || 'bg-emerald-500'),
                    )}>
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    </div>
                  )}
                  {hasEntry && entry && (entryType === 'worked' || entryType === 'training') && (
                    <span className={cn('text-[10px]', half ? 'text-blue-600' : 'text-emerald-700')}>
                      {getDayLabel(entry)}
                    </span>
                  )}
                  {hasEntry && isDayOff && (
                    <span className="text-[10px] font-semibold text-red-600">{config?.label}</span>
                  )}
                </button>

              </PopoverTrigger>
              <PopoverContent className="w-72 p-4 pointer-events-auto" align="start">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{format(day, 'EEEE, d MMMM')}</h3>
                    {entry && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={handleDelete}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Unified day selection — one grid, big easy buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Full Day */}
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, entryType: 'worked', dayType: 'full_day' }))}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all',
                        formData.entryType === 'worked' && formData.dayType === 'full_day'
                          ? 'bg-emerald-100 border-emerald-500 text-emerald-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-500'
                      )}
                    >
                      <Briefcase className="h-4 w-4" />
                      Full Day
                    </button>
                    {/* Half Day */}
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, entryType: 'worked', dayType: 'half_day' }))}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all',
                        formData.entryType === 'worked' && formData.dayType === 'half_day'
                          ? 'bg-blue-100 border-blue-500 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-500'
                      )}
                    >
                      <Briefcase className="h-4 w-4" />
                      Half Day
                    </button>
                    {/* Holiday */}
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, entryType: 'holiday' }))}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all',
                        formData.entryType === 'holiday'
                          ? 'bg-amber-100 border-amber-500 text-amber-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-500'
                      )}
                    >
                      <Umbrella className="h-4 w-4" />
                      Holiday
                    </button>
                    {/* Sick */}
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, entryType: 'sick' }))}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all',
                        formData.entryType === 'sick'
                          ? 'bg-red-100 border-red-500 text-red-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-500'
                      )}
                    >
                      <HeartPulse className="h-4 w-4" />
                      Sick
                    </button>
                    {/* Training */}
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, entryType: 'training' }))}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all',
                        formData.entryType === 'training'
                          ? 'bg-purple-100 border-purple-500 text-purple-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-500'
                      )}
                    >
                      <GraduationCap className="h-4 w-4" />
                      Training
                    </button>
                    {/* Leave */}
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, entryType: 'unpaid_leave' }))}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all',
                        formData.entryType === 'unpaid_leave'
                          ? 'bg-gray-200 border-gray-500 text-gray-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-500'
                      )}
                    >
                      <Coffee className="h-4 w-4" />
                      Leave
                    </button>
                  </div>

                  {/* Reason box — only shows when an off-type is selected */}
                  {(formData.entryType === 'holiday' || formData.entryType === 'sick' || formData.entryType === 'unpaid_leave') && (
                    <div>
                      <Label className="text-xs">Reason (optional)</Label>
                      <Textarea value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="Add a reason..." className="h-16 resize-none" />
                    </div>
                  )}

                  <Button onClick={handleSave} className="w-full bg-emerald-600 hover:bg-emerald-700">
                    {entry ? 'Update' : 'Save'}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}
