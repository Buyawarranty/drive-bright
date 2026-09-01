import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { AlertTriangle, Copy, RefreshCw, ThumbsDown, Wrench } from 'lucide-react';

/**
 * Chatbot improvement queue — the questions Miles could not answer from
 * approved material, plus chats where the customer sounded unhappy or had to
 * repeat themselves. Each gap comes with a ready-made prompt a manager can
 * paste back to us to improve the chatbot.
 */

type EventRow = {
  id: string;
  thread_id: string | null;
  event_type: string;
  topic: string | null;
  detail: string | null;
  customer_wording: string | null;
  knowledge_confident: boolean | null;
  created_at: string;
};

type MessageRow = {
  thread_id: string;
  role: string;
  content: string | null;
  parts: any;
  created_at: string;
};

type Gap = {
  key: string;
  kind: 'unanswered' | 'unhappy' | 'repeated' | 'handover';
  label: string;
  count: number;
  examples: string[];
  threadIds: string[];
  lastSeen: string;
};

const KIND_META: Record<Gap['kind'], { label: string; style: string; icon: any }> = {
  unanswered: { label: 'Not in approved material', style: 'bg-red-100 text-red-800 border-red-300', icon: AlertTriangle },
  unhappy: { label: 'Customer sounded unhappy', style: 'bg-orange-100 text-orange-900 border-orange-300', icon: ThumbsDown },
  repeated: { label: 'Customer had to repeat themselves', style: 'bg-amber-100 text-amber-900 border-amber-300', icon: RefreshCw },
  handover: { label: 'Gave up and asked for a person', style: 'bg-violet-100 text-violet-800 border-violet-300', icon: Wrench },
};

