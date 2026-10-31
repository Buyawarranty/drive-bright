import { isValidCheckoutPhone, UK_PHONE_HINT } from './ukCheckoutPhone.ts';
import { isValidPersonName } from './ukPersonName.ts';

export function quoteCustomerFieldError(field: string, raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  switch (field) {
    case 'firstName':
    case 'lastName':
      if (!isValidPersonName(value) || value.length > 60 || !/^[\p{L}\p{M}'’\-.\s]+$/u.test(value))
        return `Please enter your ${field === 'firstName' ? 'first' : 'last'} name using letters.`;
      return null;
    case 'email':
      return value.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Please enter a valid email address.';
    case 'phone':
      return isValidCheckoutPhone(value) ? null : UK_PHONE_HINT;
    case 'addressLine1':
      return value && value.length <= 200 ? null : 'Please enter your address.';
    case 'city':
      return value && value.length <= 100 ? null : 'Enter your town or city.';
    case 'postcode':
      return /^[A-Z]{1,2}[0-9R][0-9A-Z]?\s?[0-9][A-Z]{2}$/i.test(value) ? null : 'Please enter a valid UK postcode.';
    case 'mileage':
      return /^\d+$/.test(value) && Number(value) >= 1000 && Number(value) <= 150000
        ? null : 'Please enter a mileage between 1,000 and 150,000.';
    default:
      return null;
  }
}

export function validateQuoteCustomer(data: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of ['email', 'phone', 'firstName', 'lastName', 'postcode', 'addressLine1', 'city', 'mileage']) {
    const error = quoteCustomerFieldError(field, data[field]);
    if (error) errors[field] = error;
  }
  return errors;
}