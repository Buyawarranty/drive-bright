import { describe, expect, it } from 'vitest';
import { conversationList } from './assistantConversationHistory';

const threads = [
  { id: 'older', title: 'Older active', updated_at: '2026-10-19T12:00:00Z', archived_at: null },
  { id: 'archived', title: 'Saved question', updated_at: '2026-10-18T12:00:00Z', archived_at: '2026-10-20T14:00:00Z' },
  { id: 'newer', title: 'New active', updated_at: '2026-10-20T12:00:00Z', archived_at: null },
];
describe('Conversation archive and history', () => {
  it('hides archived conversations from active list and puts newest first', () => {
    expect(conversationList(threads, false).map(t => t.id)).toEqual(['newer', 'older']);
  });
  it('retains archived conversations in readable history', () => {
    expect(conversationList(threads, true).map(t => t.id)).toEqual(['archived']);
  });
  it('restoring a conversation returns it to active and removes it from history', () => {
    const restored = threads.map(t => t.id === 'archived' ? { ...t, archived_at: null } : t);
    expect(conversationList(restored, false).map(t => t.id)).toContain('archived');
    expect(conversationList(restored, true)).toEqual([]);
  });
});