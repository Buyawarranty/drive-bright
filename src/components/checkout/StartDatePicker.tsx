import React, { useState, useEffect } from 'react';
import { format, addDays, isAfter, isBefore, startOfDay, isToday } from 'date-fns';
import { CalendarIcon, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';

interface StartDatePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  maxDaysAhead?: number;
  error?: string;
  className?: string;
}

export const StartDatePicker: React.FC<StartDatePickerProps> = ({
  value,
  onChange,
  maxDaysAhead = 365,
  error,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const today = startOfDay(new Date());
  const maxDate = addDays(today, maxDaysAhead);

  // Default to today if no value
  useEffect(() => {
    if (!value) {
      onChange(today);
    }
  }, []);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(date);
      setIsOpen(false);
    }
  };

  const handleStartToday = () => {
    onChange(today);
    setIsOpen(false);
  };

  const isDateDisabled = (date: Date) => {
    const dateStart = startOfDay(date);
    return isBefore(dateStart, today) || isAfter(dateStart, maxDate);
  };

  const formatDisplayDate = (date: Date | undefined) => {
    if (!date) return 'Select a date';
    if (isToday(date)) return `Today (${format(date, 'd MMM yyyy')})`;
    return format(date, 'd MMM yyyy');
  };

  const isSelectedToday = value && isToday(value);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <Clock className="w-4 h-4 text-green-600" />
        </div>
        <div>
          <Label 
            htmlFor="start-date" 
            className="text-base font-semibold text-gray-900"
          >
            Choose Your Start Date <span className="text-red-500">*</span>
          </Label>
        </div>
      </div>

      {/* Quick Options */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <button
          type="button"
          onClick={handleStartToday}
          className={cn(
            "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all duration-200",
            isSelectedToday
              ? "border-green-500 bg-green-50 text-green-700 shadow-sm"
              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
          )}
          aria-pressed={isSelectedToday}
        >
          <CheckCircle className={cn(
            "w-5 h-5",
            isSelectedToday ? "text-green-600" : "text-gray-400"
          )} />
          <span className="font-medium">Start Today</span>
        </button>

        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all duration-200",
                value && !isSelectedToday
                  ? "border-green-500 bg-green-50 text-green-700 shadow-sm"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              )}
              aria-haspopup="dialog"
              aria-expanded={isOpen}
            >
              <CalendarIcon className={cn(
                "w-5 h-5",
                value && !isSelectedToday ? "text-green-600" : "text-gray-400"
              )} />
              <span className="font-medium">
                {value && !isSelectedToday 
                  ? format(value, 'd MMM yyyy')
                  : "Choose Date"
                }
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center" sideOffset={8}>
            <div className="p-3 border-b bg-gray-50">
              <p className="text-sm font-medium text-gray-700">
                Select your cover start date
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Up to {maxDaysAhead} days from today
              </p>
            </div>
            <Calendar
              mode="single"
              selected={value}
              onSelect={handleSelect}
              disabled={isDateDisabled}
              initialFocus
              className="p-3 pointer-events-auto"
              modifiers={{
                today: today,
              }}
              modifiersClassNames={{
                today: "bg-orange-100 text-orange-700 font-bold",
                selected: "bg-green-600 text-white hover:bg-green-700",
                disabled: "text-gray-300 cursor-not-allowed",
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Selected Date Display */}
      {value && (
        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">
              Your cover starts: <span className="font-bold">{formatDisplayDate(value)}</span>
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <p className="text-red-500 text-sm mt-1 flex items-center gap-1" role="alert" aria-live="polite">
          <span className="inline-block w-4 h-4 rounded-full bg-red-100 flex items-center justify-center text-xs">!</span>
          {error}
        </p>
      )}

      {/* Helper Text */}
      <p className="text-xs text-gray-500 leading-relaxed">
        Start your warranty today or schedule it for any date up to 365 days ahead.
        <br />
        <span className="text-green-600 font-medium">✔ Instant confirmation! 🔔</span>
      </p>
    </div>
  );
};

export default StartDatePicker;
