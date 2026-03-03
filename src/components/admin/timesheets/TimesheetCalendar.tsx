import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWeekend, addMonths, subMonths, isToday, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Briefcase, Umbrella, HeartPulse, GraduationCap, Coffee, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TimesheetEntry, TimesheetEntryType } from '@/hooks/useTimesheets';
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
}

const entryTypeConfig: Record<string, { icon: React.ElementType; label: string; color: string; bgColor: string; selectedBg: string }> = {
  worked: { icon: Briefcase, label: 'Worked', color: 'text-emerald-700', bgColor: 'bg-emerald-100', selectedBg: 'bg-emerald-500' },
  holiday: { icon: Umbrella, label: 'Holiday', color: 'text-amber-700', bgColor: 'bg-amber-100', selectedBg: 'bg-amber-500' },
  sick: { icon: HeartPulse, label: 'Sick', color: 'text-red-700', bgColor: 'bg-red-100', selectedBg: 'bg-red-500' },
  training: { icon: GraduationCap, label: 'Training', color: 'text-purple-700', bgColor: 'bg-purple-100', selectedBg: 'bg-purple-500' },
  unpaid_leave: { icon: Coffee, label: 'Unpaid Leave', color: 'text-gray-700', bgColor: 'bg-gray-200', selectedBg: 'bg-gray-500' },
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
    if (!entry) {
      // One click = Worked with defaults (Full Day weekday, Half Day weekend)
      const weekend = isWeekend(date);
      const defaultType: DayType = weekend ? 'half_day' : 'full_day';
      const defaults = getDefaults(date, defaultType);
      onEntryUpdate(date, 'worked', defaults.hoursWorked, defaults.startTime, defaults.endTime, defaults.breakMinutes, '');
      return;
    }
    // Already has entry - open popover to edit
    setSelectedDate(date);
    setFormData({
      entryType: entry.entry_type === 'wfh' ? 'worked' : entry.entry_type,
      dayType: isHalfDay(entry) ? 'half_day' : 'full_day',
      notes: entry.notes || '',
    });
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

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        {Object.entries(entryTypeConfig).map(([type, config]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded', config.bgColor)} />
            <span className="text-gray-600">{config.label}</span>
          </div>
        ))}
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-400 mb-3">Click a day to mark as Worked. Click a filled day to edit or change type.</p>

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
                    hasEntry && config && config.bgColor,
                    today && 'ring-2 ring-orange-500 ring-offset-1',
                  )}
                >
                  <span className={cn(
                    'font-medium',
                    today && 'text-orange-600',
                    hasEntry && config?.color
                  )}>
                    {format(day, 'd')}
                  </span>
                  {hasEntry && (
                    <div className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center',
                      config?.selectedBg || 'bg-emerald-500'
                    )}>
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    </div>
                  )}
                  {hasEntry && entry && (entryType === 'worked' || entryType === 'training') && (
                    <span className="text-[10px] text-gray-500">
                      {getDayLabel(entry)}
                    </span>
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

                  {/* Day Type Selection */}
                  <div>
                    <Label className="text-xs text-gray-500 mb-2 block">How did you work this day?</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['full_day', 'half_day'] as DayType[]).map(dt => {
                        const isSelected = formData.dayType === dt && (formData.entryType === 'worked' || formData.entryType === 'training');
                        const label = dt === 'full_day' ? 'Full Day' : 'Half Day';
                        return (
                          <button
                            key={dt}
                            onClick={() => setFormData(prev => ({ ...prev, entryType: 'worked', dayType: dt }))}
                            className={cn(
                              'p-2.5 rounded-lg border-2 text-xs font-medium transition-all',
                              isSelected
                                ? 'bg-emerald-100 border-emerald-500 text-emerald-700'
                                : 'border-gray-200 hover:border-gray-300 text-gray-500'
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3 inline mr-1" />}
                            {label}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setFormData(prev => ({ ...prev, entryType: 'worked', dayType: 'full_day' }))}
                        className={cn(
                          'p-2.5 rounded-lg border-2 text-xs font-medium transition-all border-gray-200 text-gray-400 cursor-default opacity-0 pointer-events-none'
                        )}
                      >
                        {/* spacer */}
                      </button>
                    </div>
                  </div>

                  {/* Entry Type Selection */}
                  <div>
                    <Label className="text-xs text-gray-500 mb-2 block">Or mark as:</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(entryTypeConfig).filter(([type]) => type !== 'worked').map(([type, cfg]) => {
                        const TypeIcon = cfg.icon;
                        const isSelected = formData.entryType === type;
                        return (
                          <button
                            key={type}
                            onClick={() => setFormData(prev => ({ ...prev, entryType: type as TimesheetEntryType }))}
                            className={cn(
                              'flex items-center gap-2 p-2 rounded-lg border-2 text-xs font-medium transition-all',
                              isSelected
                                ? cn(cfg.bgColor, 'border-current', cfg.color)
                                : 'border-gray-200 hover:border-gray-300 text-gray-500'
                            )}
                          >
                            <TypeIcon className={cn('h-3.5 w-3.5', isSelected ? cfg.color : 'text-gray-400')} />
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <Label className="text-xs">Notes (optional)</Label>
                    <Textarea value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} placeholder="Add any notes..." className="h-16 resize-none" />
                  </div>

                  <Button onClick={handleSave} className="w-full bg-emerald-600 hover:bg-emerald-700">
                    {entry ? 'Update Entry' : 'Save Entry'}
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
