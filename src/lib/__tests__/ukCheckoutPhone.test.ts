import { describe, expect, it } from 'vitest';
import { isValidCheckoutPhone, normalizeCheckoutPhone } from '../../../supabase/functions/_shared/ukCheckoutPhone';

describe('checkout phone validation', () => {
  it('accepts the requested example and preserves its digits for payment', () => {
    expect(isValidCheckoutPhone('07960 123 456')).toBe(true);
    expect(normalizeCheckoutPhone('07960 123 456')).toBe('07960123456');
  });
  it('rejects a ten-digit mobile before payment', () => {
    expect(isValidCheckoutPhone('07960 12345')).toBe(false);
    expect(isValidCheckoutPhone('+44 7960 12345')).toBe(false);
  });
  it('accepts equivalent complete UK international formats', () => {
    for (const phone of ['+44 7960 123456', '0044 7960 123456', '447960123456']) {
      expect(isValidCheckoutPhone(phone)).toBe(true);
      expect(normalizeCheckoutPhone(phone)).toBe('07960123456');
    }
  });
  it('rejects empty, non-UK and malformed values', () => {
    for (const phone of ['', '   ', '+91 9876543210', 'phone07960123456', null]) {
      expect(isValidCheckoutPhone(phone)).toBe(false);
    }
  });
  it('rejects UK landlines and other non-mobile numbers — mobiles only', () => {
    for (const phone of ['020 7946 0958', '0161 496 0000', '08900000000', '0800 111 1111', '0345 600 0000']) {
      expect(isValidCheckoutPhone(phone)).toBe(false);
    }
  });
});
import { isValidUkMobile } from '../../../supabase/functions/_shared/ukCheckoutPhone';
describe('Step 2 mobile rule', () => {
  it('accepts only 11-digit 07 mobiles', () => {
    expect(isValidUkMobile('07960 123 456')).toBe(true);
    expect(isValidUkMobile('+44 7960 123456')).toBe(true);
    expect(isValidUkMobile('0790000000')).toBe(false);
    expect(isValidUkMobile('08900000000')).toBe(false);
    expect(isValidUkMobile('0890000000')).toBe(false);
    expect(isValidUkMobile('079601234567')).toBe(false);
  });
});
import { sanitizePhoneInput } from '../../../supabase/functions/_shared/ukCheckoutPhone';
describe('phone box typing rule', () => {
  it('never lets letters through', () => {
    expect(sanitizePhoneInput('wwwwww')).toBe('');
    expect(sanitizePhoneInput('abc07960def123456')).toBe('07960123456');
    expect(sanitizePhoneInput('ph07960 123 456')).toBe('07960 123 456');
  });
  it('keeps digits, single spaces and a leading plus', () => {
    expect(sanitizePhoneInput('07960 123 456')).toBe('07960 123 456');
    expect(sanitizePhoneInput('+44 7960 123456')).toBe('+44 7960 123456');
    expect(sanitizePhoneInput('07960  123   456')).toBe('07960 123 456');
  });
  it('drops stray punctuation and caps length', () => {
    expect(sanitizePhoneInput('07960-123-456')).toBe('07960123456');
    expect(sanitizePhoneInput('(079) 6012-3456')).toBe('079 60123456');
    expect(sanitizePhoneInput('0796012345678901234')).toBe('079601234567890');
  });
  it('only keeps a plus when it starts the number', () => {
    expect(sanitizePhoneInput('07960+123')).toBe('07960123');
    expect(sanitizePhoneInput(null)).toBe('');
  });
});
