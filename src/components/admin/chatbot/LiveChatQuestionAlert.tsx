import { shouldSkipPoll } from '@/lib/crmTabCoordinator';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Headset, MessageSquare, Volume2, VolumeX, X } from 'lucide-react';
import { playPhoneRing, stopPhoneRing } from '@/lib/aiSandbox/ringTone';
import { isTeamOpenNow } from '@/lib/aiSandbox/openingHours';
import { useChatAlertRecipient } from '@/hooks/useChatAlertRecipient';

type Row = {
  id: string;
  thread_id: string;
  content: string | null;
  parts: any;
  created_at: string;
  role: string;
};

const MUTE_KEY = 'chat_question_alert_muted';
/** Questions older than this stop popping up — they move to normal follow-up. */
const WINDOW_MINUTES = 20;
/** Beep cadence while a customer is waiting for a real person. */
const BEEP_MS = 10000;
/** The beeping silences itself after 20 seconds (two beeps). */
const AUTO_SILENCE_MS = 20000;

const text = (m: Row) => {
  if (m.content && m.content.trim()) return m.content.trim();
  const parts = Array.isArray(m.parts) ? m.parts : [];
  return parts
    .filter((p: any) => p?.type === 'text' && typeof p.text === 'string')
    .map((p: any) => p.text.trim())
    .filter(Boolean)
    .join('\n');
};

/**
 * Top-left pop-up of every live website chat question, for the named people
 * responsible for chat (ads/lead-gen, Abdul Nafay, support@, info@, super
 * admins and managers).
 *
 * While a customer has asked to speak to a real person during working hours it
 * beeps every 10 seconds until somebody replies, so a waiting customer can
 * never be left sitting there.
 */
