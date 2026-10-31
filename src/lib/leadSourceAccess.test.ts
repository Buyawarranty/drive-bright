import { describe, expect, it } from 'vitest';
import { canDisplayLeadSource } from './leadSourceAccess';

describe('Lead source permission', () => {
  it('shows sources when the protected permission is on', () => {
    expect(canDisplayLeadSource(true)).toBe(true);
  });
  it('hides sources when the protected permission is off', () => {
    expect(canDisplayLeadSource(false)).toBe(false);
  });
});