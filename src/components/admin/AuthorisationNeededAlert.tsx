import React, { useState } from 'react';
import { ShieldAlert, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDiscountAuthRequests } from '@/hooks/useDiscountAuthRequests';
import { pushRecentAlert } from '@/lib/recentAlerts';
import { toast } from 'sonner';

/**
 * Live Alerts card for management: an agent has asked for price authorisation.
 * Authorise/Decline straight from the card; once authorised the agent can take
 * payment or Confirm External Payment at the approved price.
 */
export const AuthorisationNeededAlert: React.FC<{ userRole?: string | null }> = ({ userRole }) => {
  const { pending, isManagement, decide } = useDiscountAuthRequests(userRole);
  const [busy, setBusy] = useState<string | null>(null);

  if (!isManagement || pending.length === 0) return null;

  const handle = async (r: (typeof pending)[number], status: 'approved' | 'declined') => {
    setBusy(r.id);
    try {
      await decide(r.id, status);
      pushRecentAlert({
        key: `auth-needed-${r.id}`,
        title: status === 'approved' ? 'Authorisation given' : 'Authorisation declined',
        detail: `${r.registration_plate || 'No reg'} · ${r.requested_by_name || 'Agent'}`,
        tone: status === 'approved' ? 'green' as any : 'red',
      });
      toast[status === 'approved' ? 'success' : 'info'](
        status === 'approved' ? 'Authorised — the agent can now take payment' : 'Request declined',
      );
    } catch (e: any) {
      toast.error(e?.message || 'Could not save the decision');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {pending.map((r) => {
        const claim = r.request_type === 'claim_limit_5000';
        return (
          <div key={r.id} className="rounded-xl border border-l-4 border-amber-200 border-l-amber-500 bg-amber-50 px-3 py-2.5 text-sm shadow-sm">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-amber-900">Authorisation needed</span>
                  <span className="text-[11px] text-amber-700">
                    {new Date(r.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}
                  </span>
                </div>
                <div className="font-medium text-amber-900">
                  {r.registration_plate || 'No reg'} · {r.requested_by_name || 'Agent'}
                </div>
                <div className="text-xs text-amber-800">
                  {claim
                    ? `£5,000 cover · quote £${Number(r.requested_price || r.base_price || 0).toFixed(0)}`
                    : `£${Number(r.base_price || 0).toFixed(0)} → £${Number(r.requested_price || 0).toFixed(0)}${r.discount_pct != null ? ` (${Number(r.discount_pct).toFixed(0)}% off)` : ''}`}
                </div>
                {r.reason && <div className="mt-0.5 line-clamp-2 text-[11px] text-amber-700">“{r.reason}”</div>}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" disabled={busy === r.id} onClick={() => handle(r, 'approved')} className="h-7 bg-emerald-600 px-3 text-xs font-semibold hover:bg-emerald-700">
                    <Check className="mr-1 h-3.5 w-3.5" /> Authorise
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => handle(r, 'declined')} className="h-7 bg-background px-3 text-xs font-semibold">
                    <X className="mr-1 h-3.5 w-3.5" /> Decline
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AuthorisationNeededAlert;
