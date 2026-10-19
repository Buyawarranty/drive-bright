import { describe, expect, it } from 'vitest';
import { questionReplies } from './chatQuestionReplies';

describe('question replies', () => {
  const messages = [
    { thread_id: 'a', role: 'user', content: 'When does cover expire?', created_at: '2026-10-19T07:00:00Z' },
    { thread_id: 'a', role: 'assistant', content: 'Please check your policy dates.', created_at: '2026-10-19T07:00:03Z' },
    { thread_id: 'a', role: 'agent', content: 'We can check that for you.', created_at: '2026-10-19T07:00:05Z' },
    { thread_id: 'a', role: 'user', content: 'How much is cover?', created_at: '2026-10-19T07:01:00Z' },
    { thread_id: 'a', role: 'assistant', content: 'A different answer.', created_at: '2026-10-19T07:01:03Z' },
  ];
  it('shows what we said to that question, not a later answer', () => {
    expect(questionReplies('a', 'When does cover expire?', '2026-10-19T07:00:02Z', messages).map((m) => m.content)).toEqual(['Please check your policy dates.', 'We can check that for you.']);
  });
  it('does not invent a reply when the customer turn is missing', () => {
    expect(questionReplies('b', 'When does cover expire?', '2026-10-19T07:00:02Z', messages)).toEqual([]);
  });
});