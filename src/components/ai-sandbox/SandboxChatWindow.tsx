import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Headset, PhoneCall, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
} from '@/components/ai-elements/prompt-input';
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from '@/components/ai-elements/tool';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import milesAvatar from '@/assets/miles-avatar.png.asset.json';
import milesWaving from '@/assets/miles-waving.png.asset.json';
import { isTeamOpenNow, openingHoursLabel, nextOpeningLabel } from '@/lib/aiSandbox/openingHours';
import { useSandboxSpecialistPresence } from '@/hooks/useSandboxSpecialistPresence';


const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-sandbox-chat`;

const AGENT_PREFIX = '(Warranty specialist)';

const OPENING_LINE =
  "Hey — I'm Miles, the AI assistant here (a real specialist can jump in whenever you want one). Give me a minute and I'll find you the right cover. What's the vehicle? Pop the reg in if you've got it, or just the make, model and year.";

const STARTERS = [
  'AB12 CDE, 2018 Ford Focus, 62,000 miles',
  "What's covered on Platinum?",
  'Can I pay monthly?',
  "Feels a bit pricey — can I talk to someone?",
];


type Handover = {
  id: string;
  kind: string;
  status: string;
  reason: string | null;
  customer_name: string | null;
  cover_summary: string | null;
  quoted_price: number | null;
  created_at: string;
};

type Sender = 'ai' | 'agent' | 'customer';

function senderOf(message: UIMessage): Sender {
  if (message.role === 'user') return 'customer';
  const meta = message.metadata as { sender?: Sender } | undefined;
  if (meta?.sender === 'agent') return 'agent';
  const firstText = message.parts.find((p) => p.type === 'text') as { text?: string } | undefined;
  if (firstText?.text?.startsWith(AGENT_PREFIX)) return 'agent';
  return 'ai';
}

function stripPrefix(text: string) {
  return text.startsWith(AGENT_PREFIX) ? text.slice(AGENT_PREFIX.length).trim() : text;
}

function rowsToUIMessages(
  rows: Array<{ id: string; role: string; parts: unknown; content: string }>,
): UIMessage[] {
  return rows.map((row) => {
    const parts =
      Array.isArray(row.parts) && row.parts.length > 0
        ? (row.parts as UIMessage['parts'])
        : [{ type: 'text', text: row.content } as UIMessage['parts'][number]];
    const isAgent = row.role === 'agent' || row.content.startsWith(AGENT_PREFIX);
    return {
      id: row.id,
      role: isAgent ? 'assistant' : (row.role as UIMessage['role']),
      parts,
      ...(isAgent ? { metadata: { sender: 'agent' as Sender } } : {}),
    };
  });
}

function SenderLabel({ sender }: { sender: Sender }) {
  if (sender === 'customer') return null;
  if (sender === 'agent') {
    return (
      <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary">
        <Headset className="h-3.5 w-3.5" />
        Warranty specialist · human
      </div>
    );
  }
  return (
    <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <img
        src={milesAvatar.url}
        alt="Miles the panda"
        width={20}
        height={20}
        className="h-5 w-5 rounded-full"
        loading="lazy"
      />
      Miles · AI assistant
    </div>
  );
}

export function SandboxChatWindow({ threadId }: { threadId: string }) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [handover, setHandover] = useState<Handover | null>(null);
  const [agentMode, setAgentMode] = useState(false);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const open = isTeamOpenNow();
  const { liveCount, liveNames } = useSandboxSpecialistPresence();


  useEffect(() => {
    let active = true;
    setInitialMessages(null);
    setAgentMode(false);
    (async () => {
      const { data, error } = await supabase
        .from('ai_sandbox_messages')
        .select('id, role, parts, content')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      if (!active) return;
      if (error) {
        console.error('Failed to load sandbox messages', error);
        setInitialMessages([]);
        return;
      }
      setInitialMessages(rowsToUIMessages(data ?? []));
    })();
    return () => {
      active = false;
    };
  }, [threadId]);

  const loadHandover = useCallback(async () => {
    const { data } = await supabase
      .from('ai_sandbox_handovers')
      .select('id, kind, status, reason, customer_name, cover_summary, quoted_price, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setHandover((data as Handover) ?? null);
  }, [threadId]);

  useEffect(() => {
    loadHandover();
  }, [loadHandover]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: CHAT_URL,
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.session?.access_token ?? ''}`,
          };
        },
        body: { threadId },
      }),
    [threadId],
  );

  const { messages, setMessages, sendMessage, status, error, stop } = useChat({
    id: threadId,
    transport,
    messages: initialMessages ?? [],
    onFinish: () => {
      loadHandover();
    },
  });

  useEffect(() => {
    composerRef.current?.querySelector('textarea')?.focus();
  }, [threadId, status, agentMode]);

  const busy = status === 'submitted' || status === 'streaming';

  const sendAsAgent = async (text: string) => {
    const content = `${AGENT_PREFIX} ${text}`;
    const { data: session } = await supabase.auth.getUser();
    const localId = `agent-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: localId,
        role: 'assistant',
        parts: [{ type: 'text', text: content }],
        metadata: { sender: 'agent' as Sender },
      } as UIMessage,
    ]);
    const { error: insertError } = await supabase.from('ai_sandbox_messages').insert({
      thread_id: threadId,
      user_id: session.user?.id as string,
      role: 'agent',
      content,
      parts: [{ type: 'text', text: content }],
    });
    if (insertError) console.error('Failed to save specialist message', insertError);
  };

  const send = (text: string) => {
    const trimmed = (text ?? '').trim();
    if (!trimmed || busy) return;
    if (agentMode) {
      void sendAsAgent(trimmed);
      return;
    }
    sendMessage({ text: trimmed });
  };

  const takeChat = async () => {
    setAgentMode(true);
    if (!handover) return;
    const { data: session } = await supabase.auth.getUser();
    await supabase
      .from('ai_sandbox_handovers')
      .update({
        status: 'accepted',
        claimed_by: session.user?.id ?? null,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', handover.id);
    loadHandover();
  };

  if (initialMessages === null) {
    return <div className="flex-1 p-6 text-sm text-muted-foreground">Loading conversation…</div>;
  }

  const waiting = handover?.status === 'waiting' && handover.kind === 'live_handover';
  const leadCaptured = handover?.kind === 'out_of_hours_lead' || handover?.kind === 'callback_request';

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Who you are talking to */}
      <div
        className={`flex flex-wrap items-center gap-2 border-b px-4 py-2 text-xs ${
          agentMode
            ? 'border-primary/30 bg-primary/10 text-primary'
            : 'border-border bg-muted/40 text-muted-foreground'
        }`}
      >
        {agentMode ? (
          <>
            <Headset className="h-3.5 w-3.5" />
            <span className="font-medium">You are replying as a human warranty specialist</span>
            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setAgentMode(false)}>
              Hand back to AI
            </Button>
          </>
        ) : (
          <>
            <img
              src={milesAvatar.url}
              alt="Miles the panda"
              width={24}
              height={24}
              className="h-6 w-6 rounded-full ring-1 ring-border"
              loading="lazy"
            />
            <span className="font-medium">You're chatting with Miles, our AI assistant</span>
            <span className="opacity-70">·</span>
            {liveCount > 0 ? (
              <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
                </span>
                <Headset className="h-3.5 w-3.5" />
                {liveCount === 1 ? 'A warranty specialist is online now' : `${liveCount} warranty specialists are online now`}
                {liveNames.length > 0 ? ` (${liveNames.slice(0, 2).join(', ')})` : ''} — just say the word
              </span>
            ) : (
              <>
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {open
                    ? `Specialists are around ${openingHoursLabel.toLowerCase()} — I can call one in`
                    : `Team's closed just now — back ${nextOpeningLabel()}`}
                </span>
              </>
            )}
          </>

        )}
      </div>

      {(waiting || leadCaptured) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          <PhoneCall className="h-3.5 w-3.5" />
          {waiting ? (
            <>
              <span className="font-medium">A warranty specialist has been alerted</span>
              <span>
                Reason: {handover?.reason?.replace(/_/g, ' ')}
                {handover?.quoted_price ? ` · £${Math.round(handover.quoted_price)}` : ''}
              </span>
              {!agentMode && (
                <Button size="sm" className="h-6 px-2" onClick={takeChat}>
                  Take this chat
                </Button>
              )}
            </>
          ) : (
            <span className="font-medium">
              Lead captured out of hours{handover?.customer_name ? ` for ${handover.customer_name}` : ''} — a
              specialist picks this up {nextOpeningLabel()}
            </span>
          )}
        </div>
      )}

      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          <Message from="assistant">
            <MessageContent>
              <SenderLabel sender="ai" />
              <MessageResponse>{OPENING_LINE}</MessageResponse>
            </MessageContent>
          </Message>

          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <img
                src={milesWaving.url}
                alt="Miles the panda waving hello"
                width={160}
                height={160}
                className="h-40 w-auto drop-shadow-sm"
                loading="lazy"
              />
              <p className="text-sm font-medium text-foreground">
                Hi, I&apos;m Miles — ask me anything about your cover
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => {
            const sender = senderOf(message);
            return (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  <SenderLabel sender={sender} />
                  {message.parts.map((part, i) => {
                    if (part.type === 'text') {
                      return <MessageResponse key={i}>{stripPrefix(part.text)}</MessageResponse>;
                    }
                    if (part.type === 'reasoning' && part.text) {
                      return (
                        <p key={i} className="text-xs italic text-muted-foreground">
                          {part.text}
                        </p>
                      );
                    }
                    if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
                      const p = part as unknown as {
                        type: string;
                        state: string;
                        input?: unknown;
                        output?: unknown;
                        errorText?: string;
                      };
                      return (
                        <Tool key={i} defaultOpen={false}>
                          <ToolHeader type={p.type as `tool-${string}`} state={p.state as never} />
                          <ToolContent>
                            <ToolInput input={p.input} />
                            <ToolOutput output={p.output} errorText={p.errorText} />
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            );
          })}

          {status === 'submitted' && (
            <div className="px-2 py-3">
              <Shimmer>Thinking…</Shimmer>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error.message || 'Something went wrong. Please try again.'}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl p-4" ref={composerRef}>
        <PromptInput onSubmit={(message) => send(message.text ?? '')}>
          <PromptInputTextarea
            placeholder={
              agentMode
                ? 'Reply as the warranty specialist…'
                : 'Ask about cover, pricing, claims…'
            }
          />
          <PromptInputFooter className="justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                Sandbox · test links only
              </Badge>
              {agentMode && (
                <Badge className="text-[10px] uppercase tracking-wide">Human specialist</Badge>
              )}
            </div>
            <PromptInputSubmit status={status} onClick={busy ? () => stop() : undefined} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

export default SandboxChatWindow;
