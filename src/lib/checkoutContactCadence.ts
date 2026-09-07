/**
 * When to contact a customer who is stuck on checkout.
 *
 * Calling the second a checkout wobbles doesn't work — the customer is still
 * on the page and almost never answers. The agreed cadence is:
 *
 *   0–15 min   leave them alone, they are still buying
 *   15–30 min  a short helpful SMS/email nudge only
 *   30–60 min  one phone call (higher value / higher intent first)
 *   1–24 h     no answer? one more try 3–4 hours later or next business day
 *   24 h +     stop calling — work it as a normal lead / abandoned-cart follow-up
 */

export type ContactStage = 'settle' | 'nudge' | 'call' | 'retry' | 'lead';

export const SETTLE_MINUTES = 15;
export const NUDGE_MINUTES = 30;
export const CALL_MINUTES = 60;
export const STOP_MINUTES = 24 * 60;

export interface CadenceInfo {
  stage: ContactStage;
  minutes: number;
  /** Short chip label. */
  label: string;
  /** One-line instruction for the agent. */
  action: string;
  /** Calling is the right move right now. */
  canCall: boolean;
  /** Worth interrupting the whole team with the red banner. */
  shouldAlert: boolean;
  /** Tailwind classes for the chip. */
  chipClass: string;
}

export const minutesSince = (iso: string): number =>
  Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

const fmtWait = (mins: number) => {
  if (mins <= 0) return 'now';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

export const getContactCadence = (createdAt: string): CadenceInfo => {
  const minutes = minutesSince(createdAt);

  if (minutes < SETTLE_MINUTES) {
    return {
      stage: 'settle',
      minutes,
      label: 'Let them finish',
      action: `Still on checkout — don't call. Nudge from ${fmtWait(SETTLE_MINUTES - minutes)}.`,
      canCall: false,
      shouldAlert: false,
      chipClass: 'bg-slate-100 text-slate-700 border-slate-300',
    };
  }

  if (minutes < NUDGE_MINUTES) {
    return {
      stage: 'nudge',
      minutes,
      label: 'Send a nudge',
      action: `Text or email only: "Need any help completing your purchase?" Call from ${fmtWait(
        NUDGE_MINUTES - minutes,
      )}.`,
      canCall: false,
      shouldAlert: false,
      chipClass: 'bg-amber-100 text-amber-900 border-amber-300',
    };
  }

  if (minutes < CALL_MINUTES) {
    return {
      stage: 'call',
      minutes,
      label: 'Call now',
      action: 'Best window for one call — higher-value customers first.',
      canCall: true,
      shouldAlert: true,
      chipClass: 'bg-red-600 text-white border-red-700',
    };
  }

  if (minutes < STOP_MINUTES) {
    return {
      stage: 'retry',
      minutes,
      label: 'Second try',
      action: 'If they didn\'t answer, leave 3–4 hours between calls, or try the next business day.',
      canCall: true,
      shouldAlert: false,
      chipClass: 'bg-orange-100 text-orange-900 border-orange-300',
    };
  }

  return {
    stage: 'lead',
    minutes,
    label: 'Work as a lead',
    action: 'Over 24 hours — stop calling from here and follow the normal abandoned-checkout process.',
    canCall: false,
    shouldAlert: false,
    chipClass: 'bg-slate-100 text-slate-600 border-slate-300',
  };
};

/** Plain-English cadence, shown to agents above the live list. */
export const CADENCE_BULLETS: string[] = [
  'First 15 minutes: leave them alone — they are still buying.',
  '15–30 minutes: a short helpful text or email, no call.',
  '30–60 minutes: one call, highest value and intent first.',
  'No answer: wait 3–4 hours or the next business day before trying again.',
  'After 24 hours: stop calling and work it as a normal lead.',
];
