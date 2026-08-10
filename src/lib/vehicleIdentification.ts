/**
 * Single source of truth for "do we actually know what this vehicle is?".
 *
 * A warranty can never be priced or sold from a partial identification. If the
 * DVSA/DVLA lookups (plus our mot_history cache) cannot return BOTH a real make
 * and a real model, the journey must stop:
 *  - Website Step 1: customer is asked to call us or request a callback.
 *  - Quotes & Orders: the agent is blocked until a manager authorises it.
 */

export type VehicleIdGapCode = 'not_found' | 'model_missing';

export interface VehicleIdGap {
  code: VehicleIdGapCode;
  /** Customer-facing headline (website). */
  message: string;
  /** Customer-facing supporting line. */
  detail: string;
  /** Internal wording for agents in Quotes & Orders. */
  agentMessage: string;
}

interface LookupLike {
  found?: boolean;
  make?: string | null;
  model?: string | null;
  modelMissing?: boolean;
}

const PLACEHOLDER = /^(unknown|n\/?a|none|null|not available|premium vehicle|unknown model)$/i;

const isRealValue = (value?: string | null): boolean => {
  const clean = (value ?? '').toString().trim();
  if (!clean) return false;
  return !PLACEHOLDER.test(clean);
};

/** True when we know the make AND the model well enough to price the vehicle. */
export const isVehicleFullyIdentified = (data?: LookupLike | null): boolean =>
  getVehicleIdentificationGap(data) === null;

/** Returns the identification gap, or null when the vehicle is fully known. */
export const getVehicleIdentificationGap = (data?: LookupLike | null): VehicleIdGap | null => {
  if (!data || data.found === false || !isRealValue(data.make)) {
    return {
      code: 'not_found',
      message: "We couldn't confirm this vehicle from its registration",
      detail:
        "We can only give a price once we know the exact make and model. Please give us a call or request a callback and we'll confirm your vehicle and price it for you.",
      agentMessage:
        'Vehicle not recognised — no make returned. A manager must authorise before you continue or quote.',
    };
  }

  if (data.modelMissing || !isRealValue(data.model)) {
    return {
      code: 'model_missing',
      message: `We found the make (${(data.make ?? '').toString().trim()}) but not the model`,
      detail:
        "We price each model individually, so we can't quote until the model is confirmed. Please give us a call or request a callback and we'll sort it in a minute.",
      agentMessage:
        'Model not returned by DVSA/DVLA — make only. A manager must authorise before you continue or quote.',
    };
  }

  return null;
};
