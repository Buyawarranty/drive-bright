import { describe, expect, it } from 'vitest';
import { careerContactError } from '../../supabase/functions/_shared/careerApplicationRules';
const valid = { email: 'applicant@example.com', phone: '07700900123', warrantySalesExperience: true };
describe('Careers required application details', () => {
  it('requires email', () => {
    expect(careerContactError({ ...valid, email: ' ' })).toBe('Please enter your email address');
    expect(careerContactError(valid)).toBeNull();
  });
  it('requires phone', () => {
    expect(careerContactError({ ...valid, phone: '' })).toBe('Please enter your phone number');
    expect(careerContactError(valid)).toBeNull();
  });
  it('requires explicit vehicle warranty sales confirmation', () => {
    expect(careerContactError({ ...valid, warrantySalesExperience: false })).toBe('Please confirm you have experience of selling vehicle warranties');
    expect(careerContactError({ email: valid.email, phone: valid.phone })).toBe('Please confirm you have experience of selling vehicle warranties');
    expect(careerContactError(valid)).toBeNull();
  });
});
