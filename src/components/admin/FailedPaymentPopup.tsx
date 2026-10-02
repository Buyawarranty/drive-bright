import React, { useMemo, useState } from 'react';
import { X, CreditCard, Phone } from 'lucide-react';
import { AlertRailSlot } from '@/components/admin/AlertRail';
import { useFailedPayments } from '@/hooks/useFailedPayments';

const HIDDEN_KEY = 'bw:failed-payment-hidden';
const loadHidden = (): string[] => { try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'); } catch { return []; } };

/** Left-rail pop-up shown to every staff user on any admin page when a Stripe or Bumper payment fails. */
export const FailedPaymentPopup: React.FC<{ onOpenMissedPayments?: () => void }> = ({ onOpenMissedPayments }) => {
  const [since] = useState(() => Date.now() - 24 * 3600 * 1000);
  const { items } = useFailedPayments(since);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(loadHidden()));
  const shown = useMemo(() => items.filter(i => !hidden.has(i.key)).slice(0, 3), [items, hidden]);

  const dismiss = (key: string) => {
    const next = new Set(hidden); next.add(key); setHidden(next);
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next].slice(-300))); } catch { /* ignore */ }
  };

  if (!shown.length) return null;
  return (
    <AlertRailSlot order={22}>
      <div className="flex flex-col gap-2">
        {shown.map(i => (
          <div key={i.key} className="relative rounded-xl border border-red-200 border-l-4 border-l-red-600 bg-red-50 p-3 shadow-sm text-sm text-gray-900">
            <div className="flex items-start gap-2 pr-6">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-red-600 text-white"><CreditCard className="h-3 w-3" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold leading-tight">Payment failed</span>
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700">Urgent</span>
                </div>
                <div className="text-[11px] text-gray-500">
                  {i.method === 'stripe' ? 'Stripe' : 'Bumper'} · {new Date(i.at).toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
            <button aria-label="Close" onClick={() => dismiss(i.key)} className="absolute right-2 top-2 rounded p-1 text-gray-500 hover:bg-red-100">
              <X className="h-4 w-4" />
            </button>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold">{i.name || i.email || 'Unknown customer'}</span>
              {i.amount != null && <span className="font-bold text-red-600">£{Number(i.amount).toFixed(2)}</span>}
            </div>
            <div className="text-xs text-gray-600">{[i.reg, i.reason].filter(Boolean).join(' · ')}</div>
            <div className="mt-0.5 text-xs text-gray-600">Lead owner: <span className="font-semibold text-gray-900">{i.ownerName || 'Unassigned'}</span></div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {onOpenMissedPayments && (
                <button onClick={onOpenMissedPayments} className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium hover:bg-gray-50">Missed payments</button>
              )}
              {i.phone && (
                <a href={`tel:${i.phone}`} className="inline-flex items-center justify-center gap-1 rounded-md bg-red-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
                  <Phone className="h-3 w-3" />Call
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </AlertRailSlot>
  );
};

export default FailedPaymentPopup;
