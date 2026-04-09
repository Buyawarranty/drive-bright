import React from 'react';
import { X, Clock, AlertTriangle, User } from 'lucide-react';
import { format, isPast, differenceInMinutes } from 'date-fns';
import { useDueReminders, DueReminder } from '@/hooks/useDueReminders';

interface ReminderDuePopupProps {
  onNavigate?: (leadId: string, type: 'lead' | 'customer' | 'cart') => void;
}

const ReminderDuePopup: React.FC<ReminderDuePopupProps> = ({ onNavigate }) => {
  const { dueReminders, dismissReminder } = useDueReminders();

  if (dueReminders.length === 0) return null;

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
      return name || reminder.lead.email || 'Unknown';
    }
    return 'Unknown Lead';
  };

  const getOverdueMinutes = (reminderTime: string) => {
    return differenceInMinutes(new Date(), new Date(reminderTime));
  };

  const handleClick = (reminder: DueReminder) => {
    const type = getLeadType(reminder.lead_id);
    onNavigate?.(reminder.lead_id, type);
  };

  const handleDismiss = (e: React.MouseEvent, reminderId: string) => {
    e.stopPropagation();
    dismissReminder(reminderId);
  };

  return (
    <div className="fixed top-20 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full">
      {dueReminders.map((reminder) => {
        const overdueMin = getOverdueMinutes(reminder.reminder_time);
        const isOverdue = overdueMin > 5;
        const type = getLeadType(reminder.lead_id);

        return (
          <div
            key={reminder.id}
            onClick={() => handleClick(reminder)}
            className={`
              rounded-lg shadow-lg border cursor-pointer transition-all hover:scale-[1.02]
              ${isOverdue 
                ? 'bg-red-50 border-red-300 hover:bg-red-100' 
                : 'bg-amber-50 border-amber-300 hover:bg-amber-100'
              }
            `}
          >
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isOverdue ? (
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${isOverdue ? 'text-red-800' : 'text-amber-800'}`}>
                      {getName(reminder)}
                    </p>
                    <p className={`text-xs ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                      {reminder.label || 'Follow up'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDismiss(e, reminder.id)}
                  className={`p-1 rounded-full hover:bg-black/10 shrink-0 ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className={`text-xs ${isOverdue ? 'text-red-500' : 'text-amber-500'}`}>
                  Due {format(new Date(reminder.reminder_time), 'h:mm a')}
                  {isOverdue && ` (${overdueMin}m overdue)`}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  type === 'customer' ? 'bg-blue-100 text-blue-700' :
                  type === 'cart' ? 'bg-purple-100 text-purple-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {type === 'customer' ? 'Customer' : type === 'cart' ? 'Cart' : 'Lead'}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ReminderDuePopup;
