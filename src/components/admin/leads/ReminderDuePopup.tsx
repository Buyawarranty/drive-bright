import React, { useEffect, useRef, useState } from 'react';
import { X, Clock, AlertTriangle, Check, BellOff, CalendarClock } from 'lucide-react';
import { format, differenceInMinutes, addMinutes } from 'date-fns';
import { useDueReminders, DueReminder } from '@/hooks/useDueReminders';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';


interface ReminderDuePopupProps {
  onNavigate?: (leadId: string, type: 'lead' | 'customer' | 'cart') => void;
  activeTab?: string;
}

const ReminderDuePopup: React.FC<ReminderDuePopupProps> = ({ onNavigate }) => {
  const { dueReminders, dismissReminder, refetch } = useDueReminders();

  const updateStatus = async (id: string, patch: Record<string, any>) => {
    const { error } = await (supabase.from('lead_reminders' as any).update(patch).eq('id', id) as any);
    if (error) {
      console.error('reminder update failed', error);
      toast.error('Failed to update reminder');
      return false;
    }
    return true;
  };
  const deleteReminderRow = async (id: string) => {
    const { error } = await (supabase.from('lead_reminders' as any).delete().eq('id', id) as any);
    if (error) {
      console.error('reminder delete failed', error);
      toast.error('Failed to remove reminder');
      return false;
    }
    return true;
  };


  const [autoDismissed, setAutoDismissed] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Show the popup on EVERY admin tab so reminders can't be missed just
  // because the agent is on a different screen.
  const visibleReminders = dueReminders.filter((r) => !autoDismissed.has(r.id));

  // Auto-dismiss after 15 seconds — but only for non-overdue reminders.
  // Overdue reminders persist until the agent takes action.
  useEffect(() => {
    visibleReminders.forEach((reminder) => {
      const overdueMin = differenceInMinutes(new Date(), new Date(reminder.reminder_time));
      const isOverdue = overdueMin > 2;
      if (isOverdue) return;
      if (editingId === reminder.id) return;
      if (!timersRef.current.has(reminder.id)) {
        const timer = setTimeout(() => {
          setAutoDismissed((prev) => new Set([...prev, reminder.id]));
          timersRef.current.delete(reminder.id);
        }, 15000);
        timersRef.current.set(reminder.id, timer);
      }
    });
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
    };
  }, [visibleReminders.map((r) => r.id).join(','), editingId]);

  if (visibleReminders.length === 0) return null;

  const getLeadType = (leadId: string): 'lead' | 'customer' | 'cart' => {
    if (leadId.startsWith('customer_')) return 'customer';
    if (leadId.startsWith('cart_')) return 'cart';
    return 'lead';
  };

  const getName = (reminder: DueReminder) => {
    if (reminder.lead_id.startsWith('personal_')) return 'Personal reminder';
    if (reminder.lead) {
      const first = reminder.lead.first_name || '';
      const last = reminder.lead.last_name || '';
      const name = `${first} ${last}`.trim();
      if (name) return name;
      if (reminder.lead.vehicle_reg) return reminder.lead.vehicle_reg;
      if (reminder.lead.email) return reminder.lead.email;
    }
    return 'Reminder';
  };

  const getOverdueMinutes = (reminderTime: string) => {
    return differenceInMinutes(new Date(), new Date(reminderTime));
  };

  const handleOpen = (reminder: DueReminder) => {
    if (reminder.lead_id.startsWith('personal_')) return;
    const type = getLeadType(reminder.lead_id);
    onNavigate?.(reminder.lead_id, type);
    setAutoDismissed((prev) => new Set([...prev, reminder.id]));
  };

  const handleKeep = (e: React.MouseEvent, reminderId: string) => {
    // "Close" — keep as a pending reminder, only hide the popup.
    e.stopPropagation();
    dismissReminder(reminderId);
    setAutoDismissed((prev) => new Set([...prev, reminderId]));
  };

  const handleCancel = async (e: React.MouseEvent, reminderId: string) => {
    // "No longer needed" — remove entirely.
    e.stopPropagation();
    await deleteReminderRow(reminderId);
    setAutoDismissed((prev) => new Set([...prev, reminderId]));
    refetch();
  };

  const handleDone = async (e: React.MouseEvent, reminderId: string) => {
    e.stopPropagation();
    await updateStatus(reminderId, { status: 'completed' });
    setAutoDismissed((prev) => new Set([...prev, reminderId]));
    refetch();
  };

  const handleSnooze = async (e: React.MouseEvent, reminderId: string, minutes: number) => {
    e.stopPropagation();
    const when = addMinutes(new Date(), minutes);
    const iso = when.toISOString();
    await updateStatus(reminderId, { status: 'snoozed', snoozed_until: iso, reminder_time: iso });
    setAutoDismissed((prev) => new Set([...prev, reminderId]));
    refetch();
  };


  const startEdit = (e: React.MouseEvent, r: DueReminder) => {
    e.stopPropagation();
    const t = timersRef.current.get(r.id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(r.id);
    }
    setEditingId(r.id);
    // datetime-local expects YYYY-MM-DDTHH:mm in local time
    const d = new Date();
    d.setMinutes(d.getMinutes() + 15);
    const pad = (n: number) => String(n).padStart(2, '0');
    setEditValue(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
    );
  };

  const commitEdit = async (e: React.MouseEvent, reminderId: string) => {
    e.stopPropagation();
    if (!editValue) return;
    const when = new Date(editValue);
    if (isNaN(when.getTime())) return;
    const iso = when.toISOString();
    await updateStatus(reminderId, { status: 'snoozed', snoozed_until: iso, reminder_time: iso });
    setEditingId(null);
    setAutoDismissed((prev) => new Set([...prev, reminderId]));
    refetch();
  };

  return (
    <div className="fixed top-20 right-4 z-[70] flex flex-col gap-2 max-h-[calc(100vh-6rem)] overflow-y-auto pr-1 -mr-1" style={{ width: '320px' }}>
      <style>{`
        @keyframes borderPulse {
          0%, 100% { border-color: rgba(248, 113, 113, 0.55); }
          50% { border-color: rgba(220, 38, 38, 0.95); }
        }
        .reminder-border-pulse {
          animation: borderPulse 2.2s ease-in-out infinite;
        }
      `}</style>
      {visibleReminders.slice(0, 4).map((reminder) => {
        const overdueMin = getOverdueMinutes(reminder.reminder_time);
        const isOverdue = overdueMin > 2;
        const isPersonal = reminder.lead_id.startsWith('personal_');
        const editing = editingId === reminder.id;

        return (
          <div
            key={reminder.id}
            className={`rounded-lg shadow-lg border-2 transition-colors ${
              isOverdue
                ? 'bg-red-50 border-red-400 reminder-border-pulse'
                : 'bg-amber-50 border-amber-300'
            }`}
          >
            <div className="p-3" onClick={() => handleOpen(reminder)} role={isPersonal ? undefined : 'button'}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  {isOverdue ? (
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold truncate ${isOverdue ? 'text-red-800' : 'text-amber-900'}`}>
                      {getName(reminder)}
                    </p>
                    <p className={`text-xs truncate ${isOverdue ? 'text-red-700' : 'text-amber-700'}`}>
                      {reminder.label || 'Follow up'} · {format(new Date(reminder.reminder_time), 'h:mm a')}
                      {isOverdue && ` · ${overdueMin}m late`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => handleKeep(e, reminder.id)}
                  title="Close (keep as reminder)"
                  className={`p-1 rounded-full hover:bg-black/10 shrink-0 ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {editing ? (
                <div className="mt-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="datetime-local"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="flex-1 text-xs border rounded px-2 py-1 bg-white"
                  />
                  <button
                    onClick={(e) => commitEdit(e, reminder.id)}
                    className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Set
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                    className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <button
                    onClick={(e) => handleSnooze(e, reminder.id, 5)}
                    className="text-[11px] px-2 py-1 rounded bg-white border border-amber-300 hover:bg-amber-100 text-amber-800"
                  >
                    +5m
                  </button>
                  <button
                    onClick={(e) => handleSnooze(e, reminder.id, 15)}
                    className="text-[11px] px-2 py-1 rounded bg-white border border-amber-300 hover:bg-amber-100 text-amber-800"
                  >
                    +15m
                  </button>
                  <button
                    onClick={(e) => handleSnooze(e, reminder.id, 60)}
                    className="text-[11px] px-2 py-1 rounded bg-white border border-amber-300 hover:bg-amber-100 text-amber-800"
                  >
                    +1h
                  </button>
                  <button
                    onClick={(e) => startEdit(e, reminder)}
                    title="Reset time"
                    className="text-[11px] px-2 py-1 rounded bg-white border border-blue-300 hover:bg-blue-100 text-blue-800 inline-flex items-center gap-1"
                  >
                    <CalendarClock className="h-3 w-3" /> Reset
                  </button>
                  <button
                    onClick={(e) => handleDone(e, reminder.id)}
                    className="text-[11px] px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 inline-flex items-center gap-1"
                  >
                    <Check className="h-3 w-3" /> Done
                  </button>
                  <button
                    onClick={(e) => handleCancel(e, reminder.id)}
                    title="No longer needed"
                    className="text-[11px] px-2 py-1 rounded bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 inline-flex items-center gap-1"
                  >
                    <BellOff className="h-3 w-3" /> Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ReminderDuePopup;
