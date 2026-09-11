import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, UserPlus, RefreshCw, Search, CheckCircle2, Send } from 'lucide-react';

type Thread = {
  id: string;
  title: string | null;
  source: string | null;
  created_at: string;
  updated_at: string | null;
  sales_lead_id: string | null;
  guest_token: string | null;
};

type Message = {
  id: string;
  role: string;
  content: string | null;
  parts: any;
  created_at: string;
};

const speaker = (role: string) =>
  role === 'user' ? 'Customer' : role === 'agent' ? 'Specialist' : 'Miles (AI)';

const messageText = (m: Message) => {
  if (m.content && m.content.trim()) return m.content.trim();
  const parts = Array.isArray(m.parts) ? m.parts : [];
  return parts
    .filter((p: any) => p?.type === 'text' && typeof p.text === 'string')
    .map((p: any) => p.text.trim())
    .filter(Boolean)
    .join('\n');
};

/** Pull contact details out of what the customer typed so the form pre-fills. */
const detect = (messages: Message[]) => {
  const text = messages.filter((m) => m.role === 'user').map(messageText).join('\n');
  return {
    email: text.match(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/)?.[0] ?? '',
    phone: text.match(/(?:(?:\+44|0)\s?\d[\d\s-]{8,13})/)?.[0]?.replace(/[\s-]/g, '') ?? '',
    registration:
      text
        .match(/\b[A-Z]{2}\d{2}\s?[A-Z]{3}\b|\b[A-Z]\d{1,3}\s?[A-Z]{3}\b/i)?.[0]
        ?.toUpperCase()
        .replace(/\s/g, '') ?? '',
  };
};

/**
 * Every customer conversation with Miles, in full, with a one-click
 * "Send as new lead" that writes the whole chat into the lead's notes.
 */
