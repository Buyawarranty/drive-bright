export const UK_PHONE_EXAMPLE = '07960 123 456';

/** One short wording for every phone field: UK mobile, with the example. */
export const UK_PHONE_HINT = `Enter a UK mobile number, e.g. ${UK_PHONE_EXAMPLE}`;

export function normalizeCheckoutPhone(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > 40 || !/^[+\d\s().-]+$/.test(raw.trim())) return '';
  let value = raw.trim().replace(/[\s().-]/g, '');
  if (value.startsWith('+44')) value = '0' + value.slice(3);
  else if (value.startsWith('0044')) value = '0' + value.slice(4);
  else if (value.startsWith('44') && value.length === 12) value = '0' + value.slice(2);
  if (/^[1-9]\d{9}$/.test(value)) value = '0' + value;
  return value;
}

/** UK mobile only — 07 followed by 9 digits (11 total), as Bumper expects. */
export function isValidUkMobile(raw: unknown): boolean {
  return /^07\d{9}$/.test(normalizeCheckoutPhone(raw));
}

/** Every phone field asks for a UK mobile only; landlines are not accepted anywhere. */
export function isValidCheckoutPhone(raw: unknown): boolean {
  return isValidUkMobile(raw);
}
