import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLeadReminders, ReminderPreset } from '@/hooks/useLeadReminders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, BellRing, Clock, Calendar as CalendarIcon, 
  Sun, Sunrise, CalendarDays, X, Check, AlarmClock, Loader2, Sparkles
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast, formatDistanceToNow, setHours, setMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { parseNaturalDate } from '@/lib/parseNaturalDate';

interface RemindMePopoverProps {
  leadId: string;
  compact?: boolean;
}

type LabelSaveState = 'idle' | 'saving' | 'saved' | 'error';

export const RemindMePopover: React.FC<RemindMePopoverProps> = ({ leadId, compact = false }) => {
  const { currentReminder, createReminder, snoozeReminder, dismissReminder, completeReminder, deleteReminder } = useLeadReminders(leadId);
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [customTime, setCustomTime] = useState('09:00');
  const [presetTime, setPresetTime] = useState('');
  const [label, setLabel] = useState('');
  const [labelSaveState, setLabelSaveState] = useState<LabelSaveState>('idle');
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const labelSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [smartInput, setSmartInput] = useState('');
  const [parsedResult, setParsedResult] = useState<ReturnType<typeof parseNaturalDate>>(null);
  const smartInputRef = useRef<HTMLInputElement>(null);

  // Autosave label after 700ms
  const handleLabelChange = (value: string) => {
    const trimmedValue = value.slice(0, 120);
    setLabel(trimmedValue);
    setLabelSaveState('idle');
    
    if (labelSaveTimeoutRef.current) {
      clearTimeout(labelSaveTimeoutRef.current);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (labelSaveTimeoutRef.current) {
        clearTimeout(labelSaveTimeoutRef.current);
      }
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

  // Handle keyboard shortcuts for label (Ctrl/Cmd + Enter to save immediately)
  const handleLabelKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handlePresetSelect('today');
    }
  };

  // Smart input change handler - parse natural language
  const handleSmartInputChange = (value: string) => {
    setSmartInput(value);
    const result = parseNaturalDate(value);
    setParsedResult(result);
  };

  // Submit smart/natural language reminder
  const handleSmartSubmit = async () => {
    if (!parsedResult) return;
    setLabelSaveState('saving');
    try {
      await createReminder(leadId, 'custom', parsedResult.date, label || undefined);
      setLabelSaveState('saved');
      toast.success('Reminder set ✓', { duration: 1500 });
      setSmartInput('');
      setParsedResult(null);
      setLabel('');
      setPresetTime('');
      setOpen(false);
      window.dispatchEvent(new CustomEvent('reminder-changed'));
    } catch (error) {
      setLabelSaveState('error');
      toast.error("Couldn't set reminder. Try again.");
    }
  };

  const handleSmartKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && parsedResult) {
      e.preventDefault();
      handleSmartSubmit();
    }
  };

  const getPresetTimeWithOverride = (preset: ReminderPreset): Date => {
    const now = new Date();
    let baseDate: Date;
    let defaultHours: number;
    let defaultMinutes: number;

    switch (preset) {
      case 'today':
        baseDate = now;
        defaultHours = 17;
        defaultMinutes = 0;
        break;
      case 'tomorrow':
        baseDate = new Date(now);
        baseDate.setDate(baseDate.getDate() + 1);
        defaultHours = 9;
        defaultMinutes = 0;
        break;
      case 'next_week':
        baseDate = new Date(now);
        baseDate.setDate(baseDate.getDate() + 7);
        defaultHours = 9;
        defaultMinutes = 0;
        break;
      default:
        return now;
    }

    if (presetTime) {
      const [h, m] = presetTime.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        return setMinutes(setHours(baseDate, h), m);
      }
    }

    return setMinutes(setHours(baseDate, defaultHours), defaultMinutes);
  };

  const getPresetTimeLabel = (preset: ReminderPreset): string => {
    if (presetTime) {
      const [h, m] = presetTime.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const d = new Date();
        d.setHours(h, m);
        return format(d, 'h:mm a');
      }
    }
    switch (preset) {
      case 'today': return '5:00 PM';
      case 'tomorrow': return '9:00 AM';
      case 'next_week': return 'Mon 9:00 AM';
      default: return '';
    }
  };

  const handlePresetSelect = async (preset: ReminderPreset) => {
    if (preset === 'custom') {
      setShowCustom(true);
      return;
    }
    
    const reminderTime = getPresetTimeWithOverride(preset);

    setLabelSaveState('saving');
    try {
      await createReminder(leadId, 'custom', reminderTime, label || undefined);
      setLabelSaveState('saved');
      toast.success('Reminder set ✓', { duration: 1500 });
      setLabel('');
      setPresetTime('');
      setOpen(false);
      window.dispatchEvent(new CustomEvent('reminder-changed'));
    } catch (error) {
      setLabelSaveState('error');
      toast.error("Couldn't set reminder. Try again.");
    }
  };

  const handleCustomSubmit = async () => {
    if (!customDate) return;
    
    const [hours, minutes] = customTime.split(':').map(Number);
    const dateTime = new Date(customDate);
    dateTime.setHours(hours, minutes, 0, 0);
    
    setLabelSaveState('saving');
    try {
      await createReminder(leadId, 'custom', dateTime, label || undefined);
      setLabelSaveState('saved');
      toast.success('Reminder set ✓', { duration: 1500 });
      setCustomDate(undefined);
      setCustomTime('09:00');
      setLabel('');
      setPresetTime('');
      setShowCustom(false);
      setOpen(false);
      window.dispatchEvent(new CustomEvent('reminder-changed'));
    } catch (error) {
      setLabelSaveState('error');
      toast.error("Couldn't set reminder. Try again.");
    }
  };

  const handleSnooze = async (preset: ReminderPreset) => {
    if (!currentReminder) return;
    try {
      await snoozeReminder(currentReminder.id, preset);
      toast.success('Snoozed ✓', { duration: 1500 });
      setShowSnoozeOptions(false);
      setOpen(false);
      window.dispatchEvent(new CustomEvent('reminder-changed'));
    } catch (error) {
      toast.error("Couldn't snooze. Try again.");
    }
  };

  const handleDismiss = async () => {
    if (!currentReminder) return;
    try {
      await dismissReminder(currentReminder.id);
      toast.success('Dismissed', { duration: 1500 });
      setOpen(false);
      window.dispatchEvent(new CustomEvent('reminder-changed'));
    } catch (error) {
      toast.error("Couldn't dismiss. Try again.");
    }
  };

  const handleComplete = async () => {
    if (!currentReminder) return;
    try {
      await completeReminder(currentReminder.id);
      toast.success('Done ✓', { duration: 1500 });
      setOpen(false);
      window.dispatchEvent(new CustomEvent('reminder-changed'));
    } catch (error) {
      toast.error("Couldn't complete. Try again.");
    }
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

  // Hover intent handler for opening popover (450-600ms delay)
  const handleMouseEnter = () => {
    if (open) return;
    const timeout = setTimeout(() => {
      setOpen(true);
    }, 500);
    setHoverTimeout(timeout);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      setHoverTimeout(null);
    }
  };

  const status = getReminderStatus();

  const getLabelSaveIndicator = () => {
    switch (labelSaveState) {
      case 'saving':
        return (
          <span className="flex items-center gap-1 text-muted-foreground text-[10px]">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Saving…
          </span>
        );
      case 'saved':
        return (
          <span className="flex items-center gap-1 text-green-600 text-[10px]">
            <Check className="h-2.5 w-2.5" />
            Saved
          </span>
        );
      case 'error':
        return (
          <span className="text-destructive text-[10px]">
            Couldn't save
          </span>
        );
      default:
        return label.length > 0 ? (
          <span className="text-muted-foreground text-[10px]">
            {label.length}/120
          </span>
        ) : null;
    }
  };

  // If there's an active reminder, show reminder badge
  if (currentReminder) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 gap-1.5 px-2 transition-all duration-150 hover:scale-105 hover:shadow-sm"
            )}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            aria-label="View reminder"
          >
            <BellRing className={cn(
              "h-3.5 w-3.5",
              status?.label === 'Overdue' ? "text-red-500" :
              status?.label === 'Today' ? "text-amber-500" :
              status?.label === 'Tomorrow' ? "text-yellow-500" :
              "text-blue-500"
            )} />
            <Badge className={cn("text-[10px] px-1.5 py-0", status?.color)}>
              {status?.label}
            </Badge>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3 animate-scale-in" align="start">
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
                className="h-6 w-6 hover:scale-110 transition-transform"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {showSnoozeOptions ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Snooze until</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs hover:scale-105 transition-transform" 
                    onClick={() => handleSnooze('today')}
                  >
                    Later today
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs hover:scale-105 transition-transform" 
                    onClick={() => handleSnooze('tomorrow')}
                  >
                    Tomorrow
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs hover:scale-105 transition-transform" 
                    onClick={() => handleSnooze('next_week')}
                  >
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
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 text-xs hover:scale-105 transition-transform"
                    onClick={() => setShowSnoozeOptions(true)}
                  >
                    <AlarmClock className="h-3.5 w-3.5" />
                    Snooze
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5 text-xs hover:scale-105 transition-transform"
                    onClick={handleDismiss}
                  >
                    <X className="h-3.5 w-3.5" />
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5 text-xs hover:scale-105 transition-transform"
                    onClick={handleComplete}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Done
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    if (currentReminder) {
                      await deleteReminder(currentReminder.id);
                      setOpen(false);
                      window.dispatchEvent(new CustomEvent('reminder-changed'));
                    }
                  }}
                >
                  Cancel Reminder
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
        setPresetTime('');
        setSmartInput('');
        setParsedResult(null);
        setLabelSaveState('idle');
      }
    }}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="ghost"
          size="sm"
          className={cn(
            "gap-1.5 transition-all duration-150 hover:scale-105 hover:shadow-sm",
            compact ? "h-7 px-2 text-xs" : "h-8"
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          aria-label="Set reminder"
        >
          <Bell className="h-3.5 w-3.5" />
          {!compact && "Remind me"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 animate-scale-in" align="start">
        {showCustom ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">Pick date & time</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:scale-110 transition-transform"
                onClick={() => setShowCustom(false)}
                aria-label="Back"
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
                aria-label="Reminder time"
              />
              <Button
                size="sm"
                disabled={!customDate}
                onClick={handleCustomSubmit}
                className="hover:scale-105 transition-transform"
              >
                Set
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="font-medium text-sm">Remind me</p>
            
            {/* Smart natural language input */}
            <div className="space-y-1.5">
              <div className="relative">
                <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-purple-400" />
                <Input
                  ref={smartInputRef}
                  placeholder='Try "next tuesday 9pm"'
                  value={smartInput}
                  onChange={(e) => handleSmartInputChange(e.target.value)}
                  onKeyDown={handleSmartKeyDown}
                  className="text-sm pl-8 pr-16"
                  aria-label="Type when to remind you"
                  autoFocus
                />
                {parsedResult && (
                  <Button
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 px-2 text-[10px]"
                    onClick={handleSmartSubmit}
                  >
                    Set
                  </Button>
                )}
              </div>
              {parsedResult && (
                <div className="flex items-center gap-1.5 px-1">
                  <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                  <span className="text-[11px] text-green-600 font-medium">{parsedResult.preview}</span>
                </div>
              )}
              {smartInput.length > 2 && !parsedResult && (
                <p className="text-[10px] text-muted-foreground px-1">
                  Try: "tomorrow 2pm", "next friday 9am", "in 3 hours"
                </p>
              )}
            </div>

            <div className="relative flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground px-1">or choose</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Label input with autosave feedback */}
            <div className="relative">
              <Input
                placeholder="Add a note (optional)"
                value={label}
                onChange={(e) => handleLabelChange(e.target.value)}
                onKeyDown={handleLabelKeyDown}
                className="text-sm pr-12"
                maxLength={120}
                aria-label="Reminder note"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {getLabelSaveIndicator()}
              </div>
            </div>
            
            {/* Preset options */}
            <div className="space-y-1">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-9 hover:scale-[1.02] transition-transform"
                onClick={() => handlePresetSelect('today')}
              >
                <Sun className="h-4 w-4 text-amber-500" />
                <span className="flex-1 text-left">Later today</span>
                <span className="text-xs text-muted-foreground">{getPresetTimeLabel('today')}</span>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-9 hover:scale-[1.02] transition-transform"
                onClick={() => handlePresetSelect('tomorrow')}
              >
                <Sunrise className="h-4 w-4 text-orange-500" />
                <span className="flex-1 text-left">Tomorrow</span>
                <span className="text-xs text-muted-foreground">{getPresetTimeLabel('tomorrow')}</span>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-9 hover:scale-[1.02] transition-transform"
                onClick={() => handlePresetSelect('next_week')}
              >
                <CalendarDays className="h-4 w-4 text-blue-500" />
                <span className="flex-1 text-left">Next week</span>
                <span className="text-xs text-muted-foreground">{getPresetTimeLabel('next_week')}</span>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-9 hover:scale-[1.02] transition-transform"
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