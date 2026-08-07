/**
 * PHASE 4 — GRANULAR MODEL RISK RULES (DRAFT ONLY)
 * ---------------------------------------------------------------------------
 * Today "risk" is largely mapped at make level ("BMW = premium"), which prices a
 * 118d like a 520d. This module holds model/trim level risk rules instead:
 *
 *   make + model pattern  →  risk multiplier (and an optional 1-year floor)
 *
 * Nothing here is imported by the customer journey or by Quotes & Orders. It is
 * exercised from Admin → Price updates → Pricing engine (draft) so rules can be
 * written, matched against real vehicle names and priced side by side with live
 * before anything is published.
 *
 * Deliberately out of scope: the old £5,000 claim-limit blocklist. £5,000 cover
 * is no longer blocked for any vehicle, so model risk is expressed purely as a
 * price multiplier / floor, never as a cover restriction.
 */

import { normalizeVehicleText } from './modelFloorMatch';

export type ModelRiskRule = {
  id: string;
  /** Make the rule applies to, e.g. "BMW". Required — rules are never global. */
  make: string;
  /**
   * Model / trim text the rule applies to, e.g. "520", "Golf", "Range Rover Sport".
   * Empty means make-level, which is flagged as too broad (see `isTooBroad`).
   */
  model: string;
  /** Price multiplier on the grid base price. 1 = no change. */
  riskFactor: number;
  /** Optional minimum 1-year price for this model (null = use global floors). */
  minOneYear: number | null;
  /** Why the rule exists — shown to managers, never to customers. */
  note?: string;
  enabled: boolean;
};

/** Multiplier bounds so a typo can never 10× or zero a price. */
export const MIN_RISK_FACTOR = 0.7;
export const MAX_RISK_FACTOR = 2.5;

export function clampRiskFactor(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_RISK_FACTOR, Math.max(MIN_RISK_FACTOR, value));
}

/** A rule that only names a make repeats the mistake Phase 4 exists to fix. */
export function isTooBroad(rule: ModelRiskRule): boolean {
  return !String(rule.model || '').trim();
}

/**
 * Starter set: only vehicles we actually cover.
 *
 * Performance derivatives (BMW M, Mercedes-AMG, Audi RS/R8, Porsche high
 * performance, JCW, ST/RS etc.) are NOT priced here — they are declined outright
 * by the excluded vehicle matrix (src/lib/vehicleExclusions.ts), so giving them a
 * risk factor would imply we quote them. Model risk exists to separate covered
 * models of the same make (a 118d vs a 520d, a Golf vs a Passat).
 */
export const DEFAULT_MODEL_RISK_RULES: ModelRiskRule[] = [
  { id: 'bmw-5', make: 'BMW', model: '520', riskFactor: 1.05, minOneYear: null, note: 'Executive diesel, higher parts cost', enabled: true },
  { id: 'bmw-3', make: 'BMW', model: '320', riskFactor: 1, minOneYear: null, enabled: true },
  { id: 'bmw-1', make: 'BMW', model: '118', riskFactor: 0.95, minOneYear: null, note: 'Low-risk volume hatch', enabled: true },
  { id: 'bmw-x5', make: 'BMW', model: 'X5', riskFactor: 1.2, minOneYear: 599, note: 'Air suspension and transfer box claims', enabled: true },
  { id: 'mercedes-a', make: 'Mercedes', model: 'A180', riskFactor: 0.98, minOneYear: null, enabled: true },
  { id: 'mercedes-c', make: 'Mercedes', model: 'C220', riskFactor: 1.05, minOneYear: null, enabled: true },
  { id: 'mercedes-ml', make: 'Mercedes', model: 'ML', riskFactor: 1.2, minOneYear: 599, enabled: true },
  { id: 'audi-a3', make: 'Audi', model: 'A3', riskFactor: 1, minOneYear: null, enabled: true },
  { id: 'audi-a6', make: 'Audi', model: 'A6', riskFactor: 1.1, minOneYear: null, enabled: true },
  { id: 'audi-q7', make: 'Audi', model: 'Q7', riskFactor: 1.25, minOneYear: 649, note: 'Air suspension claims', enabled: true },
  { id: 'vw-golf', make: 'Volkswagen', model: 'Golf', riskFactor: 0.95, minOneYear: null, enabled: true },
  { id: 'vw-passat', make: 'Volkswagen', model: 'Passat', riskFactor: 1.05, minOneYear: null, note: 'DSG and diesel ancillaries', enabled: true },
  { id: 'landrover-sport', make: 'Land Rover', model: 'Range Rover Sport', riskFactor: 1.45, minOneYear: 849, note: 'Air suspension and electronics claims', enabled: true },
  { id: 'landrover-disco', make: 'Land Rover', model: 'Discovery Sport', riskFactor: 1.2, minOneYear: null, enabled: true },
  { id: 'landrover-evoque', make: 'Land Rover', model: 'Evoque', riskFactor: 1.15, minOneYear: null, enabled: true },
  { id: 'tesla-3', make: 'Tesla', model: 'Model 3', riskFactor: 1.1, minOneYear: null, note: 'Drive unit and battery ancillaries', enabled: true },
  { id: 'ford-focus', make: 'Ford', model: 'Focus', riskFactor: 0.95, minOneYear: null, enabled: true },
  { id: 'ford-fiesta', make: 'Ford', model: 'Fiesta', riskFactor: 0.9, minOneYear: null, note: 'Cheapest claims in the book', enabled: true },
  { id: 'nissan-qashqai', make: 'Nissan', model: 'Qashqai', riskFactor: 0.95, minOneYear: null, enabled: true },
  { id: 'vauxhall-zafira', make: 'Vauxhall', model: 'Zafira', riskFactor: 1, minOneYear: null, enabled: true },
];

