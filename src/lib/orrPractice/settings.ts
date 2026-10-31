/**
 * Management controls for the Open Round Robin practice run.
 *
 * Defaults follow the rules management set on 29 October 2026:
 *  - two minutes of quiet before a lead is considered for release;
 *  - three minutes for an agent to start work on a claimed lead;
 *  - re-release every two hours, round the clock, with no attempt cap;
 *  - permitted calling windows kept separate from the 24/7 intake clock.
 */

export interface ContactWindow {
  /** 0 = Monday … 6 = Sunday, matching JavaScript's day numbering. */
  day: number;
  startHour: number;
  endHour: number;
}

export interface OrrPracticeSettings {
  /** Minutes of quiet on the pricing journey before release is considered. */
  pricingInactivityMinutes: number;
  /** Minutes of quiet in checkout before the lead counts as abandoned. */
  checkoutAbandonmentMinutes: number;
  /** Minutes between pool reviews for a lead nobody has worked. */
  reReleaseIntervalMinutes: number;
  /** Minutes an agent may hold a claimed lead before it goes back. */
  claimExpiryMinutes: number;
  /** Pause proactive calling while the customer is actively in checkout. */
  activeCheckoutSuppression: boolean;
  /** Hours of the day a telephone approach is allowed. Kept separate from intake. */
  contactWindows: ContactWindow[];
  /** Maximum call attempts inside one rolling day. */
  maxContactAttemptsPerDay: number;
  /** Minutes to wait between two attempts on the same lead. */
  contactCooldownMinutes: number;
  /** Releases after which the lead is flagged for a manager. */
  escalationPriorityAfterReleases: number;
  /** Releases after which the lead is permanently suppressed. 0 means never. */
  permanentSuppressionAfterReleases: number;
  /** Require the fake Telephone Preference Service check to pass. */
  tpsCheckEnabled: boolean;
  /** Require the fake customer phone-consent flag. */
  phoneConsentRequired: boolean;
  /** Hold agents out of new ORR leads after sale-free working days. */
  noSaleBlockEnabled: boolean;
  /** Calendar days a new starter is exempt from the no-sale block. */
  newStarterGraceDays: number;
  /** Cap on the no-sale block ladder (1 day out per sale-free day, up to this). */
  maxNoSaleBlockDays: number;
  /** Minutes of break before unworked claimed leads return to the queue (no penalty). */
  breakGraceMinutes: number;
  /** Verified inactivity events in 5 days that flag a manager review. */
  inactivityReviewThreshold: number;
}

const weekdayWindow = (day: number): ContactWindow => ({ day, startHour: 9, endHour: 18 });

export const DEFAULT_ORR_PRACTICE_SETTINGS: OrrPracticeSettings = {
  pricingInactivityMinutes: 2,
  checkoutAbandonmentMinutes: 2,
  reReleaseIntervalMinutes: 120,
  claimExpiryMinutes: 3,
  activeCheckoutSuppression: true,
  // Same hours the business answers the phone: Mon to Fri 9am to 6pm, Sat 12pm to 4pm.
  contactWindows: [
    weekdayWindow(1),
    weekdayWindow(2),
    weekdayWindow(3),
    weekdayWindow(4),
    weekdayWindow(5),
    { day: 6, startHour: 12, endHour: 16 },
  ],
  maxContactAttemptsPerDay: 3,
  contactCooldownMinutes: 15,
  escalationPriorityAfterReleases: 6,
  permanentSuppressionAfterReleases: 0,
  tpsCheckEnabled: true,
  phoneConsentRequired: true,
  noSaleBlockEnabled: true,
  newStarterGraceDays: 14,
  maxNoSaleBlockDays: 3,
  breakGraceMinutes: 60,
  inactivityReviewThreshold: 3,
};

/** Intervals management can pick from for the re-release review. */
export const RE_RELEASE_INTERVAL_CHOICES_MINUTES = [30, 60, 120, 240, 480];

/** Inactivity intervals the analytics compare against each other. */
export const ANALYSIS_INTERVALS_MINUTES = [1, 2, 5];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Keeps every manager-entered rule inside a safe range. */
export const sanitiseSettings = (input: Partial<OrrPracticeSettings>): OrrPracticeSettings => ({
  ...DEFAULT_ORR_PRACTICE_SETTINGS,
  ...input,
  pricingInactivityMinutes: clamp(Number(input.pricingInactivityMinutes ?? 2), 1, 120),
  checkoutAbandonmentMinutes: clamp(Number(input.checkoutAbandonmentMinutes ?? 2), 1, 120),
  reReleaseIntervalMinutes: clamp(Number(input.reReleaseIntervalMinutes ?? 120), 5, 1440),
  claimExpiryMinutes: clamp(Number(input.claimExpiryMinutes ?? 3), 1, 60),
  maxContactAttemptsPerDay: clamp(Number(input.maxContactAttemptsPerDay ?? 3), 1, 20),
  contactCooldownMinutes: clamp(Number(input.contactCooldownMinutes ?? 15), 1, 720),
  escalationPriorityAfterReleases: clamp(Number(input.escalationPriorityAfterReleases ?? 6), 1, 100),
  permanentSuppressionAfterReleases: clamp(Number(input.permanentSuppressionAfterReleases ?? 0), 0, 100),
  activeCheckoutSuppression: input.activeCheckoutSuppression !== false,
  tpsCheckEnabled: input.tpsCheckEnabled !== false,
  phoneConsentRequired: input.phoneConsentRequired !== false,
  noSaleBlockEnabled: input.noSaleBlockEnabled !== false,
  newStarterGraceDays: clamp(Number(input.newStarterGraceDays ?? 14), 0, 60),
  maxNoSaleBlockDays: clamp(Number(input.maxNoSaleBlockDays ?? 3), 1, 7),
  breakGraceMinutes: clamp(Number(input.breakGraceMinutes ?? 60), 5, 480),
  inactivityReviewThreshold: clamp(Number(input.inactivityReviewThreshold ?? 3), 2, 20),
  contactWindows: Array.isArray(input.contactWindows) && input.contactWindows.length
    ? input.contactWindows
        .map(w => ({
          day: clamp(Number(w.day ?? 1), 0, 6),
          startHour: clamp(Number(w.startHour ?? 9), 0, 23),
          endHour: clamp(Number(w.endHour ?? 18), 1, 24),
        }))
        .filter(w => w.endHour > w.startHour)
    : DEFAULT_ORR_PRACTICE_SETTINGS.contactWindows,
});
