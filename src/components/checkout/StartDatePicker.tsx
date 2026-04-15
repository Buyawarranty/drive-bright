import React, { useState, useEffect } from 'react';
import { format, addDays, isAfter, isBefore, startOfDay, isToday } from 'date-fns';
import { CalendarIcon, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface StartDatePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  maxDaysAhead?: number;
  allowPastDates?: boolean;
  hideHeader?: boolean;
  hideHelperText?: boolean;
  error?: string;
  className?: string;
}

export const StartDatePicker: React.FC<StartDatePickerProps> = ({
  value,
  onChange,
  maxDaysAhead = 365,
  allowPastDates = false,
  error,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
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
      setIsCalendarOpen(false);
      setIsExpanded(false);
    }
  };

  const handleStartToday = () => {
    onChange(today);
    setIsExpanded(false);
  };

  const isDateDisabled = (date: Date) => {
    const dateStart = startOfDay(date);
    if (allowPastDates) {
      return isAfter(dateStart, maxDate);
    }
    return isBefore(dateStart, today) || isAfter(dateStart, maxDate);
  };

  const isSelectedToday = value && isToday(value);

  // Collapsed State
  if (!isExpanded) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm font-medium text-green-800">
              Cover starts {isSelectedToday ? 'today' : format(value || today, 'd MMM yyyy')} 
              {isSelectedToday && <span className="text-gray-600 font-normal"> ({format(today, 'd MMM yyyy')})</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="text-sm font-medium text-green-700 hover:text-green-800 underline underline-offset-2"
          >
            Change Date
          </button>
        </div>

        {/* What happens after you pay */}
        <div className="pt-1">
          <p className="text-sm font-bold text-[#1a1a1a] mb-3">What happens after you pay</p>
          <div className="space-y-2.5">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0BA360] text-white text-xs font-bold flex items-center justify-center mt-0.5">1</span>
              <p className="text-sm text-gray-700">Policy emailed instantly – your documents arrive in seconds</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0BA360] text-white text-xs font-bold flex items-center justify-center mt-0.5">2</span>
              <p className="text-sm text-gray-700">Cover starts today – you're protected from this moment</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#0BA360] text-white text-xs font-bold flex items-center justify-center mt-0.5">3</span>
              <p className="text-sm text-gray-700">Claim anytime — online or by phone <span className="font-semibold">0330 229 5045</span></p>
            </div>
          </div>
        </div>
        
        {error && (
          <p className="text-red-500 text-sm flex items-center gap-1" role="alert">
            <span className="inline-block w-4 h-4 rounded-full bg-red-100 flex items-center justify-center text-xs">!</span>
            {error}
          </p>
        )}
      </div>
    );
  }

  // Expanded State
  return (
    <div className={cn("space-y-3", className)}>
      {/* Only show billing note when a future date is selected (not today) */}
      {value && !isToday(value) && (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Note:</span> You can choose when your cover starts, but payment is processed today — whether paying monthly or in full.
            </p>
          </div>
          <p className="text-sm text-gray-600">
            Your cover will <span className="font-bold text-black">start on</span> <span className="font-medium text-gray-900">{format(value, 'd MMM yyyy')}</span>. Your plan is confirmed and <span className="font-bold text-black">billed today</span>.
          </p>
        </>
      )}
      <p className="text-sm font-semibold text-gray-900">Choose Start Date</p>
      
      {/* Start Today Option */}
      <button
        type="button"
        onClick={handleStartToday}
        className={cn(
          "w-full flex items-center gap-2 p-3 rounded-lg border-2 transition-all duration-200 text-left",
          isSelectedToday
            ? "border-green-500 bg-green-50 text-green-700"
            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
        )}
      >
        <CheckCircle className={cn(
          "w-5 h-5 flex-shrink-0",
          isSelectedToday ? "text-green-600" : "text-gray-400"
        )} />
        <span className="font-medium">Start Today</span>
        <span className="text-xs text-gray-500 ml-1">(Recommended)</span>
      </button>

      {/* Future Date Option */}
      <div className="space-y-2">
        <p className="text-xs text-gray-500">Or select a future date:</p>
        
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "w-full flex items-center gap-2 p-3 rounded-lg border-2 transition-all duration-200 text-left",
                value && !isSelectedToday
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              <CalendarIcon className={cn(
                "w-5 h-5 flex-shrink-0",
                value && !isSelectedToday ? "text-green-600" : "text-gray-400"
              )} />
              <span className="font-medium">
                {value && !isSelectedToday 
                  ? format(value, 'd MMM yyyy')
                  : "Pick a date"
                }
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center" sideOffset={8}>
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

      {/* Cancel link */}
      <button
        type="button"
        onClick={() => setIsExpanded(false)}
        className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
      >
        Cancel
      </button>

      {error && (
        <p className="text-red-500 text-sm flex items-center gap-1" role="alert">
          <span className="inline-block w-4 h-4 rounded-full bg-red-100 flex items-center justify-center text-xs">!</span>
          {error}
        </p>
      )}
    </div>
  );
};

export default StartDatePicker;
