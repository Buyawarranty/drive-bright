import { useEffect, useState } from 'react';

const URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-agent-availability`;

export type LiveAgentState = {
  /** True only while a specialist has themselves switched on as live. */
  live: boolean;
  count: number;
  names: string[];
};

/**
 * Is a real warranty specialist live for the website chat right now?
 *
 * Driven entirely by agents ticking themselves on duty in the Miles chat admin
 * area. When nobody is on duty the chat never offers "talk to an agent", so we
 * only promise a live person when one is genuinely there.
 */
export function useLiveAgentAvailable(pollMs = 60000): LiveAgentState {
  const [state, setState] = useState<LiveAgentState>({ live: false, count: 0, names: [] });

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const data = await res.json().catch(() => null);
        if (cancelled || !data) return;
        setState({
          live: Boolean(data.live),
          count: Number(data.count ?? 0),
          names: Array.isArray(data.names) ? data.names.slice(0, 3) : [],
        });
      } catch {
        if (!cancelled) setState({ live: false, count: 0, names: [] });
      }
    };
    check();
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      check();
    }, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pollMs]);

  return state;
}
