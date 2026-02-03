import React from 'react';
import { CheckCircle, Check, Calendar } from 'lucide-react';
import { format, isToday } from 'date-fns';

interface DesktopPlanHeaderProps {
  vehicleReg: string;
  vehicleMake?: string;
  vehicleModel?: string;
  duration: string;
  startDate?: Date;
  onChangeDate?: () => void;
}

const DesktopPlanHeader: React.FC<DesktopPlanHeaderProps> = ({
  vehicleReg,
  vehicleMake,
  vehicleModel,
  duration,
  startDate,
  onChangeDate,
}) => {
  const vehicleDisplay = [vehicleMake, vehicleModel].filter(Boolean).join(' ') || '';
  
  const formatStartDate = () => {
    if (!startDate) return 'Today';
    if (isToday(startDate)) return `Today (${format(startDate, 'd MMM yyyy')})`;
    return format(startDate, 'd MMM yyyy');
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
        <div className="flex items-center gap-2 text-sm text-[#1a1a1a]">
          <Check className="w-4 h-4 text-[#0BA360] flex-shrink-0" />
          <span>Cancel anytime within 14 days for a full refund</span>
        </div>
      </div>


      {/* Divider */}
      <div className="h-px bg-[#E5E5E5] my-5" />

      {/* Cover Start Date */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#0BA360]" />
          <span className="text-sm text-[#1a1a1a]">
            Cover starts <span className="font-semibold">{formatStartDate()}</span>
          </span>
        </div>
        {onChangeDate && (
          <button
            onClick={onChangeDate}
            className="text-sm text-gray-600 hover:text-[#1a1a1a] underline"
          >
            Change date
          </button>
        )}
      </div>
    </div>
  );
};

export default DesktopPlanHeader;
