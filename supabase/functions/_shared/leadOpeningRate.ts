/**
 * Rapid lead-opening detection.
 *
 * A lead "opening" is recorded every time a member of staff clicks into a lead
 * or copies its phone number. Someone harvesting numbers works through lead
 * after lead without ever dialling; someone actually calling dials the number
 * they just looked at — whether or not the customer picks up. So an opening is
 * only suspicious when no call to that lead follows it. A dial that rings out,
 * is engaged or goes to voicemail is real phone work and never counts.
 *
 * Pure module: no Supabase, no DOM. Shared by the scheduled edge function and
 * the admin alert card so the rule can never disagree with itself.
 */

/** How many openings without a call trip the alert. */
export const DEFAULT_OPENING_THRESHOLD = 30;
/** How far back the check looks, in minutes. */
export const DEFAULT_WINDOW_MINUTES = 10;
/** Never alert twice for the same person inside this window. */
export const ALERT_COOLDOWN_MINUTES = 30;
/** A dial may start a moment before the opening is written (fast clickers). */
export const DIAL_LEAD_MS = 15_000;
/** ...or up to this long after the opening was recorded. */
export const DIAL_FOLLOW_MS = 90_000;

/** Last nine digits of a UK number, so 07960123456 and +447960123456 match. */
export const phoneTail = (raw: unknown): string => {
  const digits = String(raw ?? '').replace(/\D/g, '');
  const national = digits.startsWith('44') ? `0${digits.slice(2)}` : digits;
  return national.length >= 9 ? national.slice(-9) : '';
};

export interface AccessEvent {
  actorId: string;
  leadId: string;
  /** Epoch milliseconds, from the server-stamped occurred_at. */
  occurredAt: number;
}

export interface DialAttempt {
  actorId: string;
  /** Epoch milliseconds the call started. */
  at: number;
  /** Set when the call record is tied to a lead directly. */
  leadId?: string | null;
  /** Dialed number, used when only the number is known. */
  phone?: string | null;
  /** True when a person answered, not a ring-out or voicemail. */
  connected: boolean;
}

export interface ActorActivity {
  actorId: string;
  /** Openings and number copies in the window. */
  opened: number;
  /** Openings followed by a call to that same lead. */
  withDial: number;
  /** Of those, how many the customer actually answered. */
  connected: number;
  /** Openings with no call at all — the number-harvesting signal. */
  noDial: number;
}

const push = <T>(map: Map<string, T[]>, key: string, value: T) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

/**
 * Group openings per person and mark each one that is followed by a call to
 * that same lead, matched either by lead id or by the lead's phone number.
 */
export function summariseOpenings(
  events: AccessEvent[],
  leadPhones: Map<string, string>,
  dials: DialAttempt[],
): Map<string, ActorActivity> {
  const eventsByActor = new Map<string, AccessEvent[]>();
  for (const event of events) push(eventsByActor, event.actorId, event);

  const dialsByActor = new Map<string, DialAttempt[]>();
  for (const dial of dials) push(dialsByActor, dial.actorId, dial);

  const out = new Map<string, ActorActivity>();
  for (const [actorId, list] of eventsByActor) {
    const mine = (dialsByActor.get(actorId) || []).slice().sort((a, b) => a.at - b.at);
    let withDial = 0;
    let connected = 0;
    for (const event of list) {
      const tail = phoneTail(leadPhones.get(event.leadId));
      const hit = mine.find(
        (dial) =>
          dial.at >= event.occurredAt - DIAL_LEAD_MS &&
          dial.at <= event.occurredAt + DIAL_FOLLOW_MS &&
          ((!!event.leadId && dial.leadId === event.leadId) ||
            (!!tail && phoneTail(dial.phone) === tail)),
      );
      if (hit) {
        withDial += 1;
        if (hit.connected) connected += 1;
      }
    }
    out.set(actorId, {
      actorId,
      opened: list.length,
      withDial,
      connected,
      noDial: list.length - withDial,
    });
  }
  return out;
}

/** A person is flagged only on openings that no call followed. */
export const isRapidOpening = (
  activity: ActorActivity,
  threshold: number = DEFAULT_OPENING_THRESHOLD,
): boolean => activity.noDial >= threshold;

/** Shared wording so the email and the on-screen card always agree. */
export const describeActivity = (activity: ActorActivity): string[] => [
  `Opened or copied ${activity.opened} lead${activity.opened === 1 ? '' : 's'}`,
  `Called ${activity.withDial} of them`,
  `Reached ${activity.connected}`,
  `No call made to ${activity.noDial}`,
];
