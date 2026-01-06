import React, { useState } from 'react';
import { useLeadReminders, LeadReminder, ReminderPreset } from '@/hooks/useLeadReminders';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, BellRing, Clock, ExternalLink, Check, X, AlarmClock,
  ChevronRight, Car, User
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface MyRemindersPanelProps {
  onNavigateToLead?: (leadId: string) => void;
  compact?: boolean;
}

export const MyRemindersPanel: React.FC<MyRemindersPanelProps> = ({ 
  onNavigateToLead,
  compact = false 
}) => {
  const { reminders, loading, snoozeReminder, dismissReminder, completeReminder } = useLeadReminders();
  const [snoozeTarget, setSnoozeTarget] = useState<string | null>(null);

  const getReminderStatus = (reminder: LeadReminder) => {
    const reminderTime = new Date(reminder.reminder_time);
    if (isPast(reminderTime)) {
      return { label: 'Overdue', color: 'bg-red-500 text-white', urgent: true };
    }
    if (isToday(reminderTime)) {
      return { label: 'Today', color: 'bg-amber-500 text-white', urgent: true };
    }
    if (isTomorrow(reminderTime)) {
      return { label: 'Tomorrow', color: 'bg-yellow-400 text-yellow-900', urgent: false };
    }
    return { 
      label: formatDistanceToNow(reminderTime, { addSuffix: true }), 
      color: 'bg-blue-100 text-blue-800', 
      urgent: false 
    };
  };

  const getLeadName = (reminder: LeadReminder) => {
    if (!reminder.lead) return 'Unknown Lead';
    const firstName = reminder.lead.first_name;
    const lastName = reminder.lead.last_name;
    if (firstName || lastName) {
      return `${firstName || ''} ${lastName || ''}`.trim();
    }
    return reminder.lead.email.split('@')[0];
  };

  const handleSnooze = async (reminderId: string, preset: ReminderPreset) => {
    await snoozeReminder(reminderId, preset);
    setSnoozeTarget(null);
  };

  const overdueReminders = reminders.filter(r => isPast(new Date(r.reminder_time)));
  const upcomingReminders = reminders.filter(r => !isPast(new Date(r.reminder_time)));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (reminders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Bell className="h-10 w-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No reminders</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Set reminders on leads to see them here
        </p>
      </div>
    );
  }

  const ReminderItem = ({ reminder }: { reminder: LeadReminder }) => {
    const status = getReminderStatus(reminder);
    const isSnoozing = snoozeTarget === reminder.id;

    return (
      <div 
        className={cn(
          "group p-3 rounded-lg border transition-all",
          status.urgent 
            ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900" 
            : "bg-background border-border hover:border-muted-foreground/30"
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
            status.urgent ? "bg-red-100 dark:bg-red-900/30" : "bg-muted"
          )}>
            <BellRing className={cn(
              "h-4 w-4",
              status.urgent ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
            )} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{getLeadName(reminder)}</span>
              <Badge className={cn("text-[10px] px-1.5 py-0 flex-shrink-0", status.color)}>
                {status.label}
              </Badge>
            </div>

            {reminder.lead?.vehicle_reg && (
              <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                <Car className="h-3 w-3" />
                <span>{reminder.lead.vehicle_reg}</span>
              </div>
            )}

            {reminder.label && (
              <p className="text-sm text-foreground mt-1 line-clamp-2">{reminder.label}</p>
            )}

            <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              <span>{format(new Date(reminder.reminder_time), 'EEE, MMM d • h:mm a')}</span>
            </div>

            {/* Actions */}
            {isSnoozing ? (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-6 text-[10px] px-2"
                  onClick={() => handleSnooze(reminder.id, 'today')}
                >
                  Later today
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-6 text-[10px] px-2"
                  onClick={() => handleSnooze(reminder.id, 'tomorrow')}
                >
                  Tomorrow
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-6 text-[10px] px-2"
                  onClick={() => handleSnooze(reminder.id, 'next_week')}
                >
                  Next week
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-[10px] px-2"
                  onClick={() => setSnoozeTarget(null)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-2 gap-1"
                  onClick={() => setSnoozeTarget(reminder.id)}
                >
                  <AlarmClock className="h-3 w-3" />
                  Snooze
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-2 gap-1"
                  onClick={() => dismissReminder(reminder.id)}
                >
                  <X className="h-3 w-3" />
                  Dismiss
                </Button>
                <Button
                  size="sm"
                  className="h-6 text-[10px] px-2 gap-1"
                  onClick={() => completeReminder(reminder.id)}
                >
                  <Check className="h-3 w-3" />
                  Done
                </Button>
                {onNavigateToLead && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2 gap-1 ml-auto"
                    onClick={() => onNavigateToLead(reminder.lead_id)}
                  >
                    <ExternalLink className="h-3 w-3" />
                    View
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (compact) {
    return (
      <div className="space-y-2">
        {reminders.slice(0, 5).map((reminder) => (
          <ReminderItem key={reminder.id} reminder={reminder} />
        ))}
        {reminders.length > 5 && (
          <p className="text-xs text-muted-foreground text-center py-1">
            +{reminders.length - 5} more reminders
          </p>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4" />
          My Reminders
          {reminders.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {reminders.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-4">
            {overdueReminders.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-red-600 uppercase tracking-wide">
                  Overdue ({overdueReminders.length})
                </p>
                {overdueReminders.map((reminder) => (
                  <ReminderItem key={reminder.id} reminder={reminder} />
                ))}
              </div>
            )}

            {upcomingReminders.length > 0 && (
              <div className="space-y-2">
                {overdueReminders.length > 0 && (
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-4">
                    Upcoming ({upcomingReminders.length})
                  </p>
                )}
                {upcomingReminders.map((reminder) => (
                  <ReminderItem key={reminder.id} reminder={reminder} />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
