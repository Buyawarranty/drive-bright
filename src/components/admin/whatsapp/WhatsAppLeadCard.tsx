import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Clock, User } from 'lucide-react';
import { heatBadge, prettyWhatsAppPhone } from '@/lib/whatsappHeat';
import { pipelineClass, pipelineLabel } from '@/lib/whatsappPipeline';
import type { WhatsAppConversation } from '@/hooks/useWhatsAppConversations';
import type { AdminUserLite } from '@/hooks/useAllAdminUsersMap';

const timeAgo = (iso: string | null) => {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(iso).toLocaleDateString('en-GB');
};

interface Props {
  conversation: WhatsAppConversation;
  agent?: AdminUserLite;
  isSelected?: boolean;
  canTake: boolean;
  taking?: boolean;
  onTake: () => void;
  onOpen: () => void;
  showSource?: boolean;
  tags?: { id: string; name: string; color: string }[];
}

export const WhatsAppLeadCard: React.FC<Props> = ({
  conversation,
  agent,
  isSelected,
  canTake,
  taking,
  onTake,
  onOpen,
  showSource = true,
}) => {
  const heat = heatBadge(conversation.heat);
  const overdue =
    conversation.next_follow_up_at && new Date(conversation.next_follow_up_at).getTime() < Date.now();
  const agentName = agent
    ? [agent.first_name, agent.last_name].filter(Boolean).join(' ') || agent.email
    : conversation.assigned_to
      ? 'Assigned'
      : 'Unassigned';

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        isSelected ? 'border-primary bg-accent' : 'border-border bg-card hover:bg-accent/50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">
              {conversation.display_name || prettyWhatsAppPhone(conversation.phone)}
            </span>
            <Badge className={heat.className}>
              {heat.emoji} {heat.label}
            </Badge>
            {conversation.unread_count > 0 && (
              <Badge className="bg-emerald-600 text-white">{conversation.unread_count} new</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{prettyWhatsAppPhone(conversation.phone)}</p>
        </div>
        {canTake && !conversation.assigned_to && (
          <Button
            size="sm"
            disabled={taking}
            onClick={(e) => {
              e.stopPropagation();
              onTake();
            }}
          >
            {taking ? 'Taking…' : 'Take Lead'}
          </Button>
        )}
      </div>

      <p className="mt-2 flex items-start gap-1 text-sm text-foreground/80">
        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="line-clamp-2">{conversation.last_message_preview || 'No messages yet'}</span>
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" /> {timeAgo(conversation.last_message_at)}
        </span>
        <Badge variant="outline" className={pipelineClass(conversation.pipeline_status)}>
          {pipelineLabel(conversation.pipeline_status)}
        </Badge>
        {showSource && <Badge variant="outline">WhatsApp</Badge>}
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" /> {agentName}
        </span>
        {overdue && <Badge className="bg-destructive text-destructive-foreground">Follow-up overdue</Badge>}
      </div>
    </button>
  );
};

export default WhatsAppLeadCard;
