/**
 * Shared person-name rule for every customer name box on the site
 * (Step 2, Review & Pay, multi-warranty checkout, contact details, transfer).
 *
 * A name box only ever takes letters: digits and stray symbols are stripped as
 * the person types, the same way the mobile box only ever takes digits.
 * Apostrophes, hyphens, full stops and spaces stay in, so O'Brien,
 * Smith-Jones and J. R. Smith all still work.
 */

/** Names are never longer than this; anything typed past it is dropped. */
export const NAME_MAX_LENGTH = 60;

/** Shortest acceptable name — the same floor every name box already used. */
export const NAME_MIN_LENGTH = 2;

/** Letters (any alphabet, accents included), spaces, apostrophes, hyphens, full stops. */
const ALLOWED_NAME_CHARACTERS = /[^\p{L}\p{M}\s'’\-.]/gu;

/**
 * Strip anything that cannot belong in a name — digits, slashes, emoji,
 * angle brackets — so a name box can never hold "222".
 */
export function sanitizeNameInput(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const withoutForbidden = raw.replace(ALLOWED_NAME_CHARACTERS, '');
  const singleSpaced = withoutForbidden.replace(/\s+/g, ' ');
  return singleSpaced.slice(0, NAME_MAX_LENGTH);
}

/** A real name: at least two characters and at least one letter. */
export function isValidPersonName(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (trimmed.length < NAME_MIN_LENGTH) return false;
  return /\p{L}/u.test(trimmed);
}

/** One short wording for every name box that has no letters in it. */
export const NAME_HINT = 'Enter your name using letters only';
