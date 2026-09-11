import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { BookOpen, Check, Pause, Play, Plus, RefreshCw, Save, Trash2, Wand2 } from 'lucide-react';
import { useRealAdminId } from '@/hooks/useCurrentAdminId';

/**
 * Answer library — every question a customer asks Miles can be given a perfect
 * answer here, written by our own team. Miles then reuses that exact wording
 * the next time the same or a similar question comes up, so the chat improves
 * with every conversation instead of handing over again.
 */

type LibraryRow = {
  id: string;
  question: string;
  answer: string;
  keywords: string[] | null;
  status: string;
  times_used: number;
  last_used_at: string | null;
  updated_at: string;
  source_thread_id: string | null;
};

type Asked = {
  question: string;
  count: number;
  lastSeen: string;
  grounded: boolean;
  threadId: string | null;
  milesSaid: string | null;
};

const STOP = new Set([
  'the', 'and', 'for', 'you', 'your', 'with', 'what', 'does', 'have', 'how', 'are', 'can', 'our',
  'this', 'that', 'from', 'will', 'about', 'when', 'who', 'any', 'all', 'not', 'but', 'was', 'were',
  'has', 'had', 'would', 'could', 'there', 'them', 'they', 'just', 'like', 'need', 'want', 'know',
  'please', 'car', 'vehicle', 'warranty', 'hello', 'hey', 'yes', 'yeah', 'get', 'got',
]);

const words = (s: string) =>
  [...new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)))];

/** Same closeness test the chatbot uses, so the screen shows what Miles would match. */
const similar = (question: string, row: LibraryRow) => {
  const asked = words(question);
  const bank = new Set([...words(row.question), ...(row.keywords ?? []).flatMap(words)]);
  if (!asked.length || !bank.size) return 0;
  const hits = asked.filter((w) => bank.has(w)).length;
  return (hits / asked.length) * 0.7 + (hits / bank.size) * 0.3;
};

