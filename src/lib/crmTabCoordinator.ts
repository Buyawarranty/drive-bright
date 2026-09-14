/**
 * CRM multi-tab coordinator.
 *
 * Agents habitually keep the admin dashboard open in 3-4 tabs. Every tab runs
 * its own copy of the CRM: its own realtime subscriptions, its own pollers,
 * counters, badge refreshes — and its own concurrency limiter. So four tabs =
 * four times the requests to the same host, and the browser only has a handful
 * of sockets per origin. The result is exactly what agents report: a white
 * screen with a spinner, because the queries that paint New Leads are stuck
 * behind background traffic from the *other* tabs.
 *
 * This module elects a single "primary" tab (the oldest live one). Secondary
 * tabs stay usable but run in a quiet mode: their background work is throttled
 * hard, so whichever tab the agent is actually looking at wins the sockets.
 *
 * Implementation notes:
 * - BroadcastChannel where available, localStorage heartbeat as fallback.
 * - Heartbeats every 2s, tabs considered dead after 6s (covers a crashed tab).
 */

const CHANNEL_NAME = 'baw-crm-tabs';
const STORAGE_KEY = 'baw_crm_tabs';
const HEARTBEAT_MS = 2000;
const DEAD_AFTER_MS = 6000;

export type CrmTabState = {
  /** Number of CRM tabs currently open for this browser profile. */
  tabCount: number;
  /** True when this tab is the elected primary (oldest live tab). */
  isPrimary: boolean;
};

type TabRecord = { id: string; bornAt: number; seenAt: number };

const TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const BORN_AT = Date.now();

const peers = new Map<string, TabRecord>();
const listeners = new Set<(state: CrmTabState) => void>();

let channel: BroadcastChannel | null = null;
let heartbeatTimer: number | null = null;
let started = false;
let state: CrmTabState = { tabCount: 1, isPrimary: true };

function readStore(): TabRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TabRecord[]) : [];
  } catch {
    return [];
  }
}

function writeStore() {
  try {
    const now = Date.now();
    const rows: TabRecord[] = [
      { id: TAB_ID, bornAt: BORN_AT, seenAt: now },
      ...readStore().filter((r) => r.id !== TAB_ID && now - r.seenAt < DEAD_AFTER_MS),
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // storage full / disabled — BroadcastChannel still works
  }
}

function prune() {
  const now = Date.now();
  peers.forEach((rec, id) => {
    if (now - rec.seenAt >= DEAD_AFTER_MS) peers.delete(id);
  });
}

function recompute() {
  prune();
  const live: TabRecord[] = [
    { id: TAB_ID, bornAt: BORN_AT, seenAt: Date.now() },
    ...Array.from(peers.values()),
  ];
  // Oldest tab wins; tie-break on id so every tab agrees.
  const primary = live.reduce((a, b) =>
    b.bornAt < a.bornAt || (b.bornAt === a.bornAt && b.id < a.id) ? b : a,
  );

  const next: CrmTabState = { tabCount: live.length, isPrimary: primary.id === TAB_ID };
  if (next.tabCount !== state.tabCount || next.isPrimary !== state.isPrimary) {
    state = next;
    listeners.forEach((fn) => fn(state));
  }
}

function announce(type: 'hello' | 'beat' | 'bye') {
  const payload = { type, id: TAB_ID, bornAt: BORN_AT, seenAt: Date.now() };
  try {
    channel?.postMessage(payload);
  } catch {
    // channel closed
  }
  if (type === 'bye') {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(readStore().filter((r) => r.id !== TAB_ID)),
      );
    } catch {
      /* ignore */
    }
  } else {
    writeStore();
  }
}

export function startCrmTabCoordinator() {
  if (started || typeof window === 'undefined') return;
  started = true;

  try {
    if ('BroadcastChannel' in window) channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    channel = null; // blocked by privacy settings / an extension — storage fallback covers us
  }

  if (channel) {
    channel.onmessage = (event) => {
      const msg = event.data as { type: string; id: string; bornAt: number };
      if (!msg?.id || msg.id === TAB_ID) return;
      if (msg.type === 'bye') {
        peers.delete(msg.id);
      } else {
        peers.set(msg.id, { id: msg.id, bornAt: msg.bornAt, seenAt: Date.now() });
        // A new tab needs to learn about us straight away.
        if (msg.type === 'hello') announce('beat');
      }
      recompute();
    };
  }

  // Seed from storage so we also see tabs that predate this one.
  const now = Date.now();
  readStore().forEach((r) => {
    if (r.id !== TAB_ID && now - r.seenAt < DEAD_AFTER_MS) peers.set(r.id, r);
  });

  announce('hello');
  recompute();

  // Heartbeats stop when the tab goes away, so a backgrounded/unloading tab
  // can never keep writing to shared localStorage (that write storm is what
  // made 4 open tabs contend on storage and stall each other).
  heartbeatTimer = window.setInterval(() => {
    announce('beat');
    recompute();
  }, HEARTBEAT_MS);

  const teardown = () => {
    if (heartbeatTimer !== null) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    try {
      channel?.close();
    } catch {
      /* already closed */
    }
    channel = null;
    announce('bye');
    started = false;
  };

  window.addEventListener('pagehide', teardown);
  window.addEventListener('beforeunload', teardown);
}

export function getCrmTabState(): CrmTabState {
  return state;
}

export function subscribeCrmTabState(fn: (s: CrmTabState) => void): () => void {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

/** True when this tab is a duplicate CRM tab and should run quietly. */
export function isSecondaryCrmTab(): boolean {
  return state.tabCount > 1 && !state.isPrimary;
}

/**
 * PERFORMANCE: shared guard for background refresh timers. Background tabs and
 * duplicate CRM tabs were each re-running every poll, multiplying database
 * traffic per agent and queueing the reads staff are actually waiting for.
 */
export function shouldSkipPoll(): boolean {
  if (typeof document !== 'undefined' && document.hidden) return true;
  return isSecondaryCrmTab();
}
