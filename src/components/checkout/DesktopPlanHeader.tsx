import React, { useState } from 'react';
import { CheckCircle, Check, Calendar as CalendarIcon } from 'lucide-react';
import { format, isToday, startOfDay, addDays, isBefore, isAfter } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DesktopPlanHeaderProps {
  vehicleReg: string;
  vehicleMake?: string;
  vehicleModel?: string;
  duration: string;
  startDate?: Date;
  onStartDateChange?: (date: Date | undefined) => void;
}

const DesktopPlanHeader: React.FC<DesktopPlanHeaderProps> = ({
  vehicleReg,
  vehicleMake,
  vehicleModel,
  duration,
  startDate,
  onStartDateChange,
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const vehicleDisplay = [vehicleMake, vehicleModel].filter(Boolean).join(' ') || '';
  const today = startOfDay(new Date());
  const maxDate = addDays(today, 365);
  
  const formatStartDate = () => {
    if (!startDate) return 'Today';
    if (isToday(startDate)) return `Today (${format(startDate, 'd MMM yyyy')})`;
    return format(startDate, 'd MMM yyyy');
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date && onStartDateChange) {
      onStartDateChange(date);
      setIsCalendarOpen(false);
    }
  };

  const isDateDisabled = (date: Date) => {
    const dateStart = startOfDay(date);
    return isBefore(dateStart, today) || isAfter(dateStart, maxDate);
  };

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-5 sm:p-6">
      {/* Success Header */}
      <div className="flex items-start gap-3 mb-4">
        <CheckCircle className="w-6 h-6 text-[#0BA360] flex-shrink-0 mt-0.5" />
        <h2 className="text-lg sm:text-xl font-bold text-[#1a1a1a]">
          Your comprehensive vehicle plan is ready.
        </h2>
      </div>

      {/* Brief Bullet List */}
      <div className="space-y-2.5 mb-4">
        <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
          <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
          <span>
            {vehicleDisplay && (
              <>
                <span className="font-medium">{vehicleDisplay.toUpperCase()}</span>
                {' '}
              </>
            )}
            <span 
              className="font-mono font-bold text-xs uppercase px-1.5 py-0.5 rounded border border-black inline-block"
              style={{ backgroundColor: '#FCD34D' }}
            >
              {vehicleReg}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
          <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
          <span>Comprehensive – {duration} cover</span>
        </div>
        {duration.toLowerCase().includes('2 year') && (
          <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
            <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
            <span className="font-semibold">No payments in year 2</span>
          </div>
        )}
        {duration.toLowerCase().includes('3 year') && (
          <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
            <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
            <span className="font-semibold">No payments in years 2 and 3</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-[#E5E5E5] my-5" />

      {/* Cover Start Date with inline calendar picker */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-[#0BA360]" />
          <span className="text-sm text-[#1a1a1a]">
            Cover starts <span className="font-semibold">{formatStartDate()}</span>
          </span>
        </div>
        {onStartDateChange && (
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="text-sm text-gray-600 hover:text-[#1a1a1a] underline">
                Change date
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={handleDateSelect}
                disabled={isDateDisabled}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
};

export default DesktopPlanHeader;
