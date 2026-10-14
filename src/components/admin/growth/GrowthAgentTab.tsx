import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Lightbulb, Plus, Trash2, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from '@/components/ai-elements/tool';
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from '@/components/ai-elements/prompt-input';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/growth-agent`;
const db = supabase as any;

type Thread = { id: string; title: string; updated_at: string };

const STARTERS = [
  'Why have website sales changed over the last 30 days?',
  'Which open leads should we call first this week, and what should we say?',
  'Write 3 Facebook ad ideas for our most popular cover.',
  'Suggest 5 new blog topics we haven\'t covered yet.',
];

function ChatWindow({ threadId, initialMessages, onActivity }: { threadId: string; initialMessages: UIMessage[]; onActivity: () => void }) {
  const composerRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(() => new DefaultChatTransport({
    api: CHAT_URL,
    headers: async () => {
      const { data } = await supabase.auth.getSession();
      return { Authorization: `Bearer ${data.session?.access_token ?? ''}` };
    },
    body: { threadId },
  }), [threadId]);
  const { messages, sendMessage, status, error, stop } = useChat({ id: threadId, transport, messages: initialMessages, onFinish: onActivity });
  const [text, setText] = useState('');

  useEffect(() => { composerRef.current?.querySelector('textarea')?.focus(); }, [threadId, status]);

  const send = (t: string) => {
    const v = t.trim();
    if (!v || status === 'submitted' || status === 'streaming') return;
    sendMessage({ text: v });
    setText('');
    setTimeout(onActivity, 800);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <Conversation className="flex-1 min-h-0">
        <ConversationContent>
          {messages.length === 0 && (
            <div className="py-10 text-center space-y-4">
              <TrendingUp className="h-8 w-8 mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Ask about sales, leads, marketing or brand wording. Suggestions only — nothing is changed or sent.</p>
              <div className="grid gap-2 sm:grid-cols-2 max-w-2xl mx-auto">
                {STARTERS.map(s => (
                  <button key={s} onClick={() => send(s)} className="text-left text-sm rounded-md border border-border p-3 hover:bg-muted">{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map(m => (
            <Message key={m.id} from={m.role}>
              <MessageContent className={m.role === 'user' ? 'bg-primary text-primary-foreground' : ''}>
                {m.parts.map((p: any, i) => {
                  if (p.type === 'text') return m.role === 'assistant'
                    ? <MessageResponse key={i}>{p.text}</MessageResponse>
                    : <p key={i} className="whitespace-pre-wrap">{p.text}</p>;
                  if (typeof p.type === 'string' && p.type.startsWith('tool-')) return (
                    <Tool key={i} defaultOpen={false}>
                      <ToolHeader type={p.type} state={p.state} title={p.type.slice(5).replace(/_/g, ' ')} />
                      <ToolContent>
                        <ToolInput input={p.input} />
                        <ToolOutput output={p.output} errorText={p.errorText} />
                      </ToolContent>
                    </Tool>
                  );
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}
          {status === 'submitted' && <p className="text-sm text-muted-foreground animate-pulse">Looking at your data…</p>}
          {error && <p className="text-sm text-destructive">{error.message || 'Something went wrong. Please try again.'}</p>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div ref={composerRef} className="pt-3">
        <PromptInput onSubmit={(msg: any) => send(msg?.text ?? text)}>
          <PromptInputTextarea value={text} onChange={(e: any) => setText(e.target.value)} placeholder="Ask the growth assistant…" />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} disabled={!text.trim() && status === 'ready'} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

export default function GrowthAgentTab() {
  const [params, setParams] = useSearchParams();
  const threadId = params.get('thread');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loaded, setLoaded] = useState<{ id: string; messages: UIMessage[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const openThread = useCallback((id: string) => {
    setParams(prev => { const n = new URLSearchParams(prev); n.set('tab', 'growth-agent'); n.set('thread', id); return n; });
  }, [setParams]);

  const loadThreads = useCallback(async () => {
    const { data, error } = await db.from('growth_agent_threads').select('id,title,updated_at').order('updated_at', { ascending: false });
    if (error) { setErr(error.message); return []; }
    setThreads(data ?? []);
    return (data ?? []) as Thread[];
  }, []);

  const newThread = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await db.from('growth_agent_threads').insert({ user_id: u.user.id }).select('id').single();
    if (error) { setErr(error.message); return; }
    await loadThreads();
    openThread(data.id);
  }, [loadThreads, openThread]);

  useEffect(() => {
    loadThreads().then(list => {
      if (!threadId && list.length) openThread(list[0].id);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!threadId) { setLoaded(null); return; }
    let cancelled = false;
    db.from('growth_agent_messages').select('sdk_message_id,id,role,parts').eq('thread_id', threadId).order('created_at')
      .then(({ data, error }: any) => {
        if (cancelled) return;
        if (error) { setErr(error.message); return; }
        setLoaded({ id: threadId, messages: (data ?? []).map((r: any) => ({ id: r.sdk_message_id || r.id, role: r.role, parts: r.parts ?? [] })) });
      });
    return () => { cancelled = true; };
  }, [threadId]);

  const remove = async (id: string) => {
    if (!confirm('Delete this conversation?')) return;
    const { error } = await db.from('growth_agent_threads').delete().eq('id', id);
    if (error) { setErr(error.message); return; }
    const list = await loadThreads();
    if (id === threadId) {
      if (list[0]) openThread(list[0].id);
      else setParams(prev => { const n = new URLSearchParams(prev); n.delete('thread'); return n; });
    }
  };

  return (
    <div className="p-4 md:p-6 h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold">Growth assistant</h1>
          <p className="text-sm text-muted-foreground">Super admin only. Reads your sales, leads and blogs and suggests what to do — it never changes or sends anything.</p>
        </div>
      </div>
      {err && <p className="text-sm text-destructive mb-2">{err}</p>}
      <div className="flex gap-4 flex-1 min-h-0">
        <aside className="w-60 shrink-0 flex flex-col border border-border rounded-lg p-2 min-h-0">
          <Button size="sm" onClick={newThread} className="mb-2"><Plus className="h-4 w-4 mr-1" />New conversation</Button>
          <div className="overflow-y-auto space-y-1">
            {threads.map(t => (
              <div key={t.id} className={`group flex items-center rounded-md ${t.id === threadId ? 'bg-muted' : 'hover:bg-muted/60'}`}>
                <button onClick={() => openThread(t.id)} className="flex-1 text-left text-sm px-2 py-1.5 truncate">{t.title}</button>
                <button onClick={() => remove(t.id)} aria-label="Delete conversation" className="p-1.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {threads.length === 0 && <p className="text-xs text-muted-foreground px-2">No conversations yet.</p>}
          </div>
        </aside>
        <section className="flex-1 min-w-0 border border-border rounded-lg p-3 flex flex-col min-h-0">
          {!threadId ? (
            <div className="m-auto text-center space-y-3">
              <p className="text-sm text-muted-foreground">Start a conversation to get sales and marketing ideas.</p>
              <Button onClick={newThread}><Plus className="h-4 w-4 mr-1" />New conversation</Button>
            </div>
          ) : loaded?.id === threadId ? (
            <ChatWindow key={threadId} threadId={threadId} initialMessages={loaded.messages} onActivity={loadThreads} />
          ) : (
            <p className="m-auto text-sm text-muted-foreground">Loading…</p>
          )}
        </section>
      </div>
    </div>
  );
}
