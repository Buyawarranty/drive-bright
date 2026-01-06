import React, { useState } from 'react';
import { useLeadReminders, ReminderPreset } from '@/hooks/useLeadReminders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, BellRing, Clock, Calendar as CalendarIcon, 
  Sun, Sunrise, CalendarDays, X, Check, AlarmClock
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface RemindMePopoverProps {
  leadId: string;
  compact?: boolean;
}

export const RemindMePopover: React.FC<RemindMePopoverProps> = ({ leadId, compact = false }) => {
  const { currentReminder, createReminder, snoozeReminder, dismissReminder, completeReminder } = useLeadReminders(leadId);
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [customTime, setCustomTime] = useState('09:00');
  const [label, setLabel] = useState('');
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);

  const handlePresetSelect = async (preset: ReminderPreset) => {
    if (preset === 'custom') {
      setShowCustom(true);
      return;
    }
    
    await createReminder(leadId, preset, undefined, label || undefined);
    setLabel('');
    setOpen(false);
  };

  const handleCustomSubmit = async () => {
    if (!customDate) return;
    
    const [hours, minutes] = customTime.split(':').map(Number);
    const dateTime = new Date(customDate);
    dateTime.setHours(hours, minutes, 0, 0);
    
    await createReminder(leadId, 'custom', dateTime, label || undefined);
    setCustomDate(undefined);
    setCustomTime('09:00');
    setLabel('');
    setShowCustom(false);
    setOpen(false);
  };

  const handleSnooze = async (preset: ReminderPreset) => {
    if (!currentReminder) return;
    await snoozeReminder(currentReminder.id, preset);
    setShowSnoozeOptions(false);
    setOpen(false);
  };

  const handleDismiss = async () => {
    if (!currentReminder) return;
    await dismissReminder(currentReminder.id);
    setOpen(false);
  };

  const handleComplete = async () => {
    if (!currentReminder) return;
    await completeReminder(currentReminder.id);
    setOpen(false);
  };

  const getReminderStatus = () => {
    if (!currentReminder) return null;
    
    const reminderTime = new Date(currentReminder.reminder_time);
    if (isPast(reminderTime)) {
      return { label: 'Overdue', color: 'bg-red-500 text-white', urgent: true };
    }
    if (isToday(reminderTime)) {
      return { label: 'Today', color: 'bg-amber-500 text-white', urgent: true };
    }
    if (isTomorrow(reminderTime)) {
      return { label: 'Tomorrow', color: 'bg-yellow-400 text-yellow-900', urgent: false };
    }
    return { label: format(reminderTime, 'MMM d'), color: 'bg-blue-100 text-blue-800', urgent: false };
  };

  const status = getReminderStatus();

  // If there's an active reminder, show reminder badge
  if (currentReminder && !open) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 gap-1.5 px-2",
              status?.urgent && "animate-pulse"
            )}
          >
            <BellRing className={cn("h-3.5 w-3.5", status?.urgent && "text-amber-500")} />
            <Badge className={cn("text-[10px] px-1.5 py-0", status?.color)}>
              {status?.label}
            </Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">Reminder</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(currentReminder.reminder_time), 'EEE, MMM d • h:mm a')}
                </p>
                {currentReminder.label && (
                  <p className="text-sm mt-1 text-foreground">{currentReminder.label}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {showSnoozeOptions ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Snooze until</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => handleSnooze('today')}>
                    Later today
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => handleSnooze('tomorrow')}>
                    Tomorrow
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => handleSnooze('next_week')}>
                    Next week
                  </Button>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-xs"
                  onClick={() => setShowSnoozeOptions(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  onClick={() => setShowSnoozeOptions(true)}
                >
                  <AlarmClock className="h-3.5 w-3.5" />
                  Snooze
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  onClick={handleDismiss}
                >
                  <X className="h-3.5 w-3.5" />
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  onClick={handleComplete}
                >
                  <Check className="h-3.5 w-3.5" />
                  Done
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Create new reminder button
  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      if (!o) {
        setShowCustom(false);
        setCustomDate(undefined);
        setLabel('');
      }
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1.5",
            compact ? "h-7 px-2 text-xs" : "h-8"
          )}
        >
          <Bell className="h-3.5 w-3.5" />
          {!compact && "Remind me"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        {showCustom ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">Pick date & time</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowCustom(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            <Calendar
              mode="single"
              selected={customDate}
              onSelect={setCustomDate}
              disabled={(date) => date < new Date()}
              className="rounded-md border"
            />
            
            <div className="flex gap-2">
              <Input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                disabled={!customDate}
                onClick={handleCustomSubmit}
              >
                Set
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="font-medium text-sm">Remind me</p>
            
            {/* Label input */}
            <Input
              placeholder="Add a note (optional)"
              value={label}
              onChange={(e) => setLabel(e.target.value.slice(0, 120))}
              className="text-sm"
              maxLength={120}
            />
            
            {/* Preset options */}
            <div className="space-y-1">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-9"
                onClick={() => handlePresetSelect('today')}
              >
                <Sun className="h-4 w-4 text-amber-500" />
                <span className="flex-1 text-left">Later today</span>
                <span className="text-xs text-muted-foreground">5:00 PM</span>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-9"
                onClick={() => handlePresetSelect('tomorrow')}
              >
                <Sunrise className="h-4 w-4 text-orange-500" />
                <span className="flex-1 text-left">Tomorrow</span>
                <span className="text-xs text-muted-foreground">9:00 AM</span>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-9"
                onClick={() => handlePresetSelect('next_week')}
              >
                <CalendarDays className="h-4 w-4 text-blue-500" />
                <span className="flex-1 text-left">Next week</span>
                <span className="text-xs text-muted-foreground">Mon 9:00 AM</span>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-9"
                onClick={() => handlePresetSelect('custom')}
              >
                <CalendarIcon className="h-4 w-4 text-purple-500" />
                <span className="flex-1 text-left">Pick date & time</span>
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
