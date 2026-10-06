import React from 'react';
import { toast } from 'sonner';
import { useWhatsAppConversations } from '@/hooks/useWhatsAppConversations';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { useIsManagement } from '@/hooks/useIsManagement';
import WhatsAppHotLeadAlerts from './WhatsAppHotLeadAlerts';

interface Props {
  onOpenChat: () => void;
}

/**
 * Global mount of the hot WhatsApp lead alerts so they show in the Live Alerts
 * panel on every admin tab, not just while the WhatsApp Leads tab is open.
 * WhatsApp data stays management-only (hard rule); "Open chat"/"Take Lead"
 * jump to the WhatsApp Leads tab.
 */
export const WhatsAppHotLeadAlertsGlobal: React.FC<Props> = ({ onOpenChat }) => {
  const adminId = useCurrentAdminId();
  const { isManagement } = useIsManagement();
  const { conversations, claimLead } = useWhatsAppConversations();

  if (!isManagement) return null;

  const handleTake = async (conversationId: string) => {
    if (!adminId) return;
    const res = await claimLead(conversationId, adminId);
    if (res.ok) {
      toast.success('Lead is yours - the customer is waiting');
      onOpenChat();
    } else {
      toast.error(
        res.reason === 'already_taken'
          ? 'Another agent has just taken that lead.'
          : 'That lead could not be taken.',
      );
    }
  };

  return (
    <WhatsAppHotLeadAlerts
      conversations={conversations}
      currentAdminId={adminId}
      onOpen={onOpenChat}
      onTake={(id) => void handleTake(id)}
    />
  );
};

export default WhatsAppHotLeadAlertsGlobal;
