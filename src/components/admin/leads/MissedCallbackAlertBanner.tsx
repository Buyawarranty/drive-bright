import React, { useEffect, useState } from 'react';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import { differenceInSeconds } from 'date-fns';
import { useDueReminders, DueReminder } from '@/hooks/useDueReminders';

const DISMISS_KEY = 'missed_callback_banner_dismissed_v1';
const OVERDUE_THRESHOLD_MIN = 15;

interface Props {
  onNavigate?: (leadId: string, type: 'lead' | 'customer' | 'cart') => void;
}

const getDismissed = (): Set<string> => {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
};
const saveDismissed = (s: Set<string>) => {
  try { sessionStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(s))); } catch {}
};

const isCallback = (r: DueReminder) => (r.label || '').toLowerCase().includes('callback');

const formatOverdue = (secs: number) => {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${m}m ${ss.toString().padStart(2, '0')}s`;
  return `${m}m ${ss.toString().padStart(2, '0')}s`;
};

const getName = (r: DueReminder) => {
  const l = r.lead;
  if (!l) return 'Lead';
  const n = `${l.first_name || ''} ${l.last_name || ''}`.trim();
  return n || l.vehicle_reg || l.email || 'Lead';
};

const getType = (leadId: string): 'lead' | 'customer' | 'cart' => {
  if (leadId.startsWith('customer_')) return 'customer';
  if (leadId.startsWith('cart_')) return 'cart';
  return 'lead';
};

export const MissedCallbackAlertBanner: React.FC<Props> = ({ onNavigate }) => {
  const { dueReminders } = useDueReminders();
  const [dismissed, setDismissed] = useState<Set<string>>(() => getDismissed());
  const [now, setNow] = useState(() => Date.now());

  // Live-tick the timer every second
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const missed = dueReminders
    .filter(isCallback)
    .filter(r => !dismissed.has(r.id))
    .filter(r => (now - new Date(r.reminder_time).getTime()) / 60000 >= OVERDUE_THRESHOLD_MIN)
    .sort((a, b) => new Date(a.reminder_time).getTime() - new Date(b.reminder_time).getTime());

  if (missed.length === 0) return null;

  const top = missed[0];
  const extra = missed.length - 1;
  const overdueSec = differenceInSeconds(new Date(now), new Date(top.reminder_time));

  const dismiss = (id: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  };

  const open = () => {
    onNavigate?.(top.lead_id, getType(top.lead_id));
  };

  return (
    <div className="w-full bg-red-600 text-white shadow-lg border-b-2 border-red-800 animate-in slide-in-from-top-2">
      <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 py-2.5 flex-wrap">
        <AlertTriangle className="h-5 w-5 shrink-0 animate-pulse" />
        <div className="flex-1 min-w-0 text-sm sm:text-base font-medium">
          <span className="mr-1.5 px-1.5 py-0.5 rounded bg-yellow-300 text-red-900 text-[11px] font-black tracking-wide uppercase">
            Callback missed
          </span>
          Scheduled callback for <strong>{getName(top)}</strong> is overdue —
          call back immediately or reassign.
          {extra > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded bg-red-800 text-[11px] font-semibold">
              +{extra} more overdue
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-xs uppercase tracking-wider text-white/70">Overdue</span>
          <span className="font-mono font-bold text-base px-2.5 py-1 rounded bg-white text-red-700">
            ⏱ {formatOverdue(overdueSec)}
          </span>
          <button
            onClick={open}
            className="bg-white text-red-700 hover:bg-red-50 px-3 py-1.5 rounded text-sm font-bold inline-flex items-center gap-1.5"
          >
            Open lead <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => dismiss(top.id)}
            className="bg-red-800 hover:bg-red-900 p-1.5 rounded"
            aria-label="Dismiss missed callback banner"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MissedCallbackAlertBanner;
