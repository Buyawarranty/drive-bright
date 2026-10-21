// Review & send quote — persistence rules for the agent's edited email wording.
//
// Rules (from the business):
// 1. Once an agent presses "Save email", the edited wording must survive a page
//    reload and reopening the saved quote.
// 2. Starting a brand-new quote must never inherit the previous customer's
//    edited wording.

/**
 * Turn a stored email-edit value (from a draft or a saved quote) back into
 * either the saved wording or null ("use the generated text").
 * Anything that is not a non-empty string is treated as no edit.
 */
export function normalizeSavedEmailEdit(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/**
 * Serialise an email edit for storage (draft object or saved-quote record).
 * When there is no edit the key is omitted entirely so a fresh quote or a
 * saved quote without an edit can never inherit stale wording.
 */
export function serialiseEmailEditForStorage(
  payload: Record<string, unknown>,
  edit: string | null,
): Record<string, unknown> {
  if (edit === null) {
    const { copyEmailEdit: _omit, ...rest } = payload;
    return rest;
  }
  return { ...payload, copyEmailEdit: edit };
}
