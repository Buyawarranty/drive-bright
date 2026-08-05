import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BadgePoundSterling, Check, X, ShieldCheck } from 'lucide-react';
import { useDiscountAuthRequests } from '@/hooks/useDiscountAuthRequests';
import { toast } from 'sonner';

/**
 * Top-of-screen banner for discount-over-40% authorisation.
 * - Management: every pending request with reg, mileage, prices and reason, plus
 *   Approve / Decline. Arrival of a new request beeps (see the hook).
 * - Requesting agent: a green "go ahead with this transaction" banner on
 *   approval (or a red one if declined) until dismissed.
 */
export const DiscountAuthBanner: React.FC<{ userRole?: string | null }> = ({ userRole }) => {
  const { pending, myDecided, isManagement, decide, markSeen } = useDiscountAuthRequests(userRole);
  const [noteFor, setNoteFor] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const handleDecide = async (id: string, status: 'approved' | 'declined') => {
    setBusy(id);
    try {
      await decide(id, status, noteFor[id]);
      toast[status === 'approved' ? 'success' : 'info'](
        status === 'approved' ? 'Discount authorised' : 'Request declined',
      );
    } catch (e: any) {
      toast.error(e?.message || 'Could not save the decision');
    } finally {
      setBusy(null);
    }
  };

  const showManagement = isManagement && pending.length > 0;
  if (!showManagement && myDecided.length === 0) return null;

  return (
    <div className="sticky top-0 z-[60] w-full">
      {showManagement && (
        <div className="bg-amber-100 border-b-2 border-amber-500">
          <div className="max-w-7xl mx-auto px-4 py-3 space-y-3">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <BadgePoundSterling className="w-4 h-4" />
              {pending.length} authorisation {pending.length === 1 ? 'request' : 'requests'} waiting
            </div>
            {pending.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border-2 border-amber-400 bg-background p-3 flex flex-col lg:flex-row lg:items-center gap-3"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-bold">
                    {r.request_type === 'claim_limit_5000' && (
                      <span className="mr-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                        £5,000 cover
                      </span>
                    )}
                    {r.registration_plate || 'No reg'}
                    <span className="font-normal text-muted-foreground">
                      {r.mileage ? ` · ${r.mileage} miles` : ''}
                      {r.vehicle_description ? ` · ${r.vehicle_description}` : ''}
                    </span>
                  </p>
                  {r.request_type === 'claim_limit_5000' ? (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Wants to sell</span>{' '}
                      <strong className="text-amber-800">£5,000 per claim</strong>{' '}
                      <span className="text-muted-foreground">instead of £3,000 — quote</span>{' '}
                      <strong>£{Number(r.requested_price || r.base_price || 0).toFixed(0)}</strong>
                    </p>
                  ) : (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Normal</span>{' '}
                      <strong>£{Number(r.base_price || 0).toFixed(0)}</strong>{' '}
                      <span className="text-muted-foreground">→ wants</span>{' '}
                      <strong className="text-amber-800">£{Number(r.requested_price || 0).toFixed(0)}</strong>{' '}
                      {r.discount_pct != null && (
                        <span className="font-semibold text-amber-800">({Number(r.discount_pct).toFixed(0)}% off)</span>
                      )}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    <strong>{r.requested_by_name || 'Agent'}</strong>: {r.reason}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 lg:w-[420px]">
                  <Textarea
                    rows={1}
                    placeholder="Note (optional)"
                    value={noteFor[r.id] || ''}
                    onChange={(e) => setNoteFor((p) => ({ ...p, [r.id]: e.target.value }))}
                    className="text-xs min-h-[38px]"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy === r.id}
                      onClick={() => handleDecide(r.id, 'approved')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Authorise
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === r.id}
                      onClick={() => handleDecide(r.id, 'declined')}
                      className="text-xs font-semibold"
                    >
                      <X className="w-3.5 h-3.5 mr-1" /> Decline
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {myDecided.map((r) => (
        <div
          key={r.id}
          className={
            r.status === 'approved'
              ? 'bg-emerald-100 border-b-2 border-emerald-600'
              : 'bg-rose-100 border-b-2 border-rose-600'
          }
        >
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <ShieldCheck className={r.status === 'approved' ? 'w-5 h-5 text-emerald-700' : 'w-5 h-5 text-rose-700'} />
            <div className="flex-1 text-sm">
              {r.status === 'approved' ? (
                <p className="font-bold text-emerald-900">
                  {r.request_type === 'claim_limit_5000'
                    ? `£5,000 cover approved on ${r.registration_plate || 'this quote'} by ${r.decided_by_name || 'Management'}`
                    : `Go ahead with this transaction — £${Number(r.requested_price || 0).toFixed(0)} on ${r.registration_plate || 'this quote'} authorised by ${r.decided_by_name || 'Management'}`}
                  {r.decision_note ? ` — ${r.decision_note}` : ''}
                </p>
              ) : (
                <p className="font-bold text-rose-900">
                  {r.request_type === 'claim_limit_5000' ? '£5,000 cover declined' : 'Discount declined'} for{' '}
                  {r.registration_plate || 'this quote'} by {r.decided_by_name || 'Management'}
                  {r.decision_note ? ` — ${r.decision_note}` : ''}
                </p>
              )}
            </div>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => markSeen(r.id)}>
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
