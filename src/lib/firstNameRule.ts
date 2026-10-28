/**
 * Shared first-name rule for the Step 2 quote form.
 *
 * The warning is shown while the person is still typing (the way the mobile
 * number box already behaves), so a one-letter name is not silently accepted.
 * An empty box stays quiet — that message only appears once they press the
 * button, so the form never shouts at somebody who has not started yet.
 */

export const FIRST_NAME_MIN_LENGTH = 2;

export const firstNameLiveError = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.length < FIRST_NAME_MIN_LENGTH) return 'First name must be at least 2 characters';
  return '';
};

export const isValidFirstName = (value: string): boolean =>
  value.trim().length >= FIRST_NAME_MIN_LENGTH;
