/**
 * Matching helper for the model-specific floors and referrals list.
 *
 * Admins type free text ("Range Rover Sport", "Tesla", "BMW M derivatives"),
 * and vehicles arrive from the DVLA lookup as separate make and model fields
 * ("TESLA" + "MODEL X"). This normalises both sides so a rule still matches
 * when the wording is glued together, punctuated or in a different order.
 *
 * Pure text helpers only — no pricing calculations live here.
 */

export type MatchableFloor = {
  key: string;
  vehicle: string;
  minOneYear: number | null;
  treatment: string;
  covered: boolean;
};

/** Words that carry no matching value in a rule name. */
const STOP_WORDS = new Set([
  'and',
  'or',
  'the',
  'derivatives',
  'derivative',
  'models',
  'model',
  'variants',
  'variant',
  'series',
  'range',
  'all',
]);

/** "Range Rover" is a make in its own right, not a model of Rover. */
const SYNONYMS: Record<string, string> = {
  landrover: 'land rover',
  vw: 'volkswagen',
  merc: 'mercedes',
  mercedesbenz: 'mercedes',
  benz: 'mercedes',
  chevy: 'chevrolet',
  rangerover: 'range rover',
};

/**
 * Split glued words so "TeslaX", "Model3" and "RS6" become separate tokens.
 * camelCase, letter/digit boundaries and punctuation are all treated as breaks.
 */
function splitGluedWords(input: string): string {
  return input
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2');
}

/** Lowercased, punctuation-free, single-spaced text. */
export function normalizeVehicleText(input: string): string {
  const spaced = splitGluedWords(String(input || ''))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return spaced
    .split(' ')
    .map(word => SYNONYMS[word] || word)
    .join(' ')
    .trim();
}

/** Meaningful tokens for matching, with stop words and duplicates removed. */
export function vehicleTokens(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of normalizeVehicleText(input).split(' ')) {
    if (!token || STOP_WORDS.has(token) || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

export type FloorMatch<T extends MatchableFloor = MatchableFloor> = {
  floor: T;
  /** How many of the rule's tokens the vehicle matched. */
  matchedTokens: string[];
  /** Higher wins: longer, more specific rules beat broad make-only rules. */
  score: number;
  /** True when every token in the rule was found in the vehicle text. */
  exact: boolean;
};

/**
 * Score one rule against a vehicle description.
 * A rule matches when the vehicle text contains at least one of its tokens,
 * and rules that match more of their own tokens score higher.
 */
function scoreFloor<T extends MatchableFloor>(
  vehicleTokenList: string[],
  floor: T
): FloorMatch<T> | null {
  const ruleTokens = vehicleTokens(floor.vehicle);
  if (ruleTokens.length === 0) return null;

  const matchedTokens = ruleTokens.filter(token =>
    vehicleTokenList.some(vt => vt === token || vt.startsWith(token) || token.startsWith(vt))
  );
  if (matchedTokens.length === 0) return null;

  // A multi-token rule must match its leading (make) token to count, so
  // "Range Rover Sport" never fires on a "Ford Sport" vehicle.
  if (ruleTokens.length > 1 && !matchedTokens.includes(ruleTokens[0])) return null;

  // ...and it must also match at least one model token, otherwise a rule like
  // "Audi RS and R8" or "BMW M derivatives" would fire on every Audi / BMW.
  if (ruleTokens.length > 1 && matchedTokens.length === 1) return null;


  const exact = matchedTokens.length === ruleTokens.length;
  const score = matchedTokens.length * 10 + (exact ? 5 : 0);
  return { floor, matchedTokens, score, exact };
}

/** All rules that match, most specific first. */
export function matchModelFloors<T extends MatchableFloor>(
  vehicleText: string,
  floors: T[]
): FloorMatch<T>[] {
  const tokens = vehicleTokens(vehicleText);
  if (tokens.length === 0) return [];
  return floors
    .map(floor => scoreFloor(tokens, floor))
    .filter((m): m is FloorMatch<T> => m !== null)
    .sort((a, b) => b.score - a.score);
}

/** The single rule that should apply, or null when nothing matches. */
export function matchModelFloor<T extends MatchableFloor>(
  vehicleText: string,
  floors: T[]
): FloorMatch<T> | null {
  const matches = matchModelFloors(vehicleText, floors);
  if (matches.length === 0) return null;
  // A "not covered" rule always wins over a priced floor at the same score.
  const top = matches[0];
  const blocking = matches.find(m => m.score === top.score && !m.floor.covered);
  return blocking || top;
}

/** Plain-English summary of what a match means, for admin UI. */
export function describeFloorMatch(match: FloorMatch | null): string {
  if (!match) return 'No rule matches — this vehicle gets the normal calculated price.';
  if (!match.floor.covered) {
    return `Matches “${match.floor.vehicle}” — ${match.floor.treatment.toLowerCase()}, so it shows the manual referral message instead of a price.`;
  }
  return `Matches “${match.floor.vehicle}” — priced at no less than £${match.floor.minOneYear} for one year.`;
}
