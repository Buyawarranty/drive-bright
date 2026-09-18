import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MessagesSquare, Phone, Mail, X, ChevronDown, ChevronUp, Car } from 'lucide-react';
import { setVisibleInterval } from '@/lib/visibilityInterval';
import { AlertRailSlot, ALERT_RAIL_ORDER } from '@/components/admin/AlertRail';

const DISMISSED_IDS_KEY = 'chat-agent-request-dismissed-ids';

interface ChatLeadRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  vehicle_reg: string | null;
  created_at: string;
}

const minsAgo = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

const readDismissed = (): string[] => {
  try {
    const raw = localStorage.getItem(DISMISSED_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Blue "chat customer wants to speak to someone" pop-up.
 *
 * When a website visitor asks Miles for a human and leaves their details
 * (the contact card or typing a number/email in chat), the chatbot creates a
 * lead tagged "Chatbot lead". This surfaces those leads instantly to
 * managers and sales agents in the left alert rail — blue, so it is never
 * confused with the red stuck-on-checkout alert — with a tap-to-call button
 * when a phone number was given.
 */
export const ChatAgentRequestAlert: React.FC<{ onOpenLead?: (leadId: string) => void }> = ({ onOpenLead }) => {
  const [rows, setRows] = useState<ChatLeadRow[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => readDismissed());
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(async () => {
    const { data: tag } = await supabase
      .from('lead_tags')
      .select('id')
      .eq('name', 'Chatbot lead')
      .maybeSingle();
    if (!tag?.id) {
      setRows([]);
      return;
    }
    const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const { data: assigns } = await supabase
      .from('lead_tag_assignments')
      .select('lead_id')
      .eq('tag_id', tag.id);
    const ids = (assigns || []).map((a) => a.lead_id).filter(Boolean);
    if (ids.length === 0) {
      setRows([]);
      return;
    }
    const { data } = await supabase
      .from('sales_leads')
      .select('id, first_name, last_name, email, phone, vehicle_reg, created_at')
      .in('id', ids)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20);
    setRows((data as ChatLeadRow[]) || []);
  }, []);

  useEffect(() => {
    load();
    // Unique channel names: re-subscribing a fixed-name channel throws
    // "cannot add postgres_changes callbacks after subscribe()".
    const suffix = Math.random().toString(36).slice(2);
    const channel = supabase
      .channel(`chat-agent-request-alert-${suffix}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales_leads' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_tag_assignments' }, () => load())
      .subscribe();
    const stop = setVisibleInterval(load, 45_000);
    return () => {
      supabase.removeChannel(channel);
      stop();
    };
  }, [load]);

  const live = useMemo(() => rows.filter((r) => !dismissedIds.includes(r.id)), [rows, dismissedIds]);

  const dismiss = (id: string) => {
    setDismissedIds((prev) => {
      const next = [...new Set([...prev, id])].slice(-200);
      try { localStorage.setItem(DISMISSED_IDS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const dismissAll = () => live.forEach((r) => dismiss(r.id));

  if (live.length === 0) return null;

  return (
    <AlertRailSlot order={ALERT_RAIL_ORDER.chatAgentRequest}>
      <div className="rounded-lg border-2 border-blue-500 bg-blue-600 text-white shadow-xl overflow-hidden">
        <div className="flex items-start justify-between gap-2 px-3 py-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-start gap-2 text-left min-w-0"
          >
            <MessagesSquare className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight text-white">
                {live.length === 1
                  ? 'Chat customer wants to speak to someone'
                  : `${live.length} chat customers want to speak to someone`}
              </p>
              <p className="text-[11px] text-white">From the website chat — call back now</p>
            </div>
            {expanded ? <ChevronUp className="h-4 w-4 mt-0.5 shrink-0" /> : <ChevronDown className="h-4 w-4 mt-0.5 shrink-0" />}
          </button>
          <button
            onClick={dismissAll}
            className="p-1 rounded hover:bg-blue-700 shrink-0"
            title="Close"
            aria-label="Close chat agent request alert"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {expanded && (
          <ul className="bg-white text-gray-900 divide-y divide-blue-100 max-h-[45vh] overflow-y-auto">
            {live.slice(0, 6).map((r) => {
              const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim();
              const phone = (r.phone || '').replace(/\s/g, '');
              const mailto = r.email
                ? `mailto:${r.email}?subject=${encodeURIComponent('Your warranty chat with us')}&body=${encodeURIComponent(
                    'Hi,\n\nThanks for chatting with us — you asked to speak to someone about your warranty. How can we help?\n\nBuy A Warranty',
                  )}`
                : null;
              return (
                <li key={r.id} className="px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {name || r.email || r.phone || 'Chat customer'}
                      </p>
                      <p className="text-[11px] text-blue-700 font-medium truncate">
                        asked for a person in chat · {minsAgo(r.created_at)}m ago
                      </p>
                      {r.vehicle_reg && (
                        <p className="text-[11px] text-gray-600 truncate flex items-center gap-1">
                          <Car className="h-3 w-3 shrink-0" />
                          {r.vehicle_reg.toUpperCase()}
                        </p>
                      )}
                      {phone ? (
                        <p className="text-xs font-bold text-gray-900 mt-0.5">{r.phone}</p>
                      ) : (
                        <p className="text-[11px] text-gray-500 mt-0.5">No phone number given — email only</p>
                      )}
                    </div>
                    <button
                      onClick={() => dismiss(r.id)}
                      className="p-1 rounded hover:bg-blue-50 text-gray-400 shrink-0"
                      title="Dismiss"
                      aria-label="Dismiss"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-2 mt-1.5">
                    {phone && (
                      <a
                        href={`tel:${phone}`}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                      >
                        <Phone className="h-3 w-3" /> Call now
                      </a>
                    )}
                    {mailto && (
                      <a
                        href={mailto}
                        className="inline-flex items-center gap-1 rounded-md border border-blue-200 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
                      >
                        <Mail className="h-3 w-3" /> Email
                      </a>
                    )}
                    {onOpenLead && (
                      <button
                        onClick={() => onOpenLead(r.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Open lead
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AlertRailSlot>
  );
};

export default ChatAgentRequestAlert;
