import { describe, expect, it } from 'vitest';
import { firstNameLiveError, isValidFirstName } from '../firstNameRule';

describe('step 2 first-name live warning', () => {
  it('warns as soon as a one-letter name is typed', () => {
    expect(firstNameLiveError('t')).toBe('First name must be at least 2 characters');
    expect(firstNameLiveError(' t ')).toBe('First name must be at least 2 characters');
    expect(isValidFirstName('t')).toBe(false);
  });
  it('says nothing while the box is still empty', () => {
    expect(firstNameLiveError('')).toBe('');
    expect(firstNameLiveError('   ')).toBe('');
  });
  it('clears the warning once two real characters are there', () => {
    expect(firstNameLiveError('Jo')).toBe('');
    expect(firstNameLiveError('John')).toBe('');
    expect(isValidFirstName('Jo')).toBe(true);
    expect(isValidFirstName('John')).toBe(true);
  });
});
