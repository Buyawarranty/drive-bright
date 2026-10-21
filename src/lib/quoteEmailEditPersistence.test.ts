import { describe, expect, it } from 'vitest';
import {
  normalizeSavedEmailEdit,
  serialiseEmailEditForStorage,
} from './quoteEmailEditPersistence';

describe('quote email edit persistence', () => {
  it('keeps the agent\'s saved wording after a JSON round-trip (reload/reopen)', () => {
    const edit = 'Hi Sarah,\n\nYour personalised quote is ready — wording edited by the agent.';
    const stored = serialiseEmailEditForStorage({}, edit);
    const restored = normalizeSavedEmailEdit(JSON.parse(JSON.stringify(stored)).copyEmailEdit);
    expect(restored).toBe(edit);
  });

  it('restores null for a saved quote without an edit', () => {
    const stored = serialiseEmailEditForStorage({ vehicleData: { regNumber: 'AB12 CDE' } }, null);
    expect(stored).not.toHaveProperty('copyEmailEdit');
    expect(normalizeSavedEmailEdit((stored as any).copyEmailEdit)).toBeNull();
  });

  it('treats blank or non-string stored edits as no edit', () => {
    expect(normalizeSavedEmailEdit('')).toBeNull();
    expect(normalizeSavedEmailEdit('   ')).toBeNull();
    expect(normalizeSavedEmailEdit(undefined)).toBeNull();
    expect(normalizeSavedEmailEdit(42)).toBeNull();
  });
});
