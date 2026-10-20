import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Lightbulb, Plus, Trash2, TrendingUp, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from '@/components/ai-elements/tool';
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from '@/components/ai-elements/prompt-input';
import SeoAuditReport from './SeoAuditReport';
import WeeklySeoReviews, { SeoActionGuide } from './WeeklySeoReviews';
import SalesRecommendationsPanel from './SalesRecommendationsPanel';
import audit from '@/data/seo-audit-2026-10-17.json';
import { buildSeoRecommendationContext, visibleSeoRequest, type SeoReviewEvidence } from '@/lib/seoRecommendationContext';

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/growth-agent`;
const db = supabase as any;

type Thread = { id: string; title: string; updated_at: string };

const STARTERS = [
  'Why have website sales changed over the last 30 days?',
  'Which open leads should we call first this week, and what should we say?',
  'Write 3 Facebook ad ideas for our most popular cover.',
  'Suggest 5 new blog topics we haven\'t covered yet.',
];

const SEO_STARTERS = [
  'Recommend the five highest-priority improvements from our available website and Google evidence, protecting pages that already rank well.',
  'Review our latest blog posts and recommend useful content gaps without duplicating existing articles.',
  'Review the latest weekly proposals and explain which are safe to prepare for approval, with ranking risks and verification steps.',
  'Prepare a page-by-page SEO action plan with exact suggested changes, dated evidence and anything still needing investigation.',
];

const SEO_CONTEXT = `SEO Audit for Buyawarranty.co.uk. Always focus this conversation on practical SEO improvement suggestions. Use your available recent_blogs tool before making claims about existing articles. Give priority, affected page, evidence, suggested improvement and next check. Clearly distinguish observed issues from opportunities and unverified checks. You cannot perform a fresh crawl, inspect Search Console or retrieve Semrush rankings with your current tools. A dated audit is supplied below; cite its date and source, never treat it as live evidence or invent scores, traffic or rankings. Only suggest wording, metadata, headings, internal links and image optimisation; do not suggest changes to existing schema markup, pricing, payment integrations or tracking. Never make changes or publish anything.\n\nSaved audit: ${JSON.stringify({ auditedAt: audit.auditedAt, coverage: audit.coverage, performance: audit.performance, searchPages: audit.searchPages, keywordEvidence: audit.keywordEvidence, findings: audit.findings, limitations: audit.limitations })}\n\nRequest: `;

function ChatWindow({ threadId, initialMessages, onActivity, seoAudit = false, seoContext = SEO_CONTEXT }: { threadId: string; initialMessages: UIMessage[]; onActivity: () => void; seoAudit?: boolean; seoContext?: string }) {
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
    sendMessage({ text: seoAudit ? `${seoContext}${v}` : v });
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
              <div className="grid gap-2 sm:grid-cols-2 max-w-2xl mx-auto">
                {(seoAudit ? SEO_STARTERS : STARTERS).map(s => (
                  <Button variant="outline" key={s} onClick={() => send(s)} className="h-auto whitespace-normal text-left justify-start text-sm p-3">{s}</Button>
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
                    : <p key={i} className="whitespace-pre-wrap">{seoAudit ? visibleSeoRequest(p.text) : p.text}</p>;
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
          <PromptInputTextarea value={text} onChange={(e: any) => setText(e.target.value)} placeholder={seoAudit ? 'Ask about SEO or paste page content…' : 'Ask the Agentic assistant…'} />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} disabled={!text.trim() && status === 'ready'} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

export default function GrowthAgentTab({ seoAudit = false, legacySeo = false }: { seoAudit?: boolean; legacySeo?: boolean }) {
  const [params, setParams] = useSearchParams();
  const threadId = params.get('thread');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loaded, setLoaded] = useState<{ id: string; messages: UIMessage[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [seoView, setSeoView] = useState<'report' | 'assistant' | 'weekly'>(() => legacySeo || params.get('thread') ? 'assistant' : 'weekly');
  const [reviewEvidence, setReviewEvidence] = useState<SeoReviewEvidence | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(seoAudit);
  const [evidenceError, setEvidenceError] = useState('');
  const seoContext = useMemo(() => buildSeoRecommendationContext({ auditedAt: audit.auditedAt, coverage: audit.coverage, performance: audit.performance, searchPages: audit.searchPages, findings: audit.findings, limitations: audit.limitations }, reviewEvidence), [reviewEvidence]);

  useEffect(() => {
    if (!seoAudit) return;
    let active = true;
    const loadEvidence = async () => {
      try {
        const { data: runs, error } = await supabase.from('seo_review_runs').select('id,status,audit_week,report').in('status', ['complete', 'partial']).order('audit_week', { ascending: false }).limit(1);
        if (error) throw error;
        const run = runs?.[0];
        if (!run) return;
        const { data: proposals, error: proposalError } = await supabase.from('seo_review_proposals').select('title,page_url,evidence,proposed_change,verification,priority,decision').eq('run_id', run.id).order('created_at');
        if (proposalError) throw proposalError;
        if (active) setReviewEvidence({ ...run, report: run.report as SeoReviewEvidence['report'], proposals: proposals || [] });
      } catch {
        if (active) setEvidenceError('Latest weekly evidence is unavailable for this login. Recommendations can still use the dated audit.');
      } finally {
        if (active) setEvidenceLoading(false);
      }
    };
    void loadEvidence();
    return () => { active = false; };
  }, [seoAudit]);

  const openThread = useCallback((id: string) => {
    setParams(prev => { const n = new URLSearchParams(prev); n.set('tab', legacySeo ? 'semrush-seo' : seoAudit ? 'seo-audit' : 'growth-agent'); n.set('thread', id); return n; });
  }, [setParams, seoAudit, legacySeo]);

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
    <div className="p-4 md:p-6 h-[calc(100vh-4rem)] min-h-[36rem] flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        {seoAudit ? <Search className="h-6 w-6 text-primary" /> : <Lightbulb className="h-6 w-6 text-primary" />}
        <div>
          <h1 className="text-xl font-semibold">{seoAudit ? 'SEO Audit' : 'Agentic assistant'}</h1>
          <p className="text-sm text-muted-foreground">{seoAudit ? 'Agentic Assistant · SEO recommendations' : "Uses the parts of the CRM you've been given access to and suggests what to do — it never changes or sends anything."}</p>
        </div>
      </div>
      {!seoAudit && <SalesRecommendationsPanel />}
      {seoAudit && seoView !== 'weekly' && <details className="mb-4 shrink-0"><summary className="cursor-pointer font-medium text-sm">Who acts on recommendations? What do the buttons do?</summary><div className="pt-3"><SeoActionGuide /></div></details>}
      {err && <p className="text-sm text-destructive mb-2">{err}</p>}
      {seoAudit && <><div className="flex flex-wrap gap-2 mb-4"><Button variant={seoView === 'assistant' ? 'default' : 'outline'} onClick={() => setSeoView('assistant')}><Lightbulb className="h-4 w-4 mr-2" />Recommendations</Button><Button variant={seoView === 'weekly' ? 'default' : 'outline'} onClick={() => setSeoView('weekly')}><Search className="h-4 w-4 mr-2" />Weekly reviews and approvals</Button><Button variant={seoView === 'report' ? 'default' : 'outline'} onClick={() => setSeoView('report')}><Search className="h-4 w-4 mr-2" />Audit report</Button></div><p className="text-xs text-muted-foreground mb-3">{evidenceLoading ? 'Loading available review evidence…' : reviewEvidence ? `Weekly evidence: ${reviewEvidence.report.checkedAt ? new Date(reviewEvidence.report.checkedAt).toLocaleString('en-GB') : reviewEvidence.audit_week} · ${reviewEvidence.report.checkedPages ?? 0} pages · ${reviewEvidence.proposals.length} proposals` : 'Saved website audit: 17 October 2026 · Latest weekly evidence unavailable'} · No automatic changes or publication</p>{evidenceError && <p role="status" className="text-sm text-muted-foreground mb-3">{evidenceError}</p>}</>}
      {seoAudit && seoView === 'weekly' ? <WeeklySeoReviews /> : seoAudit && seoView === 'report' ? <SeoAuditReport /> : <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0">
        <aside className="md:w-60 max-h-40 md:max-h-none shrink-0 flex flex-col border border-border rounded-lg p-2 min-h-0">
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
              <p className="text-sm text-muted-foreground">{seoAudit ? 'No SEO review selected.' : 'Start a conversation to get sales and marketing ideas.'}</p>
              <Button onClick={newThread}><Plus className="h-4 w-4 mr-1" />New conversation</Button>
            </div>
          ) : loaded?.id === threadId ? (
            evidenceLoading ? <p className="m-auto text-sm text-muted-foreground">Loading review evidence…</p> : <ChatWindow key={`${seoAudit ? 'seo' : 'growth'}-${threadId}`} threadId={threadId} initialMessages={loaded.messages} onActivity={loadThreads} seoAudit={seoAudit} seoContext={seoContext} />
          ) : (
            <p className="m-auto text-sm text-muted-foreground">Loading…</p>
          )}
        </section>
      </div>}
    </div>
  );
}
