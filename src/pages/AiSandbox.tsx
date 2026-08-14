import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Plus, Trash2, MessageSquare, PhoneCall, Headset } from 'lucide-react';
import { useSandboxSpecialistPresence } from '@/hooks/useSandboxSpecialistPresence';

import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SandboxChatWindow from '@/components/ai-sandbox/SandboxChatWindow';
import rubyLogo from '@/assets/ai-sandbox-ruby.png';

type Thread = { id: string; title: string; updated_at: string };
type QueueItem = {
  id: string;
  thread_id: string;
  kind: string;
  reason: string | null;
  customer_name: string | null;
  quoted_price: number | null;
};

export default function AiSandbox() {
  const { threadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const { liveCount, meOnline, setOnDuty } = useSandboxSpecialistPresence();

  useEffect(() => {
    let cancelled = false;

    const apply = (user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } | null) => {
      if (cancelled) return;
      setUserId(user?.id ?? null);
      setDisplayName(
        (user?.user_metadata?.full_name as string | undefined) ??
          user?.email?.split('@')[0] ??
          null,
      );
      setCheckingAuth(false);
    };

    // Listen first: the session is restored asynchronously, so a single getUser()
    // call on mount can resolve before hydration and wrongly show "Sign in required".
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      apply((session?.user as any) ?? null);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) apply(data.session.user as any);
      else if (!cancelled) setCheckingAuth(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);



  const loadThreads = useCallback(async () => {
    const { data, error } = await supabase
      .from('ai_sandbox_threads')
      .select('id, title, updated_at')
      .order('updated_at', { ascending: false });
    if (error) {
      console.error('Failed to load sandbox threads', error);
      return [] as Thread[];
    }
    setThreads(data ?? []);
    return (data ?? []) as Thread[];
  }, []);

  const loadQueue = useCallback(async () => {
    const { data } = await supabase
      .from('ai_sandbox_handovers')
      .select('id, thread_id, kind, reason, customer_name, quoted_price')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(10);
    setQueue((data as QueueItem[]) ?? []);
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadQueue();
    const interval = window.setInterval(loadQueue, 15000);
    return () => window.clearInterval(interval);
  }, [userId, loadQueue]);

  const createThread = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('ai_sandbox_threads')
      .insert({ user_id: userId, title: 'New chat' })
      .select('id, title, updated_at')
      .single();
    if (error || !data) {
      console.error('Failed to create sandbox thread', error);
      return;
    }
    setThreads((prev) => [data as Thread, ...prev]);
    navigate(`/ai-sandbox/${data.id}`, { replace: !threadId });
  }, [userId, navigate, threadId]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const list = await loadThreads();
      if (!threadId) {
        if (list.length > 0) navigate(`/ai-sandbox/${list[0].id}`, { replace: true });
        else await createThread();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, threadId]);

  const deleteThread = async (id: string) => {
    await supabase.from('ai_sandbox_messages').delete().eq('thread_id', id);
    const { error } = await supabase.from('ai_sandbox_threads').delete().eq('id', id);
    if (error) {
      console.error('Failed to delete thread', error);
      return;
    }
    const remaining = threads.filter((t) => t.id !== id);
    setThreads(remaining);
    if (id === threadId) {
      if (remaining.length > 0) navigate(`/ai-sandbox/${remaining[0].id}`, { replace: true });
      else await createThread();
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8 text-sm text-muted-foreground">
        Checking access…
      </div>
    );
  }

  if (!userId) {
    return <SandboxSignIn />;
  }


  return (
    <div className="flex h-screen min-h-0 bg-background">
      <Helmet>
        <title>AI assistant sandbox | Buyawarranty</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-muted/30 md:flex">
        <div className="flex items-center gap-2 p-4">
          <img src={rubyLogo} alt="" width={28} height={28} className="h-7 w-7" loading="lazy" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">AI sandbox</p>
            <Badge variant="outline" className="mt-0.5 text-[10px]">
              Not live
            </Badge>
          </div>
        </div>

        <div className="px-3 pb-3">
          <Button size="sm" className="w-full" onClick={createThread}>
            <Plus className="mr-1.5 h-4 w-4" /> New chat
          </Button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {threads.map((t) => (
            <div
              key={t.id}
              className={`group mb-1 flex items-center gap-1 rounded-md px-2 py-1.5 text-sm ${
                t.id === threadId ? 'bg-background shadow-sm' : 'hover:bg-background/60'
              }`}
            >
              <button
                onClick={() => navigate(`/ai-sandbox/${t.id}`)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{t.title || 'New chat'}</span>
              </button>
              <button
                aria-label="Delete chat"
                onClick={() => deleteThread(t.id)}
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </nav>
        {queue.length > 0 && (
          <div className="border-t border-border p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <PhoneCall className="h-3.5 w-3.5" /> Waiting for a specialist ({queue.length})
            </p>
            <div className="space-y-1">
              {queue.map((q) => (
                <button
                  key={q.id}
                  onClick={() => navigate(`/ai-sandbox/${q.thread_id}`)}
                  className="w-full rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-left text-xs text-amber-900 hover:bg-amber-100"
                >
                  <span className="block truncate font-medium">
                    {q.customer_name || (q.kind === 'live_handover' ? 'Live handover' : 'Out of hours lead')}
                  </span>
                  <span className="block truncate opacity-80">
                    {(q.reason ?? '').replace(/_/g, ' ')}
                    {q.quoted_price ? ` · £${Math.round(q.quoted_price)}` : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <h1 className="text-sm font-semibold">Ruby — customer assistant (sandbox)</h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={meOnline ? 'default' : 'outline'}
              className="h-7 px-2 text-xs"
              onClick={() => setOnDuty(!meOnline, displayName)}
              title="Customers see 'a specialist is online now' while you are on duty"
            >
              <Headset className="mr-1.5 h-3.5 w-3.5" />
              {meOnline ? 'On duty for live chats' : 'Go on duty'}
            </Button>
            {liveCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
                </span>
                {liveCount} live
              </span>
            )}
            <Button size="sm" variant="outline" className="md:hidden" onClick={createThread}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {threadId ? (
          <SandboxChatWindow key={threadId} threadId={threadId} />
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Setting up your chat…</div>
        )}
      </main>
    </div>
  );
}

function SandboxSignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (signInError) setError(signInError.message);
    // On success the page's onAuthStateChange listener loads the sandbox.
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center p-8">
      <div className="flex flex-col items-center text-center">
        <img src={rubyLogo} alt="" width={40} height={40} className="mb-3 h-10 w-10" />
        <h1 className="text-lg font-semibold">Staff sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in here and you&apos;ll go straight into the Ruby chat — no trip to the dashboard.
        </p>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <div className="space-y-1">
          <Label htmlFor="sandbox-email">Work email</Label>
          <Input
            id="sandbox-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sandbox-password">Password</Label>
          <Input
            id="sandbox-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in and open chat'}
        </Button>
      </form>
    </div>
  );
}
