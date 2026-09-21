import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Bot, MessageSquare, Car, PoundSterling, PhoneCall, UserPlus, RefreshCw, Download, ExternalLink, Eraser, ClipboardCopy, FileText } from 'lucide-react';
import { buildChatbotTrainingBrief } from '@/lib/chatbotTrainingBrief';
import ChatConversationsPanel from './ChatConversationsPanel';
import ChatActionQueuePanel from './ChatActionQueuePanel';
import ChatbotImprovementPanel from './ChatbotImprovementPanel';
import ChatbotAnswerLibraryPanel from './ChatbotAnswerLibraryPanel';
import ChatResponseStatsPanel from './ChatResponseStatsPanel';
import { UnifiedDateFilter, periodToRange, type PeriodKey } from '@/components/admin/UnifiedDateFilter';
import type { DateRange } from 'react-day-picker';

type ChatEvent = {
  id: string;
  thread_id: string | null;
  event_type: string;
  topic: string | null;
  detail: string | null;
  customer_wording: string | null;
  registration: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  quoted_price: number | null;
  term_months: number | null;
  knowledge_confident: boolean | null;
  metadata: any;
  created_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  customer_message: 'Customer message',
  question: 'Question asked',
  vehicle_interest: 'Vehicle looked up',
  price_quoted: 'Price quoted',
  handover: 'Asked for a human',
  lead_captured: 'Lead captured',
};

const TYPE_COLORS: Record<string, string> = {
  customer_message: 'bg-slate-100 text-slate-700 border-slate-200',
  question: 'bg-sky-100 text-sky-800 border-sky-200',
  vehicle_interest: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  price_quoted: 'bg-amber-100 text-amber-900 border-amber-200',
  handover: 'bg-violet-100 text-violet-800 border-violet-200',
  lead_captured: 'bg-rose-100 text-rose-800 border-rose-200',
};

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'you', 'your', 'with', 'that', 'this', 'have', 'what', 'when', 'how', 'can',
  'are', 'was', 'but', 'not', 'get', 'got', 'its', 'our', 'from', 'about', 'would', 'could', 'does',
  'has', 'had', 'will', 'they', 'them', 'there', 'been', 'just', 'like', 'need', 'want', 'know',
  'car', 'please', 'thanks', 'hello', 'hey', 'yes', 'yeah',
]);

