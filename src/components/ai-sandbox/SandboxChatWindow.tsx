import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
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
import rubyLogo from '@/assets/ai-sandbox-ruby.png';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-sandbox-chat`;

const STARTERS = [
  "What's covered on the Platinum plan?",
  'How much for a 2 year warranty on a 2018 Ford Focus?',
  'How do I make a claim?',
  'Can I pay monthly?',
];

function rowsToUIMessages(rows: Array<{ id: string; role: string; parts: unknown; content: string }>): UIMessage[] {
  return rows.map((row) => {
    const parts = Array.isArray(row.parts) && row.parts.length > 0
      ? (row.parts as UIMessage['parts'])
      : [{ type: 'text', text: row.content } as UIMessage['parts'][number]];
    return { id: row.id, role: row.role as UIMessage['role'], parts };
  });
}

export function SandboxChatWindow({ threadId }: { threadId: string }) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let active = true;
    setInitialMessages(null);
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

  const { messages, sendMessage, status, error, stop } = useChat({
    id: threadId,
    transport,
    messages: initialMessages ?? [],
  });

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  const busy = status === 'submitted' || status === 'streaming';

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setInput('');
  };

  if (initialMessages === null) {
    return <div className="flex-1 p-6 text-sm text-muted-foreground">Loading conversation…</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-14 text-center">
              <img src={rubyLogo} alt="Buyawarranty assistant" width={72} height={72} className="h-18 w-18" />
              <div>
                <h2 className="text-lg font-semibold">Ruby — warranty assistant</h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Ask about cover, terms, claims or pricing. Ruby answers from our own site content and can send a
                  test payment link.
                </p>
              </div>
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

          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                {message.parts.map((part, i) => {
                  if (part.type === 'text') {
                    return <MessageResponse key={i}>{part.text}</MessageResponse>;
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
          ))}

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

      <div className="mx-auto w-full max-w-3xl p-4">
        <PromptInput
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <PromptInputTextarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about cover, pricing, claims…"
          />
          <PromptInputFooter className="justify-between">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              Sandbox · test links only
            </Badge>
            <PromptInputSubmit
              status={status}
              disabled={!input.trim() && !busy}
              onClick={busy ? () => stop() : undefined}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

export default SandboxChatWindow;
