import { describe, expect, it } from 'vitest';
import { DEFAULT_CAREER_REJECTION_DAYS, canDelayApplication, validCareerDelay } from './careerRules';

describe('Careers rejection rules', () => {
  it('defaults to five days instead of three', () => {
    expect(DEFAULT_CAREER_REJECTION_DAYS).toBe(5);
  });
  it('accepts an editable whole-day delay', () => {
    expect(validCareerDelay(5)).toBe(true);
    expect(validCareerDelay(10)).toBe(true);
    expect(validCareerDelay(0)).toBe(false);
    expect(validCareerDelay(3.5)).toBe(false);
    expect(validCareerDelay(91)).toBe(false);
  });
  it('can resume No action with a future rejection deadline', () => {
    expect(canDelayApplication({ status: 'on_hold', rejection_sent_at: null })).toBe(true);
  });
  it('does not delay an already emailed rejection or accepted applicant', () => {
    expect(canDelayApplication({ status: 'rejected', rejection_sent_at: '2026-10-16T09:00:00Z' })).toBe(false);
    expect(canDelayApplication({ status: 'hired', rejection_sent_at: null })).toBe(false);
    expect(canDelayApplication({ status: 'new', rejection_sent_at: '2026-10-16T09:00:00Z' })).toBe(false);
  });
});