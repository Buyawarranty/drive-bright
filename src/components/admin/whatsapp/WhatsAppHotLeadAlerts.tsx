import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { pushRecentAlert } from '@/lib/recentAlerts';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { AlertRailSlot, ALERT_RAIL_ORDER } from '@/components/admin/AlertRail';
import { prettyWhatsAppPhone } from '@/lib/whatsappHeat';
import type { WhatsAppConversation } from '@/hooks/useWhatsAppConversations';

interface Props {
  conversations: WhatsAppConversation[];
  currentAdminId: string | null;
  onOpen: (conversationId: string) => void;
  onTake: (conversationId: string) => void;
}

/**
 * Red alert card in the shared left-hand rail for unclaimed hot WhatsApp leads.
 * It disappears for everyone as soon as an agent claims the lead.
 */
export const WhatsAppHotLeadAlerts: React.FC<Props> = ({
  conversations,
  currentAdminId,
  onOpen,
  onTake,
}) => {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [ownerByLeadId, setOwnerByLeadId] = useState<Record<string, string>>({});

  const hot = useMemo(
    () =>
      conversations
        .filter((c) => c.heat === 'hot' && !c.assigned_to && c.is_open && !dismissed.includes(c.id))
        .slice(0, 3),
    [conversations, dismissed],
  );

  // Tag each card with the agent who owns the matching lead (if any).
  useEffect(() => {
    const leadIds = [...new Set(hot.map((c) => c.lead_id).filter(Boolean))] as string[];
    const missing = leadIds.filter((id) => !(id in ownerByLeadId));
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      const { data: leads } = await supabase
        .from('sales_leads')
        .select('id, assigned_to')
        .in('id', missing);
      const ownerIds = [...new Set((leads || []).map((l: any) => l.assigned_to).filter(Boolean))];
      const { data: admins } = ownerIds.length
        ? await supabase.from('admin_users').select('id, first_name, last_name, email').in('id', ownerIds as string[])
        : { data: [] as any[] };
      if (cancelled) return;
      const nameOf = (id?: string | null) => {
        const a: any = (admins || []).find((x: any) => x.id === id);
        return a ? [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email : '';
      };
      const next: Record<string, string> = {};
      for (const l of leads || []) next[(l as any).id] = nameOf((l as any).assigned_to);
      setOwnerByLeadId((prev) => ({ ...prev, ...next }));
    })();
    return () => { cancelled = true; };
  }, [hot, ownerByLeadId]);

  if (!currentAdminId || hot.length === 0) return null;

  return (
    <AlertRailSlot order={ALERT_RAIL_ORDER.whatsappHotLead}>
      <div className="space-y-2">
        {hot.map((c) => (
          <div key={c.id} className="rounded-xl border border-emerald-200 border-l-4 border-l-emerald-600 bg-emerald-50 p-3 text-gray-900 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-gray-900">
                🔥 Hot WhatsApp Lead - {c.heat_reason || 'Customer is asking for a quote'}
              </p>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => { pushRecentAlert({ key: `wa-${c.id}`, title: 'WhatsApp hot lead', detail: `${c.display_name || prettyWhatsAppPhone(c.phone)}: ${c.last_message_preview || ''}`.slice(0, 90), tone: 'green' }); setDismissed((prev) => [...prev, c.id]); }}
                className="shrink-0 rounded p-0.5 text-gray-600 hover:bg-emerald-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-600">
              {c.display_name || prettyWhatsAppPhone(c.phone)} · {prettyWhatsAppPhone(c.phone)}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-gray-600">{c.last_message_preview}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => onTake(c.id)}>
                Take Lead
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-gray-600 hover:bg-emerald-100"
                onClick={() => onOpen(c.id)}
              >
                Open chat
              </Button>
            </div>
          </div>
        ))}
      </div>
    </AlertRailSlot>
  );
};

export default WhatsAppHotLeadAlerts;