export default function ChatConversationsPanel({ rangeDays, fromIso, toIso }: { rangeDays: string; fromIso?: string | null; toIso?: string | null }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', registration: '' });

  const loadThreads = async () => {
    setLoading(true);
    let query = supabase
      .from('ai_sandbox_threads')
      .select('id, title, source, created_at, updated_at, sales_lead_id, guest_token')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(300);
    if (fromIso || toIso) {
      if (fromIso) query = query.gte('created_at', fromIso);
      if (toIso) query = query.lte('created_at', toIso);
    } else if (rangeDays !== 'all') {
      const from = new Date();
      from.setDate(from.getDate() - Number(rangeDays));
      query = query.gte('created_at', from.toISOString());
    }
    const { data, error } = await query;
    if (error) {
      toast.error(`Could not load conversations: ${error.message}`);
      setThreads([]);
    } else {
      setThreads((data ?? []) as Thread[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays, fromIso, toIso]);

  const openThread = async (thread: Thread) => {
    setSelectedId(thread.id);
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from('ai_sandbox_messages')
      .select('id, role, content, parts, created_at')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true });
    setLoadingMessages(false);
    if (error) {
      toast.error(`Could not load this conversation: ${error.message}`);
      setMessages([]);
      return;
    }
    const rows = (data ?? []) as Message[];
    setMessages(rows);
    const found = detect(rows);
    setForm({ name: '', ...found });
  };

  const selected = threads.find((t) => t.id === selectedId) ?? null;

  // ---- Live reply: type here and the customer sees it in their chat box ----
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);

  const refreshMessages = async (threadId: string) => {
    const { data } = await supabase
      .from('ai_sandbox_messages')
      .select('id, role, content, parts, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as Message[]);
  };

  // Keep the open conversation up to date so a customer's new message appears
  // while the agent is reading it.
  useEffect(() => {
    if (!selectedId) return;
    const t = window.setInterval(() => void refreshMessages(selectedId), 6000);
    return () => window.clearInterval(t);
  }, [selectedId]);

  const sendReply = async () => {
    const text = reply.trim();
    if (!selected || !text) return;
    setReplying(true);
    try {
      const { data, error } = await supabase.functions.invoke('chat-live-reply', {
        body: { action: 'send', threadId: selected.id, text },
      });
      if (error) throw error;
      if ((data as any)?.ok === false) throw new Error((data as any).error || 'Could not send');
      setReply('');
      await refreshMessages(selected.id);
      toast.success('Sent — the customer sees it in their chat box');
    } catch (e: any) {
      toast.error(e?.message || 'Could not send that reply');
    } finally {
      setReplying(false);
    }
  };

  const lastCustomerAt = useMemo(() => {
    const customer = messages.filter((m) => m.role === 'user');
    return customer.length ? new Date(customer[customer.length - 1].created_at) : null;
  }, [messages]);
  const customerLikelyLive =
    lastCustomerAt !== null && Date.now() - lastCustomerAt.getTime() < 15 * 60 * 1000;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) =>
      [t.title, t.source].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [threads, search]);

  const sendAsLead = async () => {
    if (!selected) return;
    if (!form.email.trim() && !form.phone.trim()) {
      toast.error('Add a phone number or an email address first');
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('chat-thread-to-lead', {
        body: { threadId: selected.id, ...form },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const created = (data as any)?.created;
      toast.success(
        created
          ? 'New lead created — the full conversation is in its notes'
          : 'This customer already had a lead — the conversation was added to their notes',
      );
      await loadThreads();
    } catch (e: any) {
      toast.error(e?.message || 'Could not send this conversation as a lead');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Conversations ({filtered.length})
            </span>
            <Button size="sm" variant="ghost" onClick={loadThreads} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ScrollArea className="h-[520px] pr-3">
            <div className="space-y-1.5">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => openThread(t)}
                  className={`w-full rounded-md border p-2 text-left text-sm transition-colors hover:bg-muted ${
                    selectedId === t.id ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{t.title || 'Website chat'}</span>
                    {t.sales_lead_id && (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 shrink-0">
                        Lead
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(t.updated_at || t.created_at).toLocaleString('en-GB')}</span>
                    {t.source && <Badge variant="outline" className="text-[10px]">{t.source}</Badge>}
                  </div>
                </button>
              ))}
              {!loading && filtered.length === 0 && (
                <p className="text-sm text-muted-foreground">No conversations in this period.</p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {selected ? selected.title || 'Website chat' : 'Pick a conversation'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selected && (
            <p className="text-sm text-muted-foreground">
              Choose a conversation on the left to read it in full and send the customer through as a
              new lead.
            </p>
          )}

          {selected && (
            <>
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Customer details to send as a lead
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <Label className="text-xs">Full name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Phone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="07…"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="name@example.com"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Registration</Label>
                    <Input
                      value={form.registration}
                      onChange={(e) => setForm({ ...form, registration: e.target.value.toUpperCase() })}
                      placeholder="AB12CDE"
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button onClick={sendAsLead} disabled={sending}>
                    <UserPlus className="mr-1 h-4 w-4" />
                    {sending ? 'Sending…' : 'Send as new lead'}
                  </Button>
                  {selected.sales_lead_id && (
                    <Button variant="outline" asChild>
                      <a href={`/admin-dashboard/?tab=new-leads&leadId=${selected.sales_lead_id}`}>
                        <CheckCircle2 className="mr-1 h-4 w-4 text-emerald-600" /> Open the lead
                      </a>
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground">
                    The whole conversation is added to the lead's notes.
                  </span>
                </div>
              </div>

              <ScrollArea className="h-[420px] rounded-md border p-3">
                {loadingMessages && <p className="text-sm text-muted-foreground">Loading…</p>}
                <div className="space-y-3">
                  {messages.map((m) => {
                    const text = messageText(m);
                    if (!text) return null;
                    const isCustomer = m.role === 'user';
                    return (
                      <div key={m.id} className={isCustomer ? 'text-right' : 'text-left'}>
                        <div
                          className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                            isCustomer
                              ? 'bg-primary/10 text-foreground'
                              : m.role === 'agent'
                                ? 'bg-emerald-50 text-foreground border border-emerald-200'
                                : 'bg-muted text-foreground'
                          }`}
                        >
                          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {speaker(m.role)} · {new Date(m.created_at).toLocaleString('en-GB')}
                          </div>
                          {text}
                        </div>
                      </div>
                    );
                  })}
                  {!loadingMessages && messages.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No messages saved for this conversation.
                    </p>
                  )}
                </div>
              </ScrollArea>

              <div className="rounded-md border p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Reply live to this customer
                  </span>
                  {customerLikelyLive ? (
                    <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800">
                      Customer active now
                    </Badge>
                  ) : (
                    <Badge variant="outline">May have left the chat</Badge>
                  )}
                </div>
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void sendReply();
                    }
                  }}
                  rows={3}
                  placeholder="Type your answer — the customer sees it straight away in their chat box…"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button onClick={sendReply} disabled={replying || !reply.trim()}>
                    <Send className="mr-1 h-4 w-4" />
                    {replying ? 'Sending…' : 'Send to customer'}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    It shows as a warranty specialist, not as Miles.
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
