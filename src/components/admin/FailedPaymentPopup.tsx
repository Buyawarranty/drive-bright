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
          <div key={i.key} className="relative rounded-lg border-2 border-destructive bg-card p-3 shadow-lg text-sm">
            <button aria-label="Close" onClick={() => dismiss(i.key)} className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 font-semibold text-destructive pr-6">
              <CreditCard className="h-4 w-4" />
              {i.method === 'stripe' ? 'Failed Stripe payment' : 'Failed Bumper payment'}
            </div>
            <div className="mt-1 font-medium text-foreground">{i.name || i.email || 'Unknown customer'}</div>
            <div className="text-xs text-muted-foreground">
              {[i.reg, i.amount != null ? `£${Number(i.amount).toFixed(2)}` : null, i.reason].filter(Boolean).join(' · ')}
            </div>
            <div className="mt-1 text-xs">Lead owner: <span className="font-semibold">{i.ownerName || 'Unassigned'}</span></div>
            <div className="text-xs text-muted-foreground">
              {new Date(i.at).toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="mt-2 flex gap-2">
              {i.phone && (
                <a href={`tel:${i.phone}`} className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground">
                  <Phone className="h-3 w-3" />Call {i.phone}
                </a>
              )}
              {onOpenMissedPayments && (
                <button onClick={onOpenMissedPayments} className="rounded border border-border px-2 py-1 text-xs hover:bg-muted">Missed payments</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </AlertRailSlot>
  );
};

export default FailedPaymentPopup;
