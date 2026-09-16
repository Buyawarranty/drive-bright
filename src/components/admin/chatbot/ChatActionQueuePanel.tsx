import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  UserPlus,
  ExternalLink,
  PhoneCall,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useIsManagement } from '@/hooks/useIsManagement';

/**
 * Chatbot action queue — every website chat shown as a New Leads style row,
 * sorted by what actually needs replying to or actioning. Conversations that
 * need nothing (browsing only, or already turned into a lead) are hidden
 * unless the manager asks to see them.
 */

type ThreadRow = {
  id: string;
  title: string | null;
  source: string | null;
  created_at: string;
  updated_at: string | null;
  sales_lead_id: string | null;
};

type EventRow = {
  thread_id: string | null;
  event_type: string;
  topic: string | null;
  customer_wording: string | null;
  registration: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  quoted_price: number | null;
  term_months: number | null;
  knowledge_confident: boolean | null;
  created_at: string;
};

type HandoverRow = {
  thread_id: string | null;
  kind: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  registration: string | null;
  quoted_price: number | null;
  status: string | null;
  claimed_by: string | null;
  created_at: string;
};

type MessageRow = {
  thread_id: string;
  role: string;
  content: string | null;
  parts: any;
  created_at: string;
};

type Band = 'urgent' | 'hot' | 'warm' | 'review' | 'none';

type QueueRow = {
  thread: ThreadRow;
  band: Band;
  reason: string;
  nextAction: string;
  name: string;
  phone: string;
  email: string;
  registration: string;
  vehicle: string;
  quotedPrice: number | null;
  termMonths: number | null;
  messages: number;
  lastCustomerText: string;
  lastActivity: string;
  unanswered: number;
  handoverOpen: boolean;
  callbackAsked: boolean;
};

const BAND_ORDER: Record<Band, number> = { urgent: 0, hot: 1, warm: 2, review: 3, none: 4 };

const BAND_STYLE: Record<Band, string> = {
  urgent: 'bg-red-100 text-red-800 border-red-300',
  hot: 'bg-orange-100 text-orange-900 border-orange-300',
  warm: 'bg-amber-100 text-amber-900 border-amber-300',
  review: 'bg-sky-100 text-sky-800 border-sky-300',
  none: 'bg-slate-100 text-slate-600 border-slate-200',
};

const BAND_LABEL: Record<Band, string> = {
  urgent: 'Reply now',
  hot: 'Call today',
  warm: 'Follow up',
  review: 'Needs an answer',
  none: 'No action',
};

const textOf = (m: { content: string | null; parts: any }) => {
  if (m.content && m.content.trim()) return m.content.trim();
  const parts = Array.isArray(m.parts) ? m.parts : [];
  return parts
    .filter((p: any) => p?.type === 'text' && typeof p.text === 'string')
    .map((p: any) => p.text.trim())
    .filter(Boolean)
    .join(' ');
};

const findEmail = (t: string) => t.match(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/)?.[0] ?? '';
const findPhone = (t: string) =>
  t.match(/(?:(?:\+44|0)\s?\d[\d\s-]{8,13})/)?.[0]?.replace(/[\s-]/g, '') ?? '';
const findReg = (t: string) =>
  t
    .match(/\b[A-Z]{2}\d{2}\s?[A-Z]{3}\b|\b[A-Z]\d{1,3}\s?[A-Z]{3}\b/i)?.[0]
    ?.toUpperCase()
    .replace(/\s/g, '') ?? '';

