import React, { useState } from 'react';
import { CheckCircle, Calendar as CalendarIcon, Car, Mail, Shield, Headphones } from 'lucide-react';
import { format, isToday, startOfDay, addDays, isBefore, isAfter } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DesktopPlanHeaderProps {
  vehicleReg: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  duration: string;
  claimLimit: number;
  labourRate: number;
  excess: number;
  startDate?: Date;
  onStartDateChange?: (date: Date | undefined) => void;
  onEditPlan?: () => void;
}

const DesktopPlanHeader: React.FC<DesktopPlanHeaderProps> = ({
  vehicleReg,
  vehicleMake,
  vehicleModel,
  vehicleYear,
  duration,
  claimLimit,
  labourRate,
  excess,
  startDate,
  onStartDateChange,
  onEditPlan,
}) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const vehicleDisplay = [vehicleYear, vehicleMake?.toUpperCase(), vehicleModel?.toUpperCase()].filter(Boolean).join(' ') || '';
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

  const displayClaimLimit = claimLimit >= 2000 
    ? `£${claimLimit.toLocaleString()}` 
    : `£${claimLimit.toLocaleString()}`;

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl p-5 sm:p-6">
      {/* Success Header */}
      <div className="flex items-start gap-3 mb-4">
        <CheckCircle className="w-6 h-6 text-[#0BA360] flex-shrink-0 mt-0.5" />
        <h2 className="text-lg sm:text-xl font-bold text-[#1a1a1a]">
          Almost done – just a few details
        </h2>
      </div>

      {/* Vehicle & Plan Info */}
      <div className="bg-[#FAFAFA] rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-[#1a1a1a]">{vehicleDisplay}</span>
            {vehicleReg && (
              <span className="inline-flex items-center px-2 py-0.5 rounded border border-[#D4A843] bg-[#FFF8E7] text-xs font-bold text-[#1a1a1a] tracking-wide">
                {vehicleReg.toUpperCase()}
              </span>
            )}
          </div>
          {onEditPlan && (
            <button
              onClick={onEditPlan}
              className="flex items-center gap-1 text-xs font-semibold text-[#C4841D] hover:text-[#A36A15] transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          )}
        </div>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Cover duration</span>
            <span className="font-semibold text-[#1a1a1a]">{duration}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Claim limit</span>
            <span className="font-semibold text-[#1a1a1a]">{displayClaimLimit}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Your excess</span>
            <span className="font-semibold text-[#1a1a1a]">£{excess} per claim</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Labour rate</span>
            <span className="font-semibold text-[#1a1a1a]">Up to £{labourRate}/hr</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Parts covered</span>
            <span className="font-semibold text-[#1a1a1a]">Comprehensive cover</span>
          </div>
        </div>
      </div>

      {/* Brief info */}
      <div className="space-y-2.5 mb-4">
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

      {/* Questions before you buy */}
      <div className="mt-5 bg-[#F4F4F5] rounded-xl p-5 text-center">
        <p className="text-sm text-gray-700 mb-1">Questions before you buy?</p>
        <a
          href="tel:03302295040"
          className="block text-2xl font-extrabold text-[#1a1a1a] tracking-wide hover:underline"
        >
          0330 229 5040
        </a>
        <p className="text-sm text-gray-600 mt-1">Mon–Fri 9am to 6pm · Sat 10am to 5pm</p>
      </div>
    </div>
  );
};

export default DesktopPlanHeader;