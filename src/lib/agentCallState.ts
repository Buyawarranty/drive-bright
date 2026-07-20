/**
 * Shared "agent is on a call" flag.
 *
 * Set when the agent clicks Dial from any lead card / list. While active:
 *  - New lead pop-ups don't beep and don't auto-expand — they queue silently.
 *  - A small "On call" pill shows the queue size so the agent knows leads are
 *    stacking behind them without interrupting the conversation.
 *
 * Auto-clears after 15 minutes so a forgotten flag doesn't silence alerts
 * forever. Agent can also click "Call ended" on the pill to clear immediately.
 */

const listeners = new Set<() => void>();
let activeUntil = 0;

const AUTO_CLEAR_MS = 15 * 60 * 1000;

const emit = () => listeners.forEach((l) => { try { l(); } catch { /* ignore */ } });

export const markAgentOnCall = (durationMs: number = AUTO_CLEAR_MS) => {
  activeUntil = Date.now() + durationMs;
  emit();
};

export const clearAgentOnCall = () => {
  activeUntil = 0;
  emit();
};

export const isAgentOnCall = (): boolean => activeUntil > Date.now();

export const subscribeAgentOnCall = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};
