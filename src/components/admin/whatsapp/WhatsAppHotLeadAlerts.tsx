import React, { useMemo, useState } from 'react';
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

  const hot = useMemo(
    () =>
      conversations
        .filter((c) => c.heat === 'hot' && !c.assigned_to && c.is_open && !dismissed.includes(c.id))
        .slice(0, 3),
    [conversations, dismissed],
  );

  if (!currentAdminId || hot.length === 0) return null;

  return (
    <AlertRailSlot order={ALERT_RAIL_ORDER.whatsappHotLead}>
      <div className="space-y-2">
        {hot.map((c) => (
          <div key={c.id} className="rounded-lg bg-red-600 p-3 text-white shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-white">
                🔥 Hot WhatsApp Lead - {c.heat_reason || 'Customer is asking for a quote'}
              </p>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => setDismissed((prev) => [...prev, c.id])}
                className="shrink-0 rounded p-0.5 text-white hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-white/90">
              {c.display_name || prettyWhatsAppPhone(c.phone)} · {prettyWhatsAppPhone(c.phone)}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-white/90">{c.last_message_preview}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => onTake(c.id)}>
                Take Lead
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/20"
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
