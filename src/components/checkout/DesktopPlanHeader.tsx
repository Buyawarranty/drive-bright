import React, { useState } from 'react';
import { CheckCircle, Calendar as CalendarIcon, Car, Mail, Headphones, Pencil, ChevronDown } from 'lucide-react';
import { format, isToday, startOfDay, addDays, isBefore, isAfter } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
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
  onChangeVehicle?: () => void;
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
  onChangeVehicle,
}) => {
  const [isEditMenuOpen, setIsEditMenuOpen] = useState(false);
  const [isChoosingDate, setIsChoosingDate] = useState(false);
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
      setIsChoosingDate(false);
      setIsEditMenuOpen(false);
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
      <div className="flex items-center justify-between gap-4 mt-5 py-4 border-t border-b border-border">
        <div className="flex items-center gap-3">
          <Car className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">{vehicleDisplay}</span>
          {vehicleReg && (
            <span className="inline-flex items-center px-2 py-0.5 rounded border border-warning bg-warning/10 text-xs font-bold text-foreground tracking-wide">
              {vehicleReg.toUpperCase()}
            </span>
          )}
        </div>
        <Popover open={isEditMenuOpen} onOpenChange={(open) => {
          setIsEditMenuOpen(open);
          if (!open) setIsChoosingDate(false);
        }}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="flex-shrink-0 border-border bg-background text-foreground">
              <Pencil className="w-4 h-4" />
              Edit details
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="end">
            {isChoosingDate ? (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-1 w-full justify-start"
                  onClick={() => setIsChoosingDate(false)}
                >
                  Back to edit options
                </Button>
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={handleDateSelect}
                  disabled={isDateDisabled}
                  initialFocus
                  className={cn("p-1 pointer-events-auto")}
                />
              </div>
            ) : (
              <div className="space-y-1">
                {onChangeVehicle && (
                  <Button variant="ghost" className="w-full justify-start" onClick={onChangeVehicle}>
                    <Car className="w-4 h-4 text-muted-foreground" />
                    Change vehicle
                  </Button>
                )}
                {onEditPlan && (
                  <Button variant="ghost" className="w-full justify-start" onClick={onEditPlan}>
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                    Edit cover
                  </Button>
                )}
                {onStartDateChange && (
                  <Button variant="ghost" className="w-full justify-start" onClick={() => setIsChoosingDate(true)}>
                    <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                    Change start date
                  </Button>
                )}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Cover Start Date */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-[#0BA360]" />
          <span className="text-sm text-[#1a1a1a]">
            Cover starts <span className="font-semibold">{formatStartDate()}</span>
          </span>
        </div>
      </div>

      {/* Reassurance information */}
      <div className="grid grid-cols-2 mt-4 border-t border-border pt-4">
        <div className="pr-5">
          <div className="flex items-start gap-2 mb-1.5">
            <Mail className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <span className="text-xs font-bold text-foreground leading-tight">Documents emailed instantly</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug pl-6">
            Your policy documents arrive in seconds.
          </p>
        </div>
        <div className="pl-5 border-l border-border">
          <div className="flex items-start gap-2 mb-1.5">
            <Headphones className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <span className="text-xs font-bold text-foreground leading-tight">Claims handled by real people</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug pl-6">
            0330 229 5045<br/>Mon–Fri 9am–5pm
          </p>
        </div>
      </div>
    </div>
  );
};

export default DesktopPlanHeader;