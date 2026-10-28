/**
 * Shared person-name rule for every customer name box on the site
 * (Step 2, Review & Pay, multi-warranty checkout, contact details, transfer).
 *
 * A name box only ever takes letters: digits and stray symbols are stripped as
 * the person types, the same way the mobile box only ever takes digits.
 * Apostrophes, hyphens, full stops and spaces stay in, so O'Brien,
 * Smith-Jones and J. R. Smith all still work.
 */

/** Shortest acceptable name — the same floor every name box already used. */
export const NAME_MIN_LENGTH = 2;

/** Names are never longer than this; anything typed past it is dropped. */
export const NAME_MAX_LENGTH = 60;

/** Letters (any alphabet, accents included), apostrophes, hyphens, full stops. */
const NAME_CHARACTER = /[\p{L}\p{M}'’\-.]/u;

/** A space only stays when a real name character sits in front of it. */
const SPACE_CAN_FOLLOW = /[\p{L}\p{M}'’\-.]$/u;

/**
 * Strip anything that cannot belong in a name — digits, slashes, emoji,
 * angle brackets — so a name box can never hold "222". Spaces are kept while
 * somebody types ("John Smith") but an orphan left behind by stripped digits
 * is dropped, so "07960 123456" ends up empty rather than a stray gap.
 */
export function sanitizeNameInput(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let cleaned = '';
  for (const character of raw) {
    if (NAME_CHARACTER.test(character)) {
      cleaned += character;
    } else if (/\s/u.test(character) && SPACE_CAN_FOLLOW.test(cleaned)) {
      cleaned += ' ';
    }
  }
  return cleaned.slice(0, NAME_MAX_LENGTH);
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
