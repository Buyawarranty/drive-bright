import { describe, expect, it } from 'vitest';
import { firstNameLiveError, isValidFirstName, sanitizeNameInput } from '../firstNameRule';
import { isValidPersonName } from '../../../supabase/functions/_shared/ukPersonName';

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

describe('name boxes never take digits', () => {
  it('turns a digits-only entry into an empty box', () => {
    expect(sanitizeNameInput('222')).toBe('');
    expect(sanitizeNameInput('07960 123456')).toBe('');
    expect(isValidPersonName('222')).toBe(false);
    expect(isValidFirstName('222')).toBe(false);
  });
  it('warns when a saved name has no letters in it', () => {
    expect(firstNameLiveError('222')).toBe('First name must use letters only');
  });
  it('keeps the letters and drops the digits from a mixed entry', () => {
    expect(sanitizeNameInput('Jo2')).toBe('Jo');
    expect(sanitizeNameInput('J0hn Sm1th')).toBe('John Smith');
  });
  it('keeps the punctuation and accents real names use', () => {
    expect(sanitizeNameInput("O'Brien")).toBe("O'Brien");
    expect(sanitizeNameInput('Smith-Jones')).toBe('Smith-Jones');
    expect(sanitizeNameInput('Renée')).toBe('Renée');
    expect(sanitizeNameInput('J. R. Smith')).toBe('J. R. Smith');
    expect(sanitizeNameInput('John   Smith')).toBe('John Smith');
    expect(isValidPersonName("O'Brien")).toBe(true);
    expect(isValidPersonName('Smith-Jones')).toBe(true);
  });
  it('stops a name growing past a sane length', () => {
    expect(sanitizeNameInput('a'.repeat(200))).toHaveLength(60);
  });
  it('refuses anything with no letters, however long', () => {
    expect(isValidPersonName('---')).toBe(false);
    expect(isValidPersonName('..')).toBe(false);
    expect(isValidPersonName('1')).toBe(false);
    expect(isValidPersonName(undefined)).toBe(false);
  });
});
