import type { UIMessage } from 'ai';

/**
 * Website visitors keep their Miles conversation when they move between pages
 * (e.g. "Continue to checkout" hands them to step 3 of the cart, which is a
 * different page). We stash the transcript + whether the panel was open in
 * localStorage, keyed by the visitor's guest token.
 */
const MESSAGES_PREFIX = 'baw_chat_msgs_';
const OPEN_KEY = 'baw_chat_open';
const MAX_MESSAGES = 60;

export function loadGuestMessages(token: string): UIMessage[] {
  try {
    const raw = window.localStorage.getItem(MESSAGES_PREFIX + token);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m) => m && typeof m === 'object' && typeof m.role === 'string' && Array.isArray(m.parts),
    ) as UIMessage[];
  } catch {
    return [];
  }
}

export function saveGuestMessages(token: string, messages: UIMessage[]) {
  try {
    if (messages.length === 0) {
      window.localStorage.removeItem(MESSAGES_PREFIX + token);
      return;
    }
    window.localStorage.setItem(
      MESSAGES_PREFIX + token,
      JSON.stringify(messages.slice(-MAX_MESSAGES)),
    );
  } catch {
    /* storage full or blocked — chat still works for this page view */
  }
}

export function loadGuestChatOpen(): boolean {
  try {
    return window.localStorage.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveGuestChatOpen(open: boolean) {
  try {
    if (open) window.localStorage.setItem(OPEN_KEY, '1');
    else window.localStorage.removeItem(OPEN_KEY);
  } catch {
    /* ignore */
  }
}
