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
import { matchQuickReplies, slashQuery } from '@/lib/whatsappQuickReplies';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  conversation: WhatsAppConversation;
  currentAdminId: string | null;
  canReply: boolean;
  onStatusChange: (status: WhatsAppPipelineStatus) => void;
  onFollowUpChange: (whenIso: string | null) => void;
}

/** Ready-made tappable button labels (WhatsApp allows 20 characters each). */
const BUTTON_CHOICES = ['Get a quote', 'Make a claim', 'Call me back', 'Yes please', 'Not right now'];

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
  const [highlight, setHighlight] = useState(0);
  const [chosenButtons, setChosenButtons] = useState<string[]>([]);
  const [sendingButtons, setSendingButtons] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const suggestions = useMemo(() => {
    const q = slashQuery(draft);
    return q === null ? [] : matchQuickReplies(q).slice(0, 8);
  }, [draft]);

  const applyQuickReply = (body: string) => {
    setDraft(body);
    setHighlight(0);
    textareaRef.current?.focus();
  };
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

  const toggleButton = (label: string) =>
    setChosenButtons((prev) =>
      prev.includes(label) ? prev.filter((b) => b !== label) : prev.length >= 3 ? prev : [...prev, label],
    );

  const handleSendButtons = async () => {
    const text = draft.trim();
    if (!text || chosenButtons.length === 0) return;
    setSendingButtons(true);
    try {
      const { data, error } = await supabase.functions.invoke('wati-send-buttons', {
        body: { conversationId: conversation.id, message: text, buttons: chosenButtons },
      });
      if (error || (data as any)?.error) throw new Error(String((data as any)?.error || error?.message));
      setDraft('');
      setChosenButtons([]);
      toast.success('Sent with buttons.');
    } catch (e: any) {
      toast.error(
        String(e?.message || '').includes('wati_not_configured')
          ? 'WhatsApp sending is not switched on yet - add the WATI details first.'
          : 'That message could not be sent. Please try again.',
      );
    } finally {
      setSendingButtons(false);
    }
  };

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
          <div className="space-y-1">
            <div className="relative flex items-end gap-2">
              {suggestions.length > 0 && (
                <div className="absolute bottom-full left-0 z-30 mb-2 max-h-64 w-full max-w-xl overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
                  {suggestions.map((r, i) => (
                    <button
                      key={r.command}
                      type="button"
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => applyQuickReply(r.body)}
                      className={`block w-full rounded px-2 py-1.5 text-left ${
                        i === highlight ? 'bg-accent' : ''
                      }`}
                    >
                      <span className="text-sm font-semibold">/{r.command}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{r.label}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{r.body}</span>
                    </button>
                  ))}
                </div>
              )}
              <Textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setHighlight(0);
                }}
                placeholder="Type your WhatsApp reply… or / for a template reply"
                rows={2}
                className="resize-none"
                onKeyDown={(e) => {
                  if (suggestions.length > 0) {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setHighlight((h) => (h + 1) % suggestions.length);
                      return;
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
                      return;
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setDraft('');
                      return;
                    }
                    if (e.key === 'Enter' || e.key === 'Tab') {
                      e.preventDefault();
                      applyQuickReply(suggestions[highlight].body);
                      return;
                    }
                  }
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
            <p className="text-xs text-muted-foreground">
              Type <span className="font-semibold">/</span> to pick a template reply, then edit before sending.
            </p>
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold">Add tappable buttons (up to 3)</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {BUTTON_CHOICES.map((label) => {
                  const on = chosenButtons.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleButton(label)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        on
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background hover:bg-accent'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleSendButtons}
                  disabled={sendingButtons || !draft.trim() || chosenButtons.length === 0}
                >
                  {sendingButtons ? 'Sending…' : 'Send with buttons'}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Your message above is sent with these buttons underneath.
                </span>
              </div>
            </div>
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
