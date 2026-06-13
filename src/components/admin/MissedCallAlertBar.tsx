import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PhoneMissed, Phone, Check, X, ChevronDown, ExternalLink } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';

interface MissedCall {
  id: string;
  provider: string;
  caller_phone: string | null;
  caller_name: string | null;
  tracking_number: string | null;
  call_status: string | null;
  matched_lead_id: string | null;
  matched_customer_id: string | null;
  status: string;
  created_at: string;
}

interface Props {
  userRole: string | null;
  onOpenLead?: (leadId: string) => void;
}

const PROVIDER_LABEL: Record<string, string> = {
  callrail: 'CallRail',
  zoiper: 'Zoiper',
  dial9: 'Dial9',
};

export const MissedCallAlertBar: React.FC<Props> = ({ userRole, onOpenLead }) => {
  const allowed = ['admin', 'super_admin', 'sales', 'sales_lead', 'lead_gen', 'performance_manager'].includes(userRole || '');
  const [calls, setCalls] = useState<MissedCall[]>([]);

  const fetchActive = useCallback(async () => {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // last 60 min
    const { data } = await supabase
      .from('missed_calls')
      .select('id,provider,caller_phone,caller_name,tracking_number,call_status,matched_lead_id,matched_customer_id,status,created_at')
      .eq('status', 'active')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20);
    setCalls((data as MissedCall[]) || []);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    fetchActive();
    const channel = supabase
      .channel('missed-calls-alert-bar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missed_calls' }, () => fetchActive())
      .subscribe();
    const t = window.setInterval(fetchActive, 60_000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(t);
    };
  }, [allowed, fetchActive]);

  const acknowledge = async (id: string) => {
    setCalls((prev) => prev.filter((c) => c.id !== id));
    const { data: { user } } = await supabase.auth.getUser();
    let adminId: string | null = null;
    if (user) {
      const { data: au } = await supabase.from('admin_users').select('id').eq('user_id', user.id).maybeSingle();
      adminId = au?.id || null;
    }
    await supabase
      .from('missed_calls')
      .update({ status: 'acknowledged', acknowledged_by: adminId, acknowledged_at: new Date().toISOString() })
      .eq('id', id);
  };

  const dismiss = async (id: string) => {
    setCalls((prev) => prev.filter((c) => c.id !== id));
    await supabase
      .from('missed_calls')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id);
  };

  if (!allowed || calls.length === 0) return null;

  const top = calls[0];
  const extra = calls.length - 1;
  const provider = PROVIDER_LABEL[top.provider] || top.provider;
  const who = top.caller_name || top.caller_phone || 'Unknown caller';
  const ago = formatDistanceToNow(new Date(top.created_at), { addSuffix: true });
  const telHref = top.caller_phone ? `tel:${top.caller_phone.replace(/\s/g, '')}` : null;

  return (
    <div className="bg-blue-600 text-white shadow-lg border-b-2 border-blue-800 rounded-md mb-2">
      <div className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <PhoneMissed className="h-5 w-5 shrink-0" />
          <div className="text-sm font-medium break-words">
            📞 Missed call from <strong>{who}</strong>
            {top.caller_phone && top.caller_name && <span className="opacity-90"> · {top.caller_phone}</span>}
            <span className="opacity-90"> · {provider}</span>
            <span className="opacity-75"> · {ago}</span>
            {top.matched_lead_id && <span className="ml-2 px-2 py-0.5 rounded bg-blue-800 text-[11px] font-semibold">Matched lead</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {telHref && (
            <a
              href={telHref}
              className="bg-white text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded text-sm font-bold inline-flex items-center gap-1.5"
            >
              <Phone className="h-3.5 w-3.5" /> Call back
            </a>
          )}
          {top.matched_lead_id && onOpenLead && (
            <button
              onClick={() => onOpenLead(top.matched_lead_id!)}
              className="bg-blue-700 hover:bg-blue-800 px-3 py-1.5 rounded text-sm font-medium inline-flex items-center gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open lead
            </button>
          )}
          <button
            onClick={() => acknowledge(top.id)}
            className="bg-blue-700 hover:bg-blue-800 px-3 py-1.5 rounded text-sm font-medium inline-flex items-center gap-1.5"
            title="Mark as seen"
          >
            <Check className="h-3.5 w-3.5" /> Got it
          </button>
          <button
            onClick={() => dismiss(top.id)}
            className="bg-blue-700 hover:bg-blue-800 p-1.5 rounded"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          {extra > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger className="bg-blue-800 hover:bg-blue-900 px-2.5 py-1.5 rounded text-sm font-semibold inline-flex items-center gap-1">
                +{extra} more <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-w-md w-96">
                {calls.slice(1).map((c) => (
                  <DropdownMenuItem key={c.id} className="flex flex-col items-start gap-1 cursor-default" onSelect={(e) => e.preventDefault()}>
                    <div className="text-sm font-medium">
                      {c.caller_name || c.caller_phone || 'Unknown'} · {PROVIDER_LABEL[c.provider] || c.provider}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.caller_phone || ''} · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </div>
                    <div className="flex gap-2 mt-1">
                      {c.caller_phone && (
                        <a href={`tel:${c.caller_phone.replace(/\s/g, '')}`} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Call</a>
                      )}
                      {c.matched_lead_id && onOpenLead && (
                        <button onClick={() => onOpenLead(c.matched_lead_id!)} className="text-xs bg-gray-200 px-2 py-1 rounded">Open lead</button>
                      )}
                      <button onClick={() => acknowledge(c.id)} className="text-xs bg-gray-200 px-2 py-1 rounded">Got it</button>
                      <button onClick={() => dismiss(c.id)} className="text-xs bg-gray-200 px-2 py-1 rounded">Dismiss</button>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
};
