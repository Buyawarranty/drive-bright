/**
 * Section 7 — Eligibility and term controls (Aug 2026 proposal).
 *
 * Decides which warranty terms may be offered automatically based on the
 * vehicle's position at policy start (age in years and mileage), plus optional
 * model-risk flags. Sales staff see a light warning when a term needs extra
 * care or is unavailable.
 */

export type TermEligibilityRow = {
  position: string;
  automaticTerms: string;
  treatment: string;
};

/** The published control table, used for the management preview. */
export const TERM_ELIGIBILITY_TABLE: TermEligibilityRow[] = [
  {
    position: 'Up to 10 years and up to 100,000 miles',
    automaticTerms: '1, 2 and 3 years',
    treatment: 'Normal model-risk rules',
  },
  {
    position: '11–12 years or 100,001–120,000 miles',
    automaticTerms: '1, 2 and 3 years',
    treatment: 'Three years subject to model-risk configuration',
  },
  {
    position: '13–15 years or 120,001–150,000 miles',
    automaticTerms: '1 and 2 years',
    treatment: 'No automatic three-year term at launch',
  },
  {
    position: 'Very-high-risk model',
    automaticTerms: 'Configurable',
    treatment: 'One or two years',
  },
  {
    position: 'Referral / excluded model',
    automaticTerms: 'None automatically',
    treatment: 'Manual decision',
  },
  {
    position: 'Over 15 years or over 150,000 miles',
    automaticTerms: 'None',
    treatment: 'No automatic online quote',
  },
];

export type EligibilityInput = {
  ageYears?: number | null;
  mileage?: number | null;
  /** Model flagged very high risk — restricts to 1 or 2 years. */
  veryHighRisk?: boolean;
  /** Model on the referral / excluded list — manual decision only. */
  referralOrExcluded?: boolean;
};

export type EligibilityResult = {
  /** Terms (in months) that may be quoted automatically. */
  allowedTerms: number[];
  /** Blocked entirely — no automatic online quote. */
  blocked: boolean;
  /** Which band matched, for display. */
  band: string;
  /** Light warning for sales staff, if any. */
  warning?: string;
  /** Severity used for styling the notice. */
  severity?: 'info' | 'warning' | 'blocked';
};

export function evaluateTermEligibility(input: EligibilityInput): EligibilityResult {
  const age = typeof input.ageYears === 'number' ? input.ageYears : null;
  const miles = typeof input.mileage === 'number' && input.mileage > 0 ? input.mileage : null;

  if (input.referralOrExcluded) {
    return {
      allowedTerms: [],
      blocked: true,
      band: 'Referral / excluded model',
      severity: 'blocked',
      warning:
        'This model is on the referral list. No automatic terms — a manager needs to make a manual decision before quoting.',
    };
  }

  // Hard limits first.
  if ((age !== null && age > 15) || (miles !== null && miles > 150000)) {
    return {
      allowedTerms: [],
      blocked: true,
      band: 'Over 15 years or over 150,000 miles',
      severity: 'blocked',
      warning:
        'Outside automatic cover (over 15 years or over 150,000 miles). No automatic online quote — refer this one.',
    };
  }

  if (input.veryHighRisk) {
    return {
      allowedTerms: [12, 24],
      blocked: false,
      band: 'Very-high-risk model',
      severity: 'warning',
      warning:
        'Very-high-risk model — offer one or two years only. Three years is configurable by management.',
    };
  }

  const in13to15 = (age !== null && age >= 13 && age <= 15) || (miles !== null && miles > 120000);
  if (in13to15) {
    return {
      allowedTerms: [12, 24],
      blocked: false,
      band: '13–15 years or 120,001–150,000 miles',
      severity: 'warning',
      warning:
        'One and two year terms only at launch for this age or mileage. There is no automatic three-year term.',
    };
  }

  const in11to12 = (age !== null && age >= 11 && age <= 12) || (miles !== null && miles > 100000);
  if (in11to12) {
    return {
      allowedTerms: [12, 24, 36],
      blocked: false,
      band: '11–12 years or 100,001–120,000 miles',
      severity: 'info',
      warning:
        'Three years is allowed here but depends on the model-risk configuration. Check before you promise a three-year price.',
    };
  }

  return {
    allowedTerms: [12, 24, 36],
    blocked: false,
    band: 'Up to 10 years and up to 100,000 miles',
    severity: 'info',
  };
}
