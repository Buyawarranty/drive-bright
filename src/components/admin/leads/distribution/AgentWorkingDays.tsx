import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar } from 'lucide-react';
import { useAgentSchedules } from '@/hooks/useAgentSchedules';

interface AgentWorkingDaysProps {
  adminUserId: string;
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const AgentWorkingDays: React.FC<AgentWorkingDaysProps> = ({ adminUserId }) => {
  const { schedules, loading, initializeWeek, updateSchedule } = useAgentSchedules(adminUserId);
  const today = new Date().getDay();

  const handleToggle = async (dayOfWeek: number) => {
    if (schedules.length === 0) {
      await initializeWeek();
      return;
    }
    const current = schedules.find(s => s.day_of_week === dayOfWeek);
    await updateSchedule(dayOfWeek, { is_available: !current?.is_available });
  };

  if (loading) {
    return <div className="h-7 w-48 bg-muted/40 rounded animate-pulse" />;
  }

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
        <Calendar className="h-3.5 w-3.5" />
        Working days:
      </div>
      <div className="flex items-center gap-1">
        {DAY_LABELS.map((label, idx) => {
          const schedule = schedules.find(s => s.day_of_week === idx);
          const isOn = schedule?.is_available ?? false;
          const isToday = idx === today;
          return (
            <Tooltip key={idx}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggle(idx)}
                  className={`h-7 w-7 p-0 text-xs font-semibold rounded-full border transition-colors ${
                    isOn
                      ? 'bg-green-600 text-white border-green-700 hover:bg-green-700 hover:text-white'
                      : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                  } ${isToday ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                >
                  {label}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {DAY_FULL[idx]} — {isOn ? 'Working (click to turn off)' : 'Off (click to turn on)'}
                {isToday && ' • Today'}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      {schedules.length === 0 && (
        <span className="text-[10px] text-muted-foreground italic ml-1">Click any day to set up</span>
      )}
    </div>
  );
};
