import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWeekend, addMonths, subMonths, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Briefcase, Umbrella, HeartPulse, GraduationCap, Coffee, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TimesheetEntry, TimesheetEntryType } from '@/hooks/useTimesheets';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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

function getDefaults(date: Date) {
  const weekend = isWeekend(date);
  return {
    startTime: '09:00',
    endTime: weekend ? '14:00' : '18:00',
    hoursWorked: weekend ? 5 : 9,
    breakMinutes: weekend ? 0 : 30,
  };
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
    hoursWorked: 9,
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: 30,
    notes: '',
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = monthStart.getDay();

  const getEntryForDate = (date: Date) => {
    return entries.find(e => isSameDay(new Date(e.entry_date), date));
  };

  const handleDayClick = (date: Date, entry?: TimesheetEntry) => {
    if (!entry) {
      // One click = Worked with defaults
      const defaults = getDefaults(date);
      onEntryUpdate(date, 'worked', defaults.hoursWorked, defaults.startTime, defaults.endTime, defaults.breakMinutes, '');
      return;
    }
    // Already has entry - open popover to edit
    setSelectedDate(date);
    setFormData({
      entryType: entry.entry_type === 'wfh' ? 'worked' : entry.entry_type,
      hoursWorked: entry.hours_worked || getDefaults(date).hoursWorked,
      startTime: entry.start_time || '09:00',
      endTime: entry.end_time || getDefaults(date).endTime,
      breakMinutes: entry.break_minutes || 0,
      notes: entry.notes || '',
    });
  };

  const handleSave = async () => {
    if (!selectedDate) return;
    await onEntryUpdate(
      selectedDate,
      formData.entryType,
      formData.hoursWorked,
      formData.startTime,
      formData.endTime,
      formData.breakMinutes,
      formData.notes
    );
    setSelectedDate(null);
  };

  const handleDelete = async () => {
    if (!selectedDate) return;
    await onEntryDelete(selectedDate);
    setSelectedDate(null);
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">{day}</div>
        ))}

        {Array.from({ length: startPadding }).map((_, i) => (
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
                    weekend && !hasEntry && 'bg-gray-50 text-gray-400',
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
                  {entry?.hours_worked && entry.hours_worked > 0 && (
                    <span className="text-[10px] text-gray-500">{entry.hours_worked}h</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4 pointer-events-auto" align="start">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{format(day, 'EEEE, d MMMM')}</h3>
                    {entry && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={handleDelete}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Entry Type Selection - big clear buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(entryTypeConfig).map(([type, cfg]) => {
                      const TypeIcon = cfg.icon;
                      const isSelected = formData.entryType === type;
                      return (
                        <button
                          key={type}
                          onClick={() => {
                            const defaults = getDefaults(day);
                            if (type === 'worked' || type === 'training') {
                              setFormData(prev => ({ ...prev, entryType: type as TimesheetEntryType, ...defaults }));
                            } else {
                              setFormData(prev => ({ ...prev, entryType: type as TimesheetEntryType, hoursWorked: 0, startTime: '', endTime: '' }));
                            }
                          }}
                          className={cn(
                            'flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-all relative',
                            isSelected
                              ? cn(cfg.bgColor, 'border-current', cfg.color)
                              : 'border-gray-200 hover:border-gray-300'
                          )}
                        >
                          {isSelected && (
                            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                              <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                            </div>
                          )}
                          <TypeIcon className={cn('h-4 w-4', isSelected ? cfg.color : 'text-gray-400')} />
                          <span className={cn('text-xs font-medium', isSelected ? cfg.color : 'text-gray-500')}>{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Time inputs - only for worked/training */}
                  {(formData.entryType === 'worked' || formData.entryType === 'training') && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Start</Label>
                        <Input type="time" value={formData.startTime} onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))} className="h-8" />
                      </div>
                      <div>
                        <Label className="text-xs">End</Label>
                        <Input type="time" value={formData.endTime} onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))} className="h-8" />
                      </div>
                      <div>
                        <Label className="text-xs">Hours</Label>
                        <Input type="number" min="0" max="24" step="0.5" value={formData.hoursWorked} onChange={(e) => setFormData(prev => ({ ...prev, hoursWorked: parseFloat(e.target.value) || 0 }))} className="h-8" />
                      </div>
                      <div>
                        <Label className="text-xs">Break (min)</Label>
                        <Input type="number" min="0" max="120" step="5" value={formData.breakMinutes} onChange={(e) => setFormData(prev => ({ ...prev, breakMinutes: parseInt(e.target.value) || 0 }))} className="h-8" />
                      </div>
                    </div>
                  )}

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
