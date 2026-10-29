import type { PracticeLead } from './types';
import type { OrrPracticeSettings } from './settings';

/**
 * Contact safety for the Open Round Robin practice run.
 *
 * Allocation and telephoning are deliberately separate. A lead can be handed to
 * an agent while this check still says no, because a re-release inside the pool
 * must never put a call through on its own.
 */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export interface ContactDecision {
  allowed: boolean;
  reason: string;
}

/** True when `at` falls inside one of the manager-set calling windows. */
export const isWithinContactWindow = (settings: OrrPracticeSettings, at: number): boolean => {
  const when = new Date(at);
  const day = when.getDay();
  const hour = when.getHours();
  return settings.contactWindows.some(
    w => w.day === day && hour >= w.startHour && hour < w.endHour,
  );
};

/** Call attempts already made on this lead in the last rolling day. */
export const attemptsToday = (lead: PracticeLead, at: number): number =>
  lead.outcomes.filter(o => at - o.at < DAY).length;

/** Minutes still to run on the cooldown between attempts. */
export const cooldownRemainingMinutes = (
  lead: PracticeLead,
  settings: OrrPracticeSettings,
  at: number,
): number => {
  const last = lead.outcomes[lead.outcomes.length - 1];
  if (!last) return 0;
  const left = settings.contactCooldownMinutes * MINUTE - (at - last.at);
  return left > 0 ? Math.ceil(left / MINUTE) : 0;
};

/**
 * The single gate before any telephone approach. Every rule management listed
 * is checked here, in this order, so the reason shown is the first one that
 * applies and nothing is dialled by a pool movement alone.
 */
export const canAttemptContact = (
  lead: PracticeLead,
  settings: OrrPracticeSettings,
  at: number,
): ContactDecision => {
  if (lead.suppressed) {
    return { allowed: false, reason: 'Suppressed, so no further outreach' };
  }
  if (lead.purchased) {
    return { allowed: false, reason: 'Purchase confirmed, so sales outreach has stopped' };
  }
  if (!lead.identified) {
    return { allowed: false, reason: 'Anonymous visitor, so never a telephone lead' };
  }
  if (settings.activeCheckoutSuppression && lead.activeSession) {
    return {
      allowed: false,
      reason: 'Customer is actively completing their quote or checkout, so calling is paused',
    };
  }
  if (settings.tpsCheckEnabled && !lead.tpsClear) {
    return { allowed: false, reason: 'Register check says this number may not be called' };
  }
  if (settings.phoneConsentRequired && !lead.phoneConsent) {
    return { allowed: false, reason: 'No phone consent recorded for this practice customer' };
  }
  if (lead.callbackTime !== null && at < lead.callbackTime) {
    return {
      allowed: false,
      reason: 'Waiting for the call-back time the customer asked for',
    };
  }
  if (attemptsToday(lead, at) >= settings.maxContactAttemptsPerDay) {
    return { allowed: false, reason: 'Daily attempt limit reached for this lead' };
  }
  const cooling = cooldownRemainingMinutes(lead, settings, at);
  if (cooling > 0) {
    return { allowed: false, reason: `Cooling down for ${cooling} more minute${cooling === 1 ? '' : 's'}` };
  }
  if (!isWithinContactWindow(settings, at)) {
    return { allowed: false, reason: 'Outside the permitted calling hours' };
  }
  return { allowed: true, reason: 'Cleared for a call attempt' };
};
