/** Customer date-of-birth validation for the monthly (Bumper) checkout. */
export const MIN_CUSTOMER_AGE = 18;
export const MAX_CUSTOMER_AGE = 100;

export type DobParts = { day: string; month: string; year: string };

/** Returns an error message, or null when the date is a real date and the customer is 18–100. */
export function validateCustomerDob({ day, month, year }: DobParts, today: Date = new Date()): string | null {
  if (!day || !month || !year) return 'Please enter your full date of birth';
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) {
    return 'Please enter your date of birth as DD MM YYYY';
  }
  const d = Number(day), m = Number(month), y = Number(year);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return 'Please enter a real date';
  }
  let age = today.getUTCFullYear() - y;
  const beforeBirthday =
    today.getUTCMonth() < m - 1 || (today.getUTCMonth() === m - 1 && today.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  if (age < MIN_CUSTOMER_AGE) return 'You must be 18 or over to pay monthly';
  if (age > MAX_CUSTOMER_AGE) return 'Please check the year you were born';
  return null;
}

/** ISO YYYY-MM-DD, or null when incomplete/invalid. */
export function toIsoDob(parts: DobParts, today?: Date): string | null {
  if (validateCustomerDob(parts, today)) return null;
  return `${parts.year}-${parts.month.padStart(2, '0')}-${parts.day.padStart(2, '0')}`;
}
