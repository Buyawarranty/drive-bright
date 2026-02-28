import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Clock, Calendar, Coffee, ChevronDown, ChevronRight, CalendarPlus } from 'lucide-react';
import { useAgentSchedules } from '@/hooks/useAgentSchedules';

interface AgentSchedulePanelProps {
  adminUserId: string;
  agentName: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const AgentSchedulePanel: React.FC<AgentSchedulePanelProps> = ({
  adminUserId,
  agentName,
}) => {
  const { schedules, loading, initializeWeek, updateSchedule } = useAgentSchedules(adminUserId);
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className="mt-3 p-2 bg-muted/30 rounded animate-pulse">
        <div className="h-4 w-24 bg-muted rounded" />
      </div>
    );
  }

  const hasSchedule = schedules.length > 0;
  const today = new Date().getDay();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <Calendar className="h-3 w-3" />
          Schedule & Availability
          {hasSchedule && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-auto">
              {schedules.filter(s => s.is_available).length}/7 days
            </Badge>
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        {!hasSchedule ? (
          <div className="text-center py-3 bg-muted/20 rounded-lg border border-dashed">
            <p className="text-xs text-muted-foreground mb-2">No schedule configured</p>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={initializeWeek}>
              <CalendarPlus className="h-3 w-3" />
              Set Up Weekly Schedule
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {schedules.map(schedule => (
              <div
                key={schedule.day_of_week}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                  schedule.day_of_week === today
                    ? 'bg-primary/5 border border-primary/20'
                    : schedule.is_available
                      ? 'bg-muted/20'
                      : 'bg-muted/10 opacity-60'
                }`}
              >
                {/* Day + availability toggle */}
                <div className="flex items-center gap-1.5 w-[60px]">
                  <Switch
                    checked={schedule.is_available}
                    onCheckedChange={(checked) => updateSchedule(schedule.day_of_week, { is_available: checked })}
                    className="scale-75"
                  />
                  <span className={`font-medium ${schedule.day_of_week === today ? 'text-primary' : ''}`}>
                    {DAY_NAMES[schedule.day_of_week]}
                  </span>
                </div>

                {schedule.is_available ? (
                  <>
                    {/* Shift times */}
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <Input
                        type="time"
                        value={schedule.shift_start}
                        onChange={(e) => updateSchedule(schedule.day_of_week, { shift_start: e.target.value })}
                        className="h-6 w-[85px] text-[11px] px-1"
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        value={schedule.shift_end}
                        onChange={(e) => updateSchedule(schedule.day_of_week, { shift_end: e.target.value })}
                        className="h-6 w-[85px] text-[11px] px-1"
                      />
                    </div>

                    {/* Break period */}
                    <div className="flex items-center gap-1 ml-1">
                      <Coffee className="h-3 w-3 text-muted-foreground" />
                      <Input
                        type="time"
                        value={schedule.break_start || ''}
                        placeholder="--:--"
                        onChange={(e) => updateSchedule(schedule.day_of_week, { break_start: e.target.value || null })}
                        className="h-6 w-[85px] text-[11px] px-1"
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        value={schedule.break_end || ''}
                        placeholder="--:--"
                        onChange={(e) => updateSchedule(schedule.day_of_week, { break_end: e.target.value || null })}
                        className="h-6 w-[85px] text-[11px] px-1"
                      />
                    </div>
                  </>
                ) : (
                  <span className="text-muted-foreground italic">Off</span>
                )}
              </div>
            ))}

            <div className="text-[10px] text-muted-foreground pt-1 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" /> Shift &nbsp;
              <Coffee className="h-2.5 w-2.5" /> Break
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
