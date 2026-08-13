import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import SandboxChatWindow from '@/components/ai-sandbox/SandboxChatWindow';
import rubyLogo from '@/assets/ai-sandbox-ruby.png';

type Thread = { id: string; title: string; updated_at: string };

export default function AiSandbox() {
  const { threadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setCheckingAuth(false);
    });
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
    return <div className="p-8 text-sm text-muted-foreground">Checking access…</div>;
  }

  if (!userId) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold">Sign in required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The AI sandbox is staff only. Please sign in to the admin area first.
        </p>
      </div>
    );
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
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h1 className="text-sm font-semibold">Ruby — customer assistant (sandbox)</h1>
          <Button size="sm" variant="outline" className="md:hidden" onClick={createThread}>
            <Plus className="h-4 w-4" />
          </Button>
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