export default function ChatbotDataTab() {
  const [events, setEvents] = useState<ChatEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>('30days');
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);

  const activeRange = period === 'custom' ? customRange : periodToRange(period);
  const fromIso = activeRange?.from ? new Date(new Date(activeRange.from).setHours(0, 0, 0, 0)).toISOString() : null;
  const toIso = activeRange?.to ? new Date(new Date(activeRange.to).setHours(23, 59, 59, 999)).toISOString() : null;
  const [search, setSearch] = useState('');
  // Opened straight from a chat pop-up: land on the conversation itself.
  const deepLinkThread = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('chatThread');
    } catch {
      return null;
    }
  }, []);

  const load = async () => {
    setLoading(true);
    let query = (supabase.from('ai_chat_events' as any) as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (fromIso) query = query.gte('created_at', fromIso);
    if (toIso) query = query.lte('created_at', toIso);

    const { data, error } = await query;
    if (error) {
      toast.error(`Could not load chatbot data: ${error.message}`);
      setEvents([]);
    } else {
      setEvents((data ?? []) as ChatEvent[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromIso, toIso]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) =>
      [e.topic, e.detail, e.customer_wording, e.registration, e.vehicle_make, e.vehicle_model, e.event_type]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [events, search]);

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    filtered.forEach((e) => { byType[e.event_type] = (byType[e.event_type] ?? 0) + 1; });
    const threads = new Set(filtered.map((e) => e.thread_id).filter(Boolean)).size;
    const prices = filtered.filter((e) => e.event_type === 'price_quoted' && e.quoted_price).map((e) => Number(e.quoted_price));
    const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
    const unanswered = filtered.filter((e) => e.event_type === 'question' && e.knowledge_confident === false).length;
    return { byType, threads, avgPrice, unanswered };
  }, [filtered]);

  const topQuestions = useMemo(() => {
    const map = new Map<string, number>();
    filtered
      .filter((e) => e.event_type === 'question' && e.topic)
      .forEach((e) => {
        const key = String(e.topic).trim().toLowerCase();
        map.set(key, (map.get(key) ?? 0) + 1);
      });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  }, [filtered]);

  const topWords = useMemo(() => {
    const map = new Map<string, number>();
    filtered
      .filter((e) => e.customer_wording)
      .forEach((e) => {
        String(e.customer_wording)
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
          .forEach((w) => map.set(w, (map.get(w) ?? 0) + 1));
      });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  }, [filtered]);

  const topVehicles = useMemo(() => {
    const map = new Map<string, number>();
    filtered
      .filter((e) => e.event_type === 'vehicle_interest')
      .forEach((e) => {
        const key = [e.vehicle_make, e.vehicle_model].filter(Boolean).join(' ') || e.registration || 'Unknown';
        map.set(key, (map.get(key) ?? 0) + 1);
      });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  }, [filtered]);

  const topCombos = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    filtered
      .filter((e) => e.event_type === 'price_quoted' && e.topic)
      .forEach((e) => {
        const cur = map.get(e.topic!) ?? { count: 0, total: 0 };
        cur.count += 1;
        cur.total += Number(e.quoted_price ?? 0);
        map.set(e.topic!, cur);
      });
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 12);
  }, [filtered]);

  /** Clears the local chat session so the widget starts a brand new thread. */
  const resetChatSession = () => {
    try {
      const keys = Object.keys(window.localStorage).filter(
        (k) => k.startsWith('baw_chat') || k.startsWith('sandbox_chat') || k.includes('miles_chat'),
      );
      keys.forEach((k) => window.localStorage.removeItem(k));
      Object.keys(window.sessionStorage)
        .filter((k) => k.startsWith('baw_chat') || k.startsWith('sandbox_chat'))
        .forEach((k) => window.sessionStorage.removeItem(k));
      toast.success(keys.length ? `Cleared ${keys.length} chat session key(s)` : 'No chat session data found — already clean');
    } catch {
      toast.error('Could not clear chat session data in this browser');
    }
  };

  const exportCsv = () => {

    const header = ['created_at', 'event_type', 'topic', 'customer_wording', 'registration', 'vehicle', 'quoted_price', 'term_months', 'grounded'];
    const rows = filtered.map((e) => [
      e.created_at,
      e.event_type,
      e.topic ?? '',
      (e.customer_wording ?? '').replace(/\s+/g, ' '),
      e.registration ?? '',
      [e.vehicle_make, e.vehicle_model].filter(Boolean).join(' '),
      e.quoted_price ?? '',
      e.term_months ?? '',
      e.knowledge_confident === null ? '' : String(e.knowledge_confident),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatbot-data-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rangeLabel = (() => {
    if (!activeRange?.from) return 'All time';
    const fmt = (d: Date) => new Date(d).toLocaleDateString('en-GB');
    return activeRange.to ? `${fmt(activeRange.from)} – ${fmt(activeRange.to)}` : fmt(activeRange.from);
  })();

  const buildBrief = () => buildChatbotTrainingBrief(filtered as any, { rangeLabel });

  const copyBrief = async () => {
    const brief = buildBrief();
    try {
      await navigator.clipboard.writeText(brief);
      toast.success('Training brief copied — paste it into Lovable chat');
    } catch {
      toast.error('Could not copy. Use "Download brief" instead.');
    }
  };

  const downloadBrief = () => {
    const url = URL.createObjectURL(new Blob([buildBrief()], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `miles-training-brief-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const StatCard = ({ icon: Icon, label, value, hint }: { icon: any; label: string; value: React.ReactNode; hint?: string }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" /> Chatbot data
          </h2>
          <p className="text-sm text-muted-foreground">
            Everything customers ask Miles — questions, vehicles, prices quoted, objections and captured leads. Sandbox only for now.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" onClick={copyBrief} disabled={!filtered.length}>
            <ClipboardCopy className="h-4 w-4 mr-1" /> Copy brief for Devs
          </Button>
          <Button size="sm" variant="outline" onClick={downloadBrief} disabled={!filtered.length}>
            <FileText className="h-4 w-4 mr-1" /> Download brief
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href="/used-car-warranty-uk/" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" /> Open chatbot
            </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href="/ai-sandbox" target="_blank" rel="noopener noreferrer">
              <Bot className="h-4 w-4 mr-1" /> AI sandbox
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={resetChatSession}>
            <Eraser className="h-4 w-4 mr-1" /> Clear chat cookies
          </Button>
        </div>

      </div>

      <UnifiedDateFilter
        scope="signup"
        availableScopes={['signup']}
        period={period}
        customRange={customRange}
        onChange={(next) => {
          setPeriod(next.period);
          setCustomRange(next.customRange);
        }}
        showLabel
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard icon={MessageSquare} label="Conversations" value={stats.threads} />
        <StatCard icon={MessageSquare} label="Customer messages" value={stats.byType.customer_message ?? 0} />
        <StatCard icon={Bot} label="Questions asked" value={stats.byType.question ?? 0} hint={`${stats.unanswered} not in approved material`} />
        <StatCard icon={Car} label="Vehicles looked up" value={stats.byType.vehicle_interest ?? 0} />
        <StatCard icon={PoundSterling} label="Prices quoted" value={stats.byType.price_quoted ?? 0} hint={stats.avgPrice ? `avg £${stats.avgPrice}` : undefined} />
        <StatCard icon={UserPlus} label="Leads captured" value={stats.byType.lead_captured ?? 0} hint={`${stats.byType.handover ?? 0} asked for a human`} />
      </div>

      <Input
        placeholder="Search wording, topics, vehicles or registrations…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      <Tabs defaultValue={deepLinkThread ? 'conversations' : 'queue'}>
        <TabsList>
          <TabsTrigger value="queue">Action queue</TabsTrigger>
          <TabsTrigger value="conversations">Conversations &amp; leads</TabsTrigger>
          <TabsTrigger value="response">Reply times &amp; missed chats</TabsTrigger>
          <TabsTrigger value="library">Answer library</TabsTrigger>
          <TabsTrigger value="improve">Needs improvement</TabsTrigger>
          <TabsTrigger value="wants">What customers want</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles &amp; prices</TabsTrigger>
          <TabsTrigger value="raw">Raw activity</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="pt-4">
          <ChatActionQueuePanel rangeDays="all" />
        </TabsContent>

        <TabsContent value="conversations" className="pt-4">
          <ChatConversationsPanel
            rangeDays="all"
            fromIso={fromIso}
            toIso={toIso}
            initialThreadId={deepLinkThread}
          />
        </TabsContent>

        <TabsContent value="response" className="pt-4">
          <ChatResponseStatsPanel fromIso={fromIso} toIso={toIso} />
        </TabsContent>




        <TabsContent value="library" className="pt-4">
          <ChatbotAnswerLibraryPanel fromIso={fromIso} toIso={toIso} />
        </TabsContent>

        <TabsContent value="improve" className="pt-4">
          <ChatbotImprovementPanel rangeDays="all" fromIso={fromIso} toIso={toIso} />
        </TabsContent>

        <TabsContent value="wants" className="space-y-4 pt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Most asked questions</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {topQuestions.length === 0 && <p className="text-sm text-muted-foreground">No questions logged yet.</p>}
                {topQuestions.map(([q, n]) => (
                  <div key={q} className="flex items-start justify-between gap-3 text-sm border-b pb-1.5 last:border-0">
                    <span className="capitalize">{q}</span>
                    <Badge variant="secondary">{n}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Words customers use</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {topWords.length === 0 && <p className="text-sm text-muted-foreground">Nothing logged yet.</p>}
                {topWords.map(([w, n]) => (
                  <Badge key={w} variant="outline" className="text-xs">
                    {w} <span className="ml-1 text-muted-foreground">{n}</span>
                  </Badge>
                ))}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Questions our approved material could not answer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {filtered.filter((e) => e.event_type === 'question' && e.knowledge_confident === false).slice(0, 25).map((e) => (
                <div key={e.id} className="text-sm border-b pb-1.5 last:border-0">
                  <span className="text-muted-foreground mr-2">{new Date(e.created_at).toLocaleString('en-GB')}</span>
                  {e.topic}
                </div>
              ))}
              {stats.unanswered === 0 && <p className="text-sm text-muted-foreground">None — every question was grounded.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-4 pt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Vehicles customers asked about</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {topVehicles.length === 0 && <p className="text-sm text-muted-foreground">No vehicle lookups yet.</p>}
                {topVehicles.map(([v, n]) => (
                  <div key={v} className="flex items-center justify-between gap-3 text-sm border-b pb-1.5 last:border-0">
                    <span>{v}</span>
                    <Badge variant="secondary">{n}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Cover combinations quoted</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {topCombos.length === 0 && <p className="text-sm text-muted-foreground">No prices quoted yet.</p>}
                {topCombos.map(([combo, v]) => (
                  <div key={combo} className="flex items-center justify-between gap-3 text-sm border-b pb-1.5 last:border-0">
                    <span>{combo}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground">avg £{Math.round(v.total / v.count)}</span>
                      <Badge variant="secondary">{v.count}</Badge>
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="raw" className="pt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <PhoneCall className="h-4 w-4" /> Raw activity ({filtered.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[520px] pr-3">
                <div className="space-y-2">
                  {filtered.map((e) => (
                    <div key={e.id} className="border rounded-md p-2.5 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={TYPE_COLORS[e.event_type] ?? 'bg-slate-100 text-slate-700 border-slate-200'}>
                          {TYPE_LABELS[e.event_type] ?? e.event_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(e.created_at).toLocaleString('en-GB')}
                        </span>
                        {e.registration && <Badge variant="outline">{e.registration}</Badge>}
                        {e.quoted_price != null && <Badge variant="outline">£{Math.round(Number(e.quoted_price))}</Badge>}
                      </div>
                      {e.topic && <div className="mt-1 font-medium">{e.topic}</div>}
                      {e.customer_wording && (
                        <div className="mt-1 text-muted-foreground whitespace-pre-wrap">{e.customer_wording}</div>
                      )}
                      {e.detail && <div className="mt-1 text-xs text-muted-foreground">{e.detail}</div>}
                    </div>
                  ))}
                  {!loading && filtered.length === 0 && (
                    <p className="text-sm text-muted-foreground">No chatbot activity in this period.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