/** Term scaling for a model 1-year floor, matching the sellable minimums. */
const TERM_FLOOR_RATIO: Record<string, number> = {
  '12months': 1,
  '24months': 659 / 399,
  '36months': 938 / 399,
};

function tokens(text: string): string[] {
  return normalizeVehicleText(text).split(' ').filter(Boolean);
}

/** Does `haystack` contain every token of `needle`, in any order? */
function containsAllTokens(haystack: string[], needle: string): boolean {
  const wanted = tokens(needle);
  if (!wanted.length) return false;
  return wanted.every(t => haystack.includes(t));
}

export type ModelRiskMatch = {
  rule: ModelRiskRule;
  /** How specific the match was — the most specific enabled rule wins. */
  specificity: number;
};

/**
 * Best matching rule for a vehicle. Make must match; the most specific model
 * match wins, so "Range Rover Sport" beats "Range Rover" and "520" beats a make-level BMW rule.
 */
export function matchModelRiskRule(
  make: string | null | undefined,
  model: string | null | undefined,
  rules: ModelRiskRule[]
): ModelRiskMatch | null {
  const makeTokens = tokens(`${make || ''}`);
  const modelTokens = tokens(`${make || ''} ${model || ''}`);
  if (!makeTokens.length) return null;

  let best: ModelRiskMatch | null = null;
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (!containsAllTokens(makeTokens, rule.make) && !containsAllTokens(modelTokens, rule.make)) continue;

    const modelText = String(rule.model || '').trim();
    if (modelText && !containsAllTokens(modelTokens, modelText)) continue;

    const specificity = modelText ? tokens(modelText).join('').length + 10 : 0;
    if (!best || specificity > best.specificity) best = { rule, specificity };
  }
  return best;
}

export type ModelRiskOutcome = {
  matched: ModelRiskRule | null;
  riskFactor: number;
  minPrice: number | null;
  tooBroad: boolean;
};

/** Risk factor and model floor for a vehicle and term. */
export function resolveModelRisk(
  make: string | null | undefined,
  model: string | null | undefined,
  paymentPeriod: string,
  rules: ModelRiskRule[]
): ModelRiskOutcome {
  const match = matchModelRiskRule(make, model, rules);
  if (!match) return { matched: null, riskFactor: 1, minPrice: null, tooBroad: false };

  const rule = match.rule;
  const min = Number(rule.minOneYear);
  const ratio = TERM_FLOOR_RATIO[paymentPeriod] ?? 1;
  return {
    matched: rule,
    riskFactor: clampRiskFactor(Number(rule.riskFactor)),
    minPrice: Number.isFinite(min) && min > 0 ? Math.ceil(min * ratio) : null,
    tooBroad: isTooBroad(rule),
  };
}

/** Apply the model risk factor and floor to a base price (draft maths). */
export function applyModelRisk(
  basePrice: number,
  outcome: ModelRiskOutcome
): { price: number; floorApplied: boolean } {
  const adjusted = Math.ceil(basePrice * outcome.riskFactor);
  if (outcome.minPrice !== null && adjusted < outcome.minPrice) {
    return { price: outcome.minPrice, floorApplied: true };
  }
  return { price: adjusted, floorApplied: false };
}

const STORAGE_KEY = 'bw:draft-model-risk-rules';

export function loadDraftModelRiskRules(): ModelRiskRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MODEL_RISK_RULES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_MODEL_RISK_RULES;
    return parsed
      .filter((r: ModelRiskRule) => r && String(r.make || '').trim())
      .map((r: ModelRiskRule, i: number) => ({
        id: r.id || `rule-${i}`,
        make: String(r.make),
        model: String(r.model || ''),
        riskFactor: clampRiskFactor(Number(r.riskFactor)),
        minOneYear: Number.isFinite(Number(r.minOneYear)) && Number(r.minOneYear) > 0 ? Number(r.minOneYear) : null,
        note: r.note || undefined,
        enabled: r.enabled !== false,
      }));
  } catch {
    return DEFAULT_MODEL_RISK_RULES;
  }
}

export function saveDraftModelRiskRules(rules: ModelRiskRule[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch {
    /* draft only — a full storage quota must never break the page */
  }
}