export const LiveChatQuestionAlert: React.FC = () => {
  const { allowed, isSuperAdmin } = useChatAlertRecipient();
  const [rows, setRows] = useState<Row[]>([]);
  const [waitingCount, setWaitingCount] = useState(0);
  const [waitingThreadId, setWaitingThreadId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  // Super admin starts on mute (he is always busy); everyone else with access
  // hears the beep unless they mute it themselves.
  const [muted, setMuted] = useState<boolean>(false);
  const muteInit = useRef(false);

  useEffect(() => {
    if (muteInit.current || !allowed) return;
    muteInit.current = true;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(MUTE_KEY);
    } catch {
      stored = null;
    }
    if (stored === '1') setMuted(true);
    else if (stored === '0') setMuted(false);
    else setMuted(isSuperAdmin);
  }, [allowed, isSuperAdmin]);
  const [collapsed, setCollapsed] = useState(false);
  const [closed, setClosed] = useState(false);
  const closedFor = useRef<string | null>(null);
  const openNow = useRef(isTeamOpenNow());

  // Re-open the alert automatically only when a DIFFERENT customer starts
  // waiting. When nobody is waiting we leave the closed state alone, so the
  // X button actually closes the pop-up instead of it bouncing back open.
  useEffect(() => {
    if (waitingThreadId && closed && closedFor.current !== waitingThreadId) {
      setClosed(false);
    }
  }, [waitingThreadId, closed]);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
    const [{ data: msgs }, { data: handovers }] = await Promise.all([
      supabase
        .from('ai_sandbox_messages')
        .select('id, thread_id, role, content, parts, created_at')
        .gte('created_at', since)
        .in('role', ['user', 'agent'])
        .order('created_at', { ascending: true })
        .limit(200),
      supabase
        .from('ai_sandbox_handovers')
        .select('id, thread_id, created_at')
        .eq('status', 'waiting')
        .eq('kind', 'live_handover')
        .limit(20),
    ]);

    const all = (msgs ?? []) as Row[];
    // Latest human reply per conversation — a question already answered by a
    // real person is not an alert any more.
    const lastAgentAt = new Map<string, string>();
    all
      .filter((m) => m.role === 'agent')
      .forEach((m) => lastAgentAt.set(m.thread_id, m.created_at));

    const questions = all
      .filter((m) => m.role === 'user' && text(m))
      .filter((m) => {
        const replied = lastAgentAt.get(m.thread_id);
        return !replied || replied < m.created_at;
      })
      .reverse()
      .slice(0, 8);

    setRows(questions);
    const waitingThreads = new Set((handovers ?? []).map((h: any) => h.thread_id));
    const stillWaiting = [...waitingThreads].filter((t) => {
      const replied = lastAgentAt.get(String(t));
      return !replied;
    });
    setWaitingCount(stillWaiting.length);
    setWaitingThreadId(stillWaiting.length ? String(stillWaiting[0]) : null);
    openNow.current = isTeamOpenNow();
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void load();
    const t = window.setInterval(() => {
      if (shouldSkipPoll()) return;
      void load();
    }, 15000);
    return () => window.clearInterval(t);
  }, [allowed, load]);

  const visible = useMemo(() => rows.filter((r) => !dismissed.has(r.id)), [rows, dismissed]);
  const shouldBeep = allowed && !muted && waitingCount > 0 && openNow.current;

  // The beep switches itself off after 20 seconds — staff can mute it sooner
  // with the speaker button above. A NEW customer waiting re-arms the beep.
  useEffect(() => {
    if (!shouldBeep) {
      stopPhoneRing();
      return;
    }
    playPhoneRing();
    const beepTimer = window.setInterval(() => playPhoneRing(), BEEP_MS);
    const silenceTimer = window.setTimeout(() => {
      window.clearInterval(beepTimer);
      stopPhoneRing();
    }, AUTO_SILENCE_MS);
    return () => {
      window.clearInterval(beepTimer);
      window.clearTimeout(silenceTimer);
      stopPhoneRing();
    };
  }, [shouldBeep, waitingThreadId]);

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUTE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      if (next) stopPhoneRing();
      return next;
    });
  };

  if (!allowed || closed || (visible.length === 0 && waitingCount === 0)) return null;

  const openChat = (threadId: string) => {
    window.location.href = `/admin-dashboard/?tab=chatbot-data&chatThread=${threadId}`;
  };

  const closeAlert = () => {
    setClosed(true);
    closedFor.current = waitingThreadId;
    stopPhoneRing();
  };

  return (
    <div className="fixed left-2 top-2 z-[200] w-[340px] max-w-[calc(100vw-1rem)]">
      <div className="rounded-lg border-2 border-sky-500 bg-sky-600 shadow-xl">
        <div className="flex items-center gap-2 px-3 py-2 text-white">
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span className="text-sm font-bold text-white">
            {waitingCount > 0
              ? `${waitingCount} customer${waitingCount === 1 ? '' : 's'} waiting to speak to us`
              : `${visible.length} live chat question${visible.length === 1 ? '' : 's'}`}
          </span>
          <button
            type="button"
            onClick={toggleMute}
            title={muted ? 'Turn the sound back on' : 'Mute the sound'}
            className="ml-auto rounded p-1 text-white/90 hover:bg-white/20"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded px-1.5 text-xs font-bold text-white/90 hover:bg-white/20"
          >
            {collapsed ? 'Show' : 'Hide'}
          </button>
          <button
            type="button"
            onClick={closeAlert}
            title="Close alert"
            className="rounded p-1 text-white/90 hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!collapsed && (
          <div className="max-h-[46vh] space-y-2 overflow-y-auto bg-white p-2">
            {waitingCount > 0 && (
              <div className="flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-900">
                <Headset className="h-3.5 w-3.5" />
                Someone has asked for a real person — reply now. The beep stops by itself after 20
                seconds, or mute it sooner with the speaker button.
              </div>
            )}
            {waitingCount > 0 && waitingThreadId && (
              <Button
                size="sm"
                className="h-8 w-full text-xs"
                onClick={() => openChat(waitingThreadId)}
              >
                Go to the chat and reply now
              </Button>
            )}
            {visible.map((q) => (
              <div key={q.id} className="rounded border border-border bg-card p-2">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {new Date(q.created_at).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => setDismissed((prev) => new Set(prev).add(q.id))}
                    className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted"
                    title="Hide this one"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="line-clamp-4 text-xs text-foreground">{text(q)}</p>
                <Button
                  size="sm"
                  className="mt-2 h-7 w-full text-xs"
                  onClick={() => openChat(q.thread_id)}
                >
                  Open and reply
                </Button>
              </div>
            ))}
            {visible.length === 0 && (
              <p className="px-1 py-2 text-xs text-muted-foreground">
                No new questions — open Chatbot data to carry on a conversation.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveChatQuestionAlert;