const timeAgo = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} days ago`;
};

export default function ChatActionQueuePanel({ rangeDays, fromIso, toIso }: { rangeDays: string; fromIso?: string | null; toIso?: string | null }) {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNoAction, setShowNoAction] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<MessageRow[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deleteRow, setDeleteRow] = useState<QueueRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { isManagement } = useIsManagement();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date();
      if (rangeDays !== 'all') since.setDate(since.getDate() - Number(rangeDays));
      const sinceIso = fromIso ?? (rangeDays === 'all' ? null : since.toISOString());
      const untilIso = toIso ?? null;

      let tq = supabase
        .from('ai_sandbox_threads')
        .select('id, title, source, created_at, updated_at, sales_lead_id')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(300);
      if (sinceIso) tq = tq.gte('created_at', sinceIso);
      if (untilIso) tq = tq.lte('created_at', untilIso);
      const { data: threadData, error: tErr } = await tq;
      if (tErr) throw tErr;
      const threads = (threadData ?? []) as ThreadRow[];
      if (threads.length === 0) {
        setRows([]);
        return;
      }
      const ids = threads.map((t) => t.id);

      const [evRes, hoRes, msgRes] = await Promise.all([
        (supabase.from('ai_chat_events' as any) as any)
          .select(
            'thread_id, event_type, topic, customer_wording, registration, vehicle_make, vehicle_model, quoted_price, term_months, knowledge_confident, created_at',
          )
          .in('thread_id', ids)
          .order('created_at', { ascending: true })
          .limit(4000),
        supabase
          .from('ai_sandbox_handovers')
          .select(
            'thread_id, kind, customer_name, customer_email, customer_phone, registration, quoted_price, status, claimed_by, created_at',
          )
          .in('thread_id', ids)
          .limit(1000),
        supabase
          .from('ai_sandbox_messages')
          .select('thread_id, role, content, parts, created_at')
          .in('thread_id', ids)
          .order('created_at', { ascending: true })
          .limit(6000),
      ]);

      const events = ((evRes as any)?.data ?? []) as EventRow[];
      const handovers = ((hoRes as any)?.data ?? []) as HandoverRow[];
      const messages = ((msgRes as any)?.data ?? []) as MessageRow[];

      const byThread = <T extends { thread_id: string | null }>(list: T[]) => {
        const map = new Map<string, T[]>();
        list.forEach((r) => {
          if (!r.thread_id) return;
          const arr = map.get(r.thread_id) ?? [];
          arr.push(r);
          map.set(r.thread_id, arr);
        });
        return map;
      };

      const evMap = byThread(events);
      const hoMap = byThread(handovers);
      const msgMap = byThread(messages as any);

      const built: QueueRow[] = threads.map((thread) => {
        const ev = evMap.get(thread.id) ?? [];
        const ho = hoMap.get(thread.id) ?? [];
        const msgs = (msgMap.get(thread.id) ?? []) as MessageRow[];
        const customerMsgs = msgs.filter((m) => m.role === 'user');
        const customerText = customerMsgs.map(textOf).join('\n');

        const lastHandover = ho
          .slice()
          .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0];
        const handoverOpen = ho.some(
          (h) => !h.claimed_by && (h.status ?? 'open') !== 'closed' && (h.status ?? 'open') !== 'resolved',
        );
        const callbackAsked =
          ho.some((h) => (h.kind ?? '').toLowerCase().includes('call')) ||
          ev.some((e) => e.event_type === 'handover');

        const quoteEvent = ev
          .filter((e) => e.event_type === 'price_quoted' && e.quoted_price)
          .slice(-1)[0];
        const vehicleEvent = ev.filter((e) => e.vehicle_make || e.vehicle_model).slice(-1)[0];
        const unanswered = ev.filter(
          (e) => e.event_type === 'question' && e.knowledge_confident === false,
        ).length;

        const registration =
          lastHandover?.registration ||
          ev.map((e) => e.registration).filter(Boolean).slice(-1)[0] ||
          findReg(customerText);
        const phone = lastHandover?.customer_phone || findPhone(customerText);
        const email = lastHandover?.customer_email || findEmail(customerText);
        const name = lastHandover?.customer_name || '';

        const lastCustomer = customerMsgs.slice(-1)[0];
        const lastMsg = msgs.slice(-1)[0];
        const awaitingReply = !!lastMsg && lastMsg.role === 'user';
        const lastAgent = msgs.filter((m) => m.role === 'agent').slice(-1)[0];
        const liveHandoverAsked = ho.some((h) => h.kind === 'live_handover');
        const pendingHumanReply = Boolean(
          liveHandoverAsked &&
          lastCustomer &&
          (!lastAgent || new Date(lastAgent.created_at).getTime() < new Date(lastCustomer.created_at).getTime()),
        );

        let band: Band = 'none';
        let reason = 'Browsed and left — nothing to action';
        let nextAction = 'No action needed';

        if (thread.sales_lead_id) {
          band = 'none';
          reason = 'Already in New Leads';
          nextAction = 'Work it in New Leads';
        } else if (pendingHumanReply || handoverOpen || (callbackAsked && (phone || email))) {
          band = 'urgent';
          reason = pendingHumanReply
            ? 'Pending human reply — no staff member has answered this customer yet'
            : handoverOpen
              ? 'Asked to speak to a person — nobody has picked it up'
              : 'Callback requested';
          nextAction = pendingHumanReply ? 'Open the chat and reply' : phone ? `Ring ${phone}` : 'Reply by email';
        } else if (awaitingReply && (phone || email || registration)) {
          band = 'urgent';
          reason = 'Customer left a message and gave their details';
          nextAction = phone ? `Ring ${phone}` : 'Reply and create the lead';
        } else if (quoteEvent && (phone || email)) {
          band = 'hot';
          reason = `Was quoted £${Number(quoteEvent.quoted_price)} and left contact details`;
          nextAction = phone ? `Ring ${phone} about the quote` : 'Email the quote follow-up';
        } else if (phone || email) {
          band = 'hot';
          reason = 'Left contact details in the chat';
          nextAction = phone ? `Ring ${phone}` : 'Email the customer';
        } else if (registration) {
          band = 'warm';
          reason = 'Gave a registration but no contact details';
          nextAction = 'Check the reg and look for a matching lead';
        } else if (unanswered > 0) {
          band = 'review';
          reason = `${unanswered} question${unanswered === 1 ? '' : 's'} our approved material could not answer`;
          nextAction = 'Add the answer to the chatbot material';
        } else if (awaitingReply && customerMsgs.length > 0) {
          band = 'review';
          reason = 'Last message was the customer, with no details given';
          nextAction = 'Read the chat and reply if it is worth chasing';
        }

        return {
          thread,
          band,
          reason,
          nextAction,
          name,
          phone,
          email,
          registration,
          vehicle: [vehicleEvent?.vehicle_make, vehicleEvent?.vehicle_model].filter(Boolean).join(' '),
          quotedPrice: quoteEvent ? Number(quoteEvent.quoted_price) : lastHandover?.quoted_price ?? null,
          termMonths: quoteEvent?.term_months ?? null,
          messages: msgs.length,
          lastCustomerText: lastCustomer ? textOf(lastCustomer).slice(0, 160) : '',
          lastActivity: lastMsg?.created_at || thread.updated_at || thread.created_at,
          unanswered,
          handoverOpen,
          callbackAsked,
        };
      });

      built.sort((a, b) => {
        if (BAND_ORDER[a.band] !== BAND_ORDER[b.band]) return BAND_ORDER[a.band] - BAND_ORDER[b.band];
        return +new Date(b.lastActivity) - +new Date(a.lastActivity);
      });
      setRows(built);
    } catch (e: any) {
      toast.error(e?.message || 'Could not load the chat action queue');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [rangeDays, fromIso, toIso]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!showNoAction && r.band === 'none') return false;
      if (!q) return true;
      return [
        r.name,
        r.phone,
        r.email,
        r.registration,
        r.vehicle,
        r.reason,
        r.lastCustomerText,
        r.thread.title,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, search, showNoAction]);

  const counts = useMemo(() => {
    const c: Record<Band, number> = { urgent: 0, hot: 0, warm: 0, review: 0, none: 0 };
    rows.forEach((r) => { c[r.band] += 1; });
    return c;
  }, [rows]);

  const toggleRow = async (threadId: string) => {
    if (expanded === threadId) {
      setExpanded(null);
      return;
    }
    setExpanded(threadId);
    setTranscript([]);
    const { data, error } = await supabase
      .from('ai_sandbox_messages')
      .select('thread_id, role, content, parts, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (error) {
      toast.error(`Could not open this chat: ${error.message}`);
      return;
    }
    setTranscript((data ?? []) as MessageRow[]);
  };

  const sendAsLead = async (row: QueueRow) => {
    if (!row.phone && !row.email) {
      toast.error('No phone or email in this chat — open it and add the details in Conversations & leads');
      return;
    }
    setSendingId(row.thread.id);
    try {
      const { data, error } = await supabase.functions.invoke('chat-thread-to-lead', {
        body: {
          threadId: row.thread.id,
          name: row.name,
          phone: row.phone,
          email: row.email,
          registration: row.registration,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(
        (data as any)?.created
          ? 'New lead created — the whole chat is in its notes'
          : 'Customer already had a lead — the chat was added to their notes',
      );
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Could not send this chat as a lead');
    } finally {
      setSendingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      const { error } = await (supabase.rpc as any)('delete_chat_thread', {
        _thread_id: deleteRow.thread.id,
      });
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.thread.id !== deleteRow.thread.id));
      if (expanded === deleteRow.thread.id) setExpanded(null);
      toast.success('Chat deleted');
      setDeleteRow(null);
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete this chat');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(['urgent', 'hot', 'warm', 'review'] as Band[]).map((b) => (
          <Badge key={b} variant="outline" className={`${BAND_STYLE[b]} text-xs`}>
            {BAND_LABEL[b]} · {counts[b]}
          </Badge>
        ))}
        <Badge variant="outline" className={`${BAND_STYLE.none} text-xs`}>
          No action · {counts.none}
        </Badge>
        <div className="relative ml-auto">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="w-64 pl-8"
            placeholder="Search reg, phone, email, wording…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button size="sm" variant={showNoAction ? 'default' : 'outline'} onClick={() => setShowNoAction((v) => !v)}>
          {showNoAction ? 'Hide no-action chats' : 'Show no-action chats'}
        </Button>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-8 px-2 py-2 text-left">#</th>
                  <th className="px-2 py-2 text-left">Priority</th>
                  <th className="px-2 py-2 text-left">Why it needs action</th>
                  <th className="px-2 py-2 text-left">Name</th>
                  <th className="px-2 py-2 text-left">Phone</th>
                  <th className="px-2 py-2 text-left">Email</th>
                  <th className="px-2 py-2 text-left">Reg</th>
                  <th className="px-2 py-2 text-left">Vehicle</th>
                  <th className="px-2 py-2 text-left">Quote</th>
                  <th className="px-2 py-2 text-left">Msgs</th>
                  <th className="px-2 py-2 text-left">Last chat</th>
                  <th className="px-2 py-2 text-left">Next action</th>
                  <th className="px-2 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <React.Fragment key={r.thread.id}>
                    <tr className="border-t align-top hover:bg-muted/40">
                      <td className="px-2 py-2">
                        <button
                          onClick={() => toggleRow(r.thread.id)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          aria-label="Open the chat"
                        >
                          {expanded === r.thread.id ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                          {i + 1}
                        </button>
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant="outline" className={`${BAND_STYLE[r.band]} text-[11px]`}>
                          {BAND_LABEL[r.band]}
                        </Badge>
                      </td>
                      <td className="max-w-[230px] px-2 py-2 text-xs">{r.reason}</td>
                      <td className="px-2 py-2">{r.name || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        {r.phone ? (
                          <a href={`tel:${r.phone}`} className="text-primary hover:underline">
                            {r.phone}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="max-w-[190px] truncate px-2 py-2">
                        {r.email || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs">
                        {r.registration || <span className="font-sans text-muted-foreground">—</span>}
                      </td>
                      <td className="px-2 py-2 text-xs">{r.vehicle || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs">
                        {r.quotedPrice
                          ? `£${r.quotedPrice}${r.termMonths ? ` · ${r.termMonths}m` : ''}`
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-2 py-2 text-xs">{r.messages}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs">
                        {timeAgo(r.lastActivity)}
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(r.lastActivity).toLocaleString('en-GB')}
                        </div>
                      </td>
                      <td className="max-w-[200px] px-2 py-2 text-xs font-medium">{r.nextAction}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          {r.thread.sales_lead_id ? (
                            <Button size="sm" variant="outline" asChild className="h-7 px-2 text-xs">
                              <a href={`/admin-dashboard/?tab=new-leads&leadId=${r.thread.sales_lead_id}`}>
                                <ExternalLink className="mr-1 h-3 w-3" /> Open lead
                              </a>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => sendAsLead(r)}
                              disabled={sendingId === r.thread.id}
                            >
                              <UserPlus className="mr-1 h-3 w-3" />
                              {sendingId === r.thread.id ? 'Sending…' : 'Create lead'}
                            </Button>
                          )}
                          {r.phone && (
                            <Button size="sm" variant="outline" asChild className="h-7 px-2 text-xs">
                              <a href={`tel:${r.phone}`}>
                                <PhoneCall className="mr-1 h-3 w-3" /> Call
                              </a>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => toggleRow(r.thread.id)}
                          >
                            <MessageSquare className="mr-1 h-3 w-3" /> Chat
                          </Button>
                          {isManagement && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteRow(r)}
                            >
                              <Trash2 className="mr-1 h-3 w-3" /> Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {expanded === r.thread.id && (
                      <tr className="border-t bg-muted/20">
                        <td colSpan={13} className="px-4 py-3">
                          <div className="mb-2 text-xs text-muted-foreground">
                            {r.thread.title || 'Website chat'} · started{' '}
                            {new Date(r.thread.created_at).toLocaleString('en-GB')}
                            {r.thread.source ? ` · ${r.thread.source}` : ''}
                            {r.unanswered > 0 ? ` · ${r.unanswered} question(s) not in approved material` : ''}
                          </div>
                          <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border bg-background p-3">
                            {transcript.length === 0 && (
                              <p className="text-xs text-muted-foreground">No messages saved for this chat.</p>
                            )}
                            {transcript.map((m, idx) => {
                              const text = textOf(m);
                              if (!text) return null;
                              const isCustomer = m.role === 'user';
                              return (
                                <div key={idx} className={isCustomer ? 'text-right' : 'text-left'}>
                                  <div
                                    className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-xs ${
                                      isCustomer
                                        ? 'bg-primary/10'
                                        : m.role === 'agent'
                                          ? 'border border-emerald-200 bg-emerald-50'
                                          : 'bg-muted'
                                    }`}
                                  >
                                    <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      {isCustomer ? 'Customer' : m.role === 'agent' ? 'Specialist' : 'Miles (AI)'} ·{' '}
                                      {new Date(m.created_at).toLocaleString('en-GB')}
                                    </div>
                                    {text}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {!loading && visible.length === 0 && (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Nothing needs actioning in this period.
                      {counts.none > 0 && !showNoAction && ` ${counts.none} chat(s) needed no action.`}
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Loading chats…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteRow} onOpenChange={(o) => !o && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteRow
                ? `The whole conversation${deleteRow.registration ? ` for ${deleteRow.registration}` : ''}${deleteRow.name ? ` from ${deleteRow.name}` : ''} will be removed for good, including its messages and recorded details. Any lead already created from it is kept.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete chat'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
