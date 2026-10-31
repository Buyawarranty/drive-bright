/**
 * Open Round Robin practice engine: shared types.
 *
 * Every value in here is made up. The engine holds no Supabase client, makes no
 * network request and imports nothing from `src/integrations`, so a practice run
 * cannot reach a real customer, a real lead, a text, a WhatsApp message or the
 * phone system. That is the isolation guarantee for this sandbox.
 */

/** What the customer did on the website. Mirrors the events management asked for. */
export type JourneyEventKind =
  | 'pricing_page_entered'
  | 'quote_details_submitted'
  | 'checkout_entered'
  | 'activity'
  | 'checkout_abandoned'
  | 'callback_requested'
  | 'purchase_completed';

export interface JourneyEvent {
  kind: JourneyEventKind;
  /** Server-side clock, milliseconds since the epoch. */
  at: number;
  note?: string;
  /** Money the practice customer paid, for the purchase_completed event only. */
  amount?: number;
  /** When the customer asked to be called back, for the callback_requested event. */
  callbackAt?: number;
}



/** Where a practice lead currently sits in the journey. */
export type LeadStage =
  /** Browsing without giving details. Never becomes a telephone lead. */
  | 'anonymous'
  /** Gave details and is still working through pricing or checkout. */
  | 'active_session'
  /** Went quiet past the threshold and is waiting for the next release pass. */
  | 'awaiting_release'
  /** In the Open Round Robin pool, ready for an agent. */
  | 'queued'
  /** One agent holds it exclusively and the claim clock is running. */
  | 'reserved'
  /** A confirmed conversation with the customer made it theirs. */
  | 'owned'
  /** Bought, closed or suppressed. No further outreach. */
  | 'closed';

/** How a call attempt ended. Only `spoke` creates ownership. */
export type ContactResult =
  | 'spoke'
  | 'voicemail'
  | 'no_answer'
  | 'wrong_number'
  | 'quitted'
  | 'complaint'
  | 'opt_out';

/** Where the call result came from. */
export type ContactSource = 'zoiper' | 'dial_nine' | 'manual';

export interface ContactOutcome {
  at: number;
  agentId: string;
  result: ContactResult;
  source: ContactSource;
  /** Seconds on the line. Voicemails are ignored however long they run. */
  durationSeconds: number;
}

export interface PracticeLead {
  id: string;
  /** Dedupe key so one person moving between pages stays one lead. */
  personKey: string;
  name: string;
  phone: string;
  email: string;
  reg: string;
  stage: LeadStage;
  /** True once the customer has given usable contact details. */
  identified: boolean;
  /** True while they are actively completing a quote or checkout. */
  activeSession: boolean;
  createdAt: number;
  lastActivityAt: number;
  lastStageChangeAt: number;
  /** Set when the customer asked for a call back. */
  callbackRequestedAt: number | null;
  callbackTime: number | null;
  /** A purchase stops all sales outreach. */
  purchased: boolean;
  /** Permanently suppressed: do-not-contact, complaint or opt-out. */
  suppressed: boolean;
  /** Fake record of a Telephone Preference Service check. */
  tpsClear: boolean;
  /** Fake record of the customer agreeing to be phoned about this. */
  phoneConsent: boolean;
  /** Durable owner. Only a confirmed conversation sets this. */
  ownerAgentId: string | null;
  /** Agent holding the temporary exclusive reservation. */
  reservedAgentId: string | null;
  reservedAt: number | null;
  reservedExpiresAt: number | null;
  /** When the pool reviews this lead again if nobody has worked it. */
  reReleaseDueAt: number | null;
  /** How many times this lead has been handed to an agent. */
  releaseCount: number;
  /** Minutes between the customer going quiet and the first call attempt. */
  firstAttemptLeadMinutes: number | null;
  /** What the practice customer paid, once they bought. */
  value: number;
  events: JourneyEvent[];

  outcomes: ContactOutcome[];
  history: string[];
}

/** A practice agent. Names are made up unless the manager picks a real seat. */
export interface PracticeAgent {
  id: string;
  name: string;
  /** Fake daily allowance so capacity can be rehearsed. */
  dailyCap: number;
  /** Practice leads already given to them today. */
  usedToday: number;
  available: boolean;
  /**
   * Corrected availability rule (31 Oct 2026): set by the phone system or by
   * the agent. Only 'available' agents are offered or may claim new leads.
   */
  availability?: import('./availability').AvailabilityState;
}

/** Result of one engine step, so the panel can explain what moved and why. */
export interface EngineResult {
  leads: PracticeLead[];
  notes: string[];
}
