import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, CheckCheck, Send, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useWhatsAppMessages } from '@/hooks/useWhatsAppMessages';
import { useAllAdminUsersMap } from '@/hooks/useAllAdminUsersMap';
import { heatBadge, prettyWhatsAppPhone } from '@/lib/whatsappHeat';
import { pipelineClass, pipelineLabel, type WhatsAppPipelineStatus } from '@/lib/whatsappPipeline';
import WhatsAppPipelineBar from './WhatsAppPipelineBar';
import WhatsAppTagPicker from './WhatsAppTagPicker';
import type { WhatsAppConversation } from '@/hooks/useWhatsAppConversations';

interface Props {
  conversation: WhatsAppConversation;
  currentAdminId: string | null;
  canReply: boolean;
  onStatusChange: (status: WhatsAppPipelineStatus) => void;
  onFollowUpChange: (whenIso: string | null) => void;
}

const StatusTicks: React.FC<{ status: string | null }> = ({ status }) => {
  if (status === 'read') return <CheckCheck className="h-3 w-3 text-sky-600" aria-label="Read" />;
  if (status === 'delivered') return <CheckCheck className="h-3 w-3 opacity-70" aria-label="Delivered" />;
  if (status === 'failed') return <span className="text-[10px] font-semibold text-destructive">Failed</span>;
  return <Check className="h-3 w-3 opacity-70" aria-label="Sent" />;
};

/** The agent's WhatsApp workspace: full thread plus a reply box. */
export const WhatsAppConversationPanel: React.FC<Props> = ({
  conversation,
  currentAdminId,
  canReply,
  onStatusChange,
  onFollowUpChange,
}) => {
  const { messages, sending, sendMessage } = useWhatsAppMessages(conversation.id);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const agentIds = useMemo(
    () => Array.from(new Set(messages.map((m) => m.sent_by_admin_id).filter(Boolean))) as string[],
    [messages],
  );
  const agents = useAllAdminUsersMap([...agentIds, conversation.assigned_to]);
  const heat = heatBadge(conversation.heat);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const followUpValue = conversation.next_follow_up_at
    ? new Date(conversation.next_follow_up_at).toISOString().slice(0, 16)
    : '';

  const handleSend = async () => {
    const text = draft.trim();
    if (!text) return;
    const res = await sendMessage(text);
    if (res.ok) {
      setDraft('');
    } else {
      const reason = String(res.reason || '');
      toast.error(
        reason.includes('wati_not_configured')
          ? 'WhatsApp sending is not switched on yet - add the WATI details first.'
          : 'That message could not be sent. Please try again.',
      );
    }
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            {conversation.display_name || prettyWhatsAppPhone(conversation.phone)}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={heat.className}>
              {heat.emoji} {heat.label}
            </Badge>
            <Badge variant="outline" className={pipelineClass(conversation.pipeline_status)}>
              {pipelineLabel(conversation.pipeline_status)}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {prettyWhatsAppPhone(conversation.phone)}
          {conversation.heat_reason ? ` · ${conversation.heat_reason}` : ''}
        </p>
        <WhatsAppPipelineBar
          status={conversation.pipeline_status}
          disabled={!canReply}
          onChange={onStatusChange}
        />
        <WhatsAppTagPicker conversationId={conversation.id} />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" /> Next follow-up
          </span>
          <Input
            type="datetime-local"
            className="h-8 w-[210px]"
            value={followUpValue}
            disabled={!canReply}
            onChange={(e) =>
              onFollowUpChange(e.target.value ? new Date(e.target.value).toISOString() : null)
            }
          />
          {conversation.next_follow_up_at && (
            <Button size="sm" variant="ghost" disabled={!canReply} onClick={() => onFollowUpChange(null)}>
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="min-h-[240px] flex-1 space-y-2 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">No messages in this conversation yet.</p>
          )}
          {messages.map((m) => {
            const mine = m.direction === 'outbound';
            const agent = m.sent_by_admin_id ? agents.get(m.sent_by_admin_id) : undefined;
            const agentName = agent
              ? [agent.first_name, agent.last_name].filter(Boolean).join(' ') || agent.email
              : 'Our team';
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    mine
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border bg-card text-foreground'
                  }`}
                >
                  {mine && (
                    <p className="mb-0.5 text-[10px] font-semibold text-primary-foreground opacity-80">
                      {agentName}
                    </p>
                  )}
                  {m.body && (
                    <p className="whitespace-pre-wrap break-words text-primary-foreground">{m.body}</p>
                  )}
                  {m.media_url && (
                    <a
                      href={m.media_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-primary-foreground underline"
                    >
                      {m.media_type || 'attachment'}
                    </a>
                  )}
                  <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-80">
                    <span>
                      {new Date(m.wati_timestamp || m.created_at).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {mine && <StatusTicks status={m.status} />}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {canReply ? (
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type your WhatsApp reply…"
              rows={2}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <Button onClick={handleSend} disabled={sending || !draft.trim()}>
              <Send className="mr-1 h-4 w-4" /> {sending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        ) : (
          <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            Take this lead to reply to the customer.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default WhatsAppConversationPanel;
