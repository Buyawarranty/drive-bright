/**
 * How long a manager's authorisation decision keeps popping up at the selling
 * agent's screen. It reappears on every dashboard visit until the agent
 * acknowledges it, but it must not nag forever: once a decision is older than
 * SALE_AUTH_POPUP_DAYS it stops popping. The decision itself is never deleted —
 * it stays on record in sale_authorisations.
 */
export const SALE_AUTH_POPUP_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Oldest decision (ISO string) that should still be shown to the agent. */
export const saleAuthPopupCutoff = (now: Date = new Date()): string =>
  new Date(now.getTime() - SALE_AUTH_POPUP_DAYS * DAY_MS).toISOString();

/** True while a decision is still inside the pop-up window. */
export const isSaleAuthWithinPopupWindow = (
  decidedAt: string | null | undefined,
  now: Date = new Date(),
): boolean => {
  if (!decidedAt) return false;
  const decided = new Date(decidedAt).getTime();
  if (Number.isNaN(decided)) return false;
  return decided >= now.getTime() - SALE_AUTH_POPUP_DAYS * DAY_MS;
};

/** What the selling agent can say when closing the pop-up. */
export type SaleAuthAgentAction = {
  key: 'accepted' | 'will_speak_to_manager' | 'acknowledged';
  label: string;
  variant: 'secondary' | 'outline' | 'ghost';
};

/**
 * The reply buttons on the pop-up. An authorised sale is confirmed or queried;
 * a declined sale leads with speaking to the manager, since that is the whole
 * point of the decision.
 */
export const saleAuthAgentActions = (status: string): SaleAuthAgentAction[] =>
  status === 'approved'
    ? [
        { key: 'accepted', label: 'Accepted, thanks', variant: 'secondary' },
        { key: 'will_speak_to_manager', label: "I'll speak to manager", variant: 'outline' },
      ]
    : [
        { key: 'will_speak_to_manager', label: "I'll speak to manager", variant: 'outline' },
        { key: 'acknowledged', label: 'Understood', variant: 'ghost' },
      ];