const UNHAPPY_PATTERNS: { re: RegExp; note: string }[] = [
  { re: /that'?s not what i (asked|meant)|you'?re not (listening|answering)|not what i asked/i, note: 'said the answer missed the question' },
  { re: /(useless|rubbish|nonsense|waste of time|terrible|awful|stupid bot|pointless)/i, note: 'used negative wording about the chat' },
  { re: /(not helpful|didn'?t help|doesn'?t help|no help)/i, note: 'said the answer was not helpful' },
  { re: /(you (already )?said|i (already )?told you|as i said|again\?)/i, note: 'had to repeat information' },
  { re: /(confusing|confused|don'?t understand|makes no sense|unclear)/i, note: 'found the answer confusing' },
  { re: /(speak|talk) to (a |an )?(human|person|someone|agent|advisor)|real person/i, note: 'asked for a real person' },
  { re: /(annoyed|frustrat|angry|fed up|joke)/i, note: 'sounded frustrated' },
];

const textOf = (m: { content: string | null; parts: any }) => {
  if (m.content && m.content.trim()) return m.content.trim();
  const parts = Array.isArray(m.parts) ? m.parts : [];
  return parts
    .filter((p: any) => p?.type === 'text' && typeof p.text === 'string')
    .map((p: any) => p.text.trim())
    .filter(Boolean)
    .join(' ');
};

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export default function ChatbotImprovementPanel({ rangeDays, fromIso, toIso }: { rangeDays: string; fromIso?: string | null; toIso?: string | null }) {
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [prompt, setPrompt] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date();
      if (rangeDays !== 'all') since.setDate(since.getDate() - Number(rangeDays));
      const sinceIso = fromIso ?? (rangeDays === 'all' ? null : since.toISOString());
      const untilIso = toIso ?? null;

      let evQ = (supabase.from('ai_chat_events' as any) as any)
        .select('id, thread_id, event_type, topic, detail, customer_wording, knowledge_confident, created_at')
        .order('created_at', { ascending: false })
        .limit(3000);
      if (sinceIso) evQ = evQ.gte('created_at', sinceIso);
      if (untilIso) evQ = evQ.lte('created_at', untilIso);

      let msgQ = supabase
        .from('ai_sandbox_messages')
        .select('thread_id, role, content, parts, created_at')
        .order('created_at', { ascending: true })
        .limit(6000);
      if (sinceIso) msgQ = msgQ.gte('created_at', sinceIso);

      const [evRes, msgRes] = await Promise.all([evQ, msgQ]);
      const events = (((evRes as any)?.data ?? []) as EventRow[]);
      const messages = (((msgRes as any)?.data ?? []) as MessageRow[]);

      const map = new Map<string, Gap>();
      const push = (kind: Gap['kind'], label: string, example: string, threadId: string | null, at: string) => {
        const key = `${kind}::${normalise(label).slice(0, 80)}`;
        const cur = map.get(key) ?? { key, kind, label, count: 0, examples: [], threadIds: [], lastSeen: at };
        cur.count += 1;
        if (example && cur.examples.length < 4 && !cur.examples.includes(example)) cur.examples.push(example);
        if (threadId && !cur.threadIds.includes(threadId)) cur.threadIds.push(threadId);
        if (+new Date(at) > +new Date(cur.lastSeen)) cur.lastSeen = at;
        map.set(key, cur);
      };

      // 1. Questions the approved material could not answer.
      events
        .filter((e) => e.event_type === 'question' && e.knowledge_confident === false)
        .forEach((e) =>
          push(
            'unanswered',
            e.topic?.trim() || (e.customer_wording ?? 'Unlabelled question').slice(0, 70),
            (e.customer_wording ?? e.detail ?? '').slice(0, 220),
            e.thread_id,
            e.created_at,
          ),
        );

      // 2. Customers who sounded unhappy, confused or had to repeat themselves.
      const byThread = new Map<string, MessageRow[]>();
      messages.forEach((m) => {
        if (!m.thread_id) return;
        const arr = byThread.get(m.thread_id) ?? [];
        arr.push(m);
        byThread.set(m.thread_id, arr);
      });

      byThread.forEach((msgs, threadId) => {
        const customer = msgs.filter((m) => m.role === 'user');
        const seen = new Map<string, number>();
        customer.forEach((m) => {
          const t = textOf(m);
          if (!t) return;
          UNHAPPY_PATTERNS.forEach(({ re, note }) => {
            if (re.test(t)) {
              const kind: Gap['kind'] = /human|person|someone|agent|advisor/i.test(t) ? 'handover' : 'unhappy';
              push(kind, `Customer ${note}`, t.slice(0, 220), threadId, m.created_at);
            }
          });
          const norm = normalise(t);
          if (norm.length > 12) {
            const n = (seen.get(norm) ?? 0) + 1;
            seen.set(norm, n);
            if (n === 2) push('repeated', `Asked the same thing twice: "${t.slice(0, 60)}"`, t.slice(0, 220), threadId, m.created_at);
          }
        });
      });

      const list = [...map.values()].sort((a, b) => {
        const order: Gap['kind'][] = ['unanswered', 'unhappy', 'handover', 'repeated'];
        if (a.kind !== b.kind) return order.indexOf(a.kind) - order.indexOf(b.kind);
        if (b.count !== a.count) return b.count - a.count;
        return +new Date(b.lastSeen) - +new Date(a.lastSeen);
      });
      setGaps(list);
    } catch (e: any) {
      toast.error(e?.message || 'Could not load the chatbot improvement queue');
      setGaps([]);
    } finally {
      setLoading(false);
    }
  }, [rangeDays, fromIso, toIso]);

  useEffect(() => {
    void load();
  }, [load]);

  const chosen = useMemo(() => gaps.filter((g) => selected[g.key]), [gaps, selected]);

  const buildPrompt = (items: Gap[]) => {
    if (items.length === 0) {
      toast.error('Tick at least one gap first');
      return;
    }
    const lines = items.map((g, i) => {
      const ex = g.examples.map((e) => `   - "${e}"`).join('\n');
      return `${i + 1}. [${KIND_META[g.kind].label}] ${g.label} — seen ${g.count} time(s), across ${g.threadIds.length} chat(s).\n${ex}`;
    });
    const text = [
      'Improve the Miles chatbot for these real customer gaps from the last chats.',
      '',
      ...lines,
      '',
      'For each item:',
      '- Add or correct the answer in the approved chatbot material (Platinum Plan v3.7 + T&Cs v3.7 + step 3 cover options only).',
      '- Keep Miles to 1-3 short sentences, warm and plainly professional, UK English, no negative wording.',
      '- Never invent cover, prices or timescales that are not in the approved material.',
      '- If the answer genuinely is not in approved material, have Miles offer a callback instead of guessing.',
      '- Do not repeat a question the customer has already answered.',
    ].join('\n');
    setPrompt(text);
    void navigator.clipboard?.writeText(text).then(
      () => toast.success('Improvement prompt copied — paste it to me in chat'),
      () => toast.success('Improvement prompt ready below'),
    );
  };

  const counts = useMemo(() => {
    const c: Record<Gap['kind'], number> = { unanswered: 0, unhappy: 0, repeated: 0, handover: 0 };
    gaps.forEach((g) => { c[g.kind] += g.count; });
    return c;
  }, [gaps]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(KIND_META) as Gap['kind'][]).map((k) => (
          <Badge key={k} variant="outline" className={`${KIND_META[k].style} text-xs`}>
            {KIND_META[k].label} · {counts[k]}
          </Badge>
        ))}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={() => buildPrompt(gaps)} disabled={!gaps.length}>
            <Copy className="mr-1 h-4 w-4" /> Prompt for everything
          </Button>
          <Button size="sm" onClick={() => buildPrompt(chosen)} disabled={!chosen.length}>
            <Wrench className="mr-1 h-4 w-4" /> Prompt for {chosen.length || 0} ticked
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Where the chatbot needs improving</CardTitle>
          <p className="text-xs text-muted-foreground">
            Tick the ones you want fixed, then copy the prompt and paste it to me — I will update the chatbot material and
            wording for exactly those gaps.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="px-2 py-2 text-left">Problem</th>
                  <th className="px-2 py-2 text-left">What the customer said</th>
                  <th className="px-2 py-2 text-left">Times</th>
                  <th className="px-2 py-2 text-left">Chats</th>
                  <th className="px-2 py-2 text-left">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {gaps.map((g) => (
                  <tr key={g.key} className="border-t align-top hover:bg-muted/40">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={!!selected[g.key]}
                        onChange={(e) => setSelected((s) => ({ ...s, [g.key]: e.target.checked }))}
                        aria-label={`Select ${g.label}`}
                      />
                    </td>
                    <td className="max-w-[280px] px-2 py-2">
                      <Badge variant="outline" className={`${KIND_META[g.kind].style} mb-1 text-[10px]`}>
                        {KIND_META[g.kind].label}
                      </Badge>
                      <div className="text-xs font-medium capitalize">{g.label}</div>
                    </td>
                    <td className="max-w-[420px] px-2 py-2 text-xs text-muted-foreground">
                      {g.examples.length ? g.examples.map((e, i) => <div key={i}>“{e}”</div>) : '—'}
                    </td>
                    <td className="px-2 py-2 text-xs">{g.count}</td>
                    <td className="px-2 py-2 text-xs">{g.threadIds.length}</td>
                    <td className="px-2 py-2 whitespace-nowrap text-xs">
                      {new Date(g.lastSeen).toLocaleString('en-GB')}
                    </td>
                  </tr>
                ))}
                {!loading && gaps.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No gaps found in this period — every question was answered from approved material and nobody sounded unhappy.
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Checking the chats…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {prompt && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Improvement prompt</CardTitle>
            <p className="text-xs text-muted-foreground">Copied to your clipboard — paste it into the Lovable chat.</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={12} className="font-mono text-xs" />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(prompt);
                toast.success('Copied');
              }}
            >
              <Copy className="mr-1 h-4 w-4" /> Copy again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