export default function ChatbotAnswerLibraryPanel({ fromIso, toIso }: { fromIso?: string | null; toIso?: string | null }) {
  const adminId = useRealAdminId();
  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [asked, setAsked] = useState<Asked[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, { question: string; answer: string; keywords: string }>>({});
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let evQ = (supabase.from('ai_chat_events' as any) as any)
        .select('thread_id, topic, customer_wording, knowledge_confident, created_at, event_type')
        .eq('event_type', 'question')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (fromIso) evQ = evQ.gte('created_at', fromIso);
      if (toIso) evQ = evQ.lte('created_at', toIso);

      const libQ = (supabase.from('ai_chat_answer_library' as any) as any)
        .select('id, question, answer, keywords, status, times_used, last_used_at, updated_at, source_thread_id')
        .order('updated_at', { ascending: false })
        .limit(500);

      let msgQ = supabase
        .from('ai_sandbox_messages')
        .select('thread_id, role, content, created_at')
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(2000);
      if (fromIso) msgQ = msgQ.gte('created_at', fromIso);

      const [evRes, libRes, msgRes] = await Promise.all([evQ, libQ, msgQ]);
      if ((libRes as any)?.error) throw (libRes as any).error;

      const library = (((libRes as any)?.data ?? []) as LibraryRow[]);
      setRows(library);

      const lastMiles = new Map<string, string>();
      (((msgRes as any)?.data ?? []) as any[]).forEach((m) => {
        if (m.thread_id && m.content && !lastMiles.has(m.thread_id)) lastMiles.set(m.thread_id, m.content);
      });

      const map = new Map<string, Asked>();
      (((evRes as any)?.data ?? []) as any[]).forEach((e) => {
        const q = String(e.customer_wording || e.topic || '').trim();
        if (q.length < 5) return;
        const key = words(q).slice(0, 8).join(' ') || q.toLowerCase();
        const cur =
          map.get(key) ??
          ({ question: q, count: 0, lastSeen: e.created_at, grounded: e.knowledge_confident !== false, threadId: e.thread_id, milesSaid: lastMiles.get(e.thread_id) ?? null } as Asked);
        cur.count += 1;
        if (e.knowledge_confident === false) cur.grounded = false;
        if (+new Date(e.created_at) > +new Date(cur.lastSeen)) cur.lastSeen = e.created_at;
        map.set(key, cur);
      });

      const pending = [...map.values()]
        .filter((a) => !library.some((r) => r.status === 'approved' && similar(a.question, r) >= 0.34))
        .sort((a, b) => (a.grounded === b.grounded ? b.count - a.count : a.grounded ? 1 : -1));
      setAsked(pending);
    } catch (e: any) {
      toast.error(e?.message || 'Could not load the answer library');
    } finally {
      setLoading(false);
    }
  }, [fromIso, toIso]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveAnswer = async (question: string, answer: string, threadId: string | null) => {
    const q = question.trim();
    const a = answer.trim();
    if (q.length < 5 || a.length < 5) {
      toast.error('Add both the question and the answer you want Miles to give');
      return;
    }
    setSaving(true);
    const { error } = await (supabase.from('ai_chat_answer_library' as any) as any).insert({
      question: q,
      answer: a,
      normalized_question: words(q).join(' '),
      keywords: words(q).slice(0, 12),
      status: 'approved',
      created_by: adminId,
      approved_by: adminId,
      approved_at: new Date().toISOString(),
      source_thread_id: threadId,
    });
    setSaving(false);
    if (error) {
      toast.error(`Could not save: ${error.message}`);
      return;
    }
    toast.success('Saved — Miles will use this answer from now on');
    setDrafts((d) => ({ ...d, [q]: '' }));
    setNewQuestion('');
    setNewAnswer('');
    void load();
  };

  const updateRow = async (row: LibraryRow) => {
    const e = edits[row.id];
    if (!e) return;
    const { error } = await (supabase.from('ai_chat_answer_library' as any) as any)
      .update({
        question: e.question.trim(),
        answer: e.answer.trim(),
        keywords: e.keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean),
        normalized_question: words(e.question).join(' '),
        approved_by: adminId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    if (error) {
      toast.error(`Could not update: ${error.message}`);
      return;
    }
    toast.success('Answer updated');
    setEdits(({ [row.id]: _drop, ...rest }) => rest);
    void load();
  };

  const setStatus = async (row: LibraryRow, status: string) => {
    const { error } = await (supabase.from('ai_chat_answer_library' as any) as any).update({ status }).eq('id', row.id);
    if (error) toast.error(error.message);
    else {
      toast.success(status === 'approved' ? 'Answer switched on' : 'Answer paused');
      void load();
    }
  };

  const removeRow = async (row: LibraryRow) => {
    const { error } = await (supabase.from('ai_chat_answer_library' as any) as any).delete().eq('id', row.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Answer removed');
      void load();
    }
  };

  const stats = useMemo(
    () => ({
      live: rows.filter((r) => r.status === 'approved').length,
      paused: rows.filter((r) => r.status !== 'approved').length,
      used: rows.reduce((a, r) => a + (r.times_used || 0), 0),
      waiting: asked.length,
    }),
    [rows, asked],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-800">Live answers · {stats.live}</Badge>
        <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">Paused · {stats.paused}</Badge>
        <Badge variant="outline" className="border-sky-300 bg-sky-100 text-sky-800">Times reused by Miles · {stats.used}</Badge>
        <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900">Questions waiting for an answer · {stats.waiting}</Badge>
        <Button size="sm" variant="outline" className="ml-auto" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" /> Questions waiting for your answer
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Write the answer you want customers to get. Miles uses your wording straight away, and reuses it whenever
            someone asks the same or a similar question.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loading && asked.length === 0 && (
            <p className="text-sm text-muted-foreground">Every question asked in this period already has an answer in the library.</p>
          )}
          {asked.slice(0, 40).map((a) => (
            <div key={a.question} className="rounded-md border p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {!a.grounded && (
                  <Badge variant="outline" className="border-red-300 bg-red-100 text-xs text-red-800">Not in approved material</Badge>
                )}
                <Badge variant="secondary" className="text-xs">Asked {a.count}×</Badge>
                <span className="text-xs text-muted-foreground">{new Date(a.lastSeen).toLocaleString('en-GB')}</span>
              </div>
              <p className="text-sm font-medium">“{a.question}”</p>
              {a.milesSaid && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Miles said: “{a.milesSaid.slice(0, 260)}”
                </p>
              )}
              <Textarea
                className="mt-2 text-sm"
                rows={3}
                placeholder="The perfect answer — 1 to 3 short sentences, plain UK English, only facts we can stand behind."
                value={drafts[a.question] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [a.question]: e.target.value }))}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => saveAnswer(a.question, drafts[a.question] ?? '', a.threadId)} disabled={saving}>
                  <Check className="mr-1 h-4 w-4" /> Save and use this answer
                </Button>
                {a.milesSaid && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDrafts((d) => ({ ...d, [a.question]: a.milesSaid! }))}
                  >
                    <Wand2 className="mr-1 h-4 w-4" /> Start from what Miles said
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" /> Add an answer yourself
          </CardTitle>
          <p className="text-xs text-muted-foreground">For a question you know customers ask, before anyone asks it in chat.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="The customer question, in their words" value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} />
          <Textarea rows={3} placeholder="The answer Miles should give" value={newAnswer} onChange={(e) => setNewAnswer(e.target.value)} />
          <Button size="sm" onClick={() => saveAnswer(newQuestion, newAnswer, null)} disabled={saving}>
            <Save className="mr-1 h-4 w-4" /> Save answer
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Answers Miles is using ({rows.length})</CardTitle>
          <p className="text-xs text-muted-foreground">Edit the wording any time. Paused answers are ignored by the chat.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">Nothing saved yet.</p>}
          {rows.map((r) => {
            const e = edits[r.id];
            return (
              <div key={r.id} className="rounded-md border p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${r.status === 'approved' ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-slate-300 bg-slate-100 text-slate-700'}`}
                  >
                    {r.status === 'approved' ? 'Live' : 'Paused'}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">Used {r.times_used}×</Badge>
                  {r.last_used_at && (
                    <span className="text-xs text-muted-foreground">last used {new Date(r.last_used_at).toLocaleString('en-GB')}</span>
                  )}
                </div>
                {e ? (
                  <div className="space-y-2">
                    <Input value={e.question} onChange={(ev) => setEdits((s) => ({ ...s, [r.id]: { ...e, question: ev.target.value } }))} />
                    <Textarea rows={3} value={e.answer} onChange={(ev) => setEdits((s) => ({ ...s, [r.id]: { ...e, answer: ev.target.value } }))} />
                    <Input
                      placeholder="Extra words that should match this answer, comma separated"
                      value={e.keywords}
                      onChange={(ev) => setEdits((s) => ({ ...s, [r.id]: { ...e, keywords: ev.target.value } }))}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => updateRow(r)}>
                        <Save className="mr-1 h-4 w-4" /> Save changes
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEdits(({ [r.id]: _d, ...rest }) => rest)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium">“{r.question}”</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{r.answer}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setEdits((s) => ({ ...s, [r.id]: { question: r.question, answer: r.answer, keywords: (r.keywords ?? []).join(', ') } }))
                        }
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setStatus(r, r.status === 'approved' ? 'paused' : 'approved')}>
                        {r.status === 'approved' ? <><Pause className="mr-1 h-4 w-4" /> Pause</> : <><Play className="mr-1 h-4 w-4" /> Switch on</>}
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-700" onClick={() => removeRow(r)}>
                        <Trash2 className="mr-1 h-4 w-4" /> Remove
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
