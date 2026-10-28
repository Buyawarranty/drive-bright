/**
 * Shared first-name rule for the Step 2 quote form.
 *
 * The warning is shown while the person is still typing (the way the mobile
 * number box already behaves), so a one-letter name is not silently accepted.
 * An empty box stays quiet — that message only appears once they press the
 * button, so the form never shouts at somebody who has not started yet.
 *
 * The letters-only check itself lives in supabase/functions/_shared so the
 * browser forms and the submission function can never disagree about it.
 */

import {
  NAME_MIN_LENGTH,
  isValidPersonName,
  sanitizeNameInput,
} from '../../supabase/functions/_shared/ukPersonName';

export const FIRST_NAME_MIN_LENGTH = NAME_MIN_LENGTH;

/** Drop digits and stray symbols as the person types — names take letters only. */
export { sanitizeNameInput };

export const firstNameLiveError = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length < FIRST_NAME_MIN_LENGTH) return 'First name must be at least 2 characters';
  if (!isValidPersonName(trimmed)) return 'First name must use letters only';
  return '';
};

export const isValidFirstName = (value: string): boolean => isValidPersonName(value);
