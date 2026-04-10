import React, { useEffect, useRef, useState } from 'react';
import { X, Clock, AlertTriangle } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { useDueReminders, DueReminder } from '@/hooks/useDueReminders';

interface ReminderDuePopupProps {
  onNavigate?: (leadId: string, type: 'lead' | 'customer' | 'cart') => void;
  activeTab?: string;
}

const ReminderDuePopup: React.FC<ReminderDuePopupProps> = ({ onNavigate, activeTab }) => {
  const { dueReminders, dismissReminder } = useDueReminders();
  const [autoDismissed, setAutoDismissed] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const visibleReminders = (activeTab === 'new-leads')
    ? dueReminders.filter(r => !autoDismissed.has(r.id))
    : [];

  // Auto-dismiss after 10 seconds — but ONLY for non-overdue reminders
  // Overdue reminders persist until manually dismissed (no animation/pulsing)
  useEffect(() => {
    visibleReminders.forEach((reminder) => {
      const overdueMin = differenceInMinutes(new Date(), new Date(reminder.reminder_time));
      const isOverdue = overdueMin > 5;
      
      // Overdue reminders persist — don't auto-dismiss
      if (isOverdue) return;
      
      if (!timersRef.current.has(reminder.id)) {
        const timer = setTimeout(() => {
          setAutoDismissed(prev => new Set([...prev, reminder.id]));
          timersRef.current.delete(reminder.id);
        }, 10000);
        timersRef.current.set(reminder.id, timer);
      }
    });

    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, [visibleReminders.map(r => r.id).join(',')]);

  if (visibleReminders.length === 0) return null;

  const getLeadType = (leadId: string): 'lead' | 'customer' | 'cart' => {
    if (leadId.startsWith('customer_')) return 'customer';
    if (leadId.startsWith('cart_')) return 'cart';
    return 'lead';
  };

  const getName = (reminder: DueReminder) => {
    if (reminder.lead) {
      const first = reminder.lead.first_name || '';
      const last = reminder.lead.last_name || '';
      const name = `${first} ${last}`.trim();
      if (name) return name;
      if (reminder.lead.vehicle_reg) return reminder.lead.vehicle_reg;
      if (reminder.lead.email) return reminder.lead.email;
    }
    return 'Lead';
  };

  const getOverdueMinutes = (reminderTime: string) => {
    return differenceInMinutes(new Date(), new Date(reminderTime));
  };

  const handleClick = (reminder: DueReminder) => {
    const type = getLeadType(reminder.lead_id);
    onNavigate?.(reminder.lead_id, type);
    setAutoDismissed(prev => new Set([...prev, reminder.id]));
  };

  const handleDismiss = (e: React.MouseEvent, reminderId: string) => {
    e.stopPropagation();
    dismissReminder(reminderId);
    setAutoDismissed(prev => new Set([...prev, reminderId]));
  };

  return (
    <div className="fixed top-20 right-4 z-[60] flex flex-col gap-1.5" style={{ width: '240px' }}>
      {visibleReminders.slice(0, 3).map((reminder) => {
        const overdueMin = getOverdueMinutes(reminder.reminder_time);
        const isOverdue = overdueMin > 5;

        return (
          <div
            key={reminder.id}
            onClick={() => handleClick(reminder)}
            className={`
              rounded-md shadow-md border cursor-pointer transition-colors
              ${isOverdue 
                ? 'bg-red-50 border-red-200' 
                : 'bg-amber-50 border-amber-200'
              }
            `}
          >
            <div className="p-2">
              <div className="flex items-start justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {isOverdue ? (
                    <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                  ) : (
                    <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold truncate ${isOverdue ? 'text-red-700' : 'text-amber-700'}`}>
                      {getName(reminder)}
                    </p>
                    <p className={`text-[10px] truncate ${isOverdue ? 'text-red-500' : 'text-amber-500'}`}>
                      {reminder.label || 'Follow up'} · {format(new Date(reminder.reminder_time), 'h:mm a')}
                      {isOverdue && ` · ${overdueMin}m late`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDismiss(e, reminder.id)}
                  className={`p-0.5 rounded-full hover:bg-black/10 shrink-0 ${isOverdue ? 'text-red-500' : 'text-amber-500'}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ReminderDuePopup;
