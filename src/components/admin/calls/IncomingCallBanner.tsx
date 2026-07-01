import React from 'react';
import { PhoneIncoming, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCallRailPresence } from '@/hooks/useCallRailPresence';
import { useNavigate } from 'react-router-dom';

export const IncomingCallBanner: React.FC = () => {
  const { ringing, dismissRinging } = useCallRailPresence();
  const navigate = useNavigate();

  if (!ringing) return null;

  const displayName = ringing.caller_name || 'Unknown caller';
  const location = [ringing.caller_city, ringing.caller_state].filter(Boolean).join(', ');

  const openLead = () => {
    if (ringing.matched_lead_id) {
      navigate(`/admin-dashboard/?tab=new-leads&leadId=${ringing.matched_lead_id}`);
    } else if (ringing.matched_customer_id) {
      navigate(`/admin-dashboard/?tab=customers&customerId=${ringing.matched_customer_id}`);
    }
    dismissRinging();
  };

  return (
    <div className="fixed top-4 right-4 z-[100] w-[380px] max-w-[calc(100vw-2rem)] rounded-xl border-2 border-green-500 bg-white shadow-2xl animate-in slide-in-from-top-4">
      <div className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-t-xl">
        <PhoneIncoming className="w-4 h-4 animate-pulse" />
        <span className="font-semibold text-sm uppercase tracking-wide">Incoming call</span>
        <button
          onClick={dismissRinging}
          className="ml-auto p-1 hover:bg-white/20 rounded"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-slate-500" />
          <div>
            <div className="font-semibold text-slate-900">{displayName}</div>
            {location && <div className="text-xs text-slate-500">{location}</div>}
          </div>
        </div>
        <div className="text-lg font-mono text-slate-800">{ringing.caller_number ?? '—'}</div>
        {ringing.tracked_number && (
          <div className="text-xs text-slate-500">
            To: <span className="font-mono">{ringing.tracked_number}</span>
          </div>
        )}
        {(ringing.matched_lead_id || ringing.matched_customer_id) && (
          <Button size="sm" className="w-full mt-2" onClick={openLead}>
            Open {ringing.matched_customer_id ? 'customer' : 'lead'}
          </Button>
        )}
      </div>
    </div>
  );
};
