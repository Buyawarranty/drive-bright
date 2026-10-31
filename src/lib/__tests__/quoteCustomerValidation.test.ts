import { describe, expect, it } from 'vitest';
import { quoteCustomerFieldError, validateQuoteCustomer } from '../../../supabase/functions/_shared/quoteCustomerValidation';

describe('emailed quote Step 4 validation parity', () => {
  it('accepts UK mobiles with spaces and international prefixes', () => {
    for (const phone of ['07960 123 456', '+44 7960123456', '07960123456']) {
      expect(quoteCustomerFieldError('phone', phone)).toBeNull();
    }
  });
  it('rejects landlines, short mobiles and letters', () => {
    for (const phone of ['03302295045', '07960', '07960abcdef']) {
      expect(quoteCustomerFieldError('phone', phone)).not.toBeNull();
    }
  });
  it('rejects placeholder and digit-only names', () => {
    for (const name of ['.', '123', 'J', 'James123']) {
      expect(quoteCustomerFieldError('lastName', name)).not.toBeNull();
    }
  });
  it('enforces the same mileage boundaries', () => {
    for (const mileage of ['0', '999', '150001', 'invalid']) {
      expect(quoteCustomerFieldError('mileage', mileage)).not.toBeNull();
    }
    expect(quoteCustomerFieldError('mileage', '150000')).toBeNull();
  });
  it('requires every personal and address field before payment', () => {
    expect(Object.keys(validateQuoteCustomer({}))).toHaveLength(8);
  });
});