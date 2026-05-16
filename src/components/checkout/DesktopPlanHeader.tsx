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
      <div className="flex items-start gap-3 mb-1">
        <CheckCircle className="w-6 h-6 text-[#0BA360] flex-shrink-0 mt-0.5" />
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#1a1a1a]">
            Your {vehicleDisplay || 'vehicle'} is nearly protected
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Almost there – complete your details to activate your cover.
          </p>
        </div>
      </div>

      {/* Vehicle row */}
      <div className="flex items-center justify-between mt-5 py-4 border-t border-b border-[#E5E5E5]">
        <div className="flex items-center gap-3">
          <Car className="w-5 h-5 text-gray-500" />
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
            className="text-sm font-semibold text-[#0BA360] hover:text-[#098a51] underline underline-offset-2 transition-colors"
          >
            Edit cover
          </button>
        )}
      </div>

      {/* Cover Start Date */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-[#0BA360]" />
          <span className="text-sm text-[#1a1a1a]">
            Cover starts <span className="font-semibold">{formatStartDate()}</span>
          </span>
        </div>
        {onStartDateChange && (
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="text-sm font-semibold text-[#0BA360] hover:text-[#098a51] underline underline-offset-2 transition-colors">
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

      {/* Three benefit boxes */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="bg-[#F0FAF4] border border-[#B8E2CE] rounded-lg p-3">
          <div className="flex items-start gap-2 mb-1.5">
            <Mail className="w-4 h-4 text-[#0BA360] flex-shrink-0 mt-0.5" />
            <span className="text-xs font-bold text-[#1a1a1a] leading-tight">Documents emailed instantly</span>
          </div>
          <p className="text-[11px] text-gray-600 leading-snug">
            Your policy documents arrive in seconds.
          </p>
        </div>
        <div className="bg-[#F0FAF4] border border-[#B8E2CE] rounded-lg p-3">
          <div className="flex items-start gap-2 mb-1.5">
            <Shield className="w-4 h-4 text-[#0BA360] flex-shrink-0 mt-0.5" />
            <span className="text-xs font-bold text-[#1a1a1a] leading-tight">Cover starts immediately</span>
          </div>
          <p className="text-[11px] text-gray-600 leading-snug">
            You're protected as soon as your payment is confirmed.
          </p>
        </div>
        <div className="bg-[#F0FAF4] border border-[#B8E2CE] rounded-lg p-3">
          <div className="flex items-start gap-2 mb-1.5">
            <Headphones className="w-4 h-4 text-[#0BA360] flex-shrink-0 mt-0.5" />
            <span className="text-xs font-bold text-[#1a1a1a] leading-tight">Claims handled by real people</span>
          </div>
          <p className="text-[11px] text-gray-600 leading-snug">
            0330 229 5040<br/>Mon–Fri 9am–6pm · Sat 10am–5pm
          </p>
        </div>
      </div>
    </div>
  );
};

export default DesktopPlanHeader;