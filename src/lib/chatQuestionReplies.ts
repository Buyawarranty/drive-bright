export type QuestionMessage = { thread_id: string; role: string; content: string; created_at: string };

/** Match the question's own turn, never the thread's latest unrelated answer. */
export function questionReplies(threadId: string | null, question: string, askedAt: string, messages: QuestionMessage[]) {
  const ordered = messages.filter((m) => m.thread_id === threadId).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const at = Date.parse(askedAt);
  const exact = ordered.findLastIndex((m) => m.role === 'user' && m.content.trim() === question.trim() && Date.parse(m.created_at) <= at);
  const index = exact >= 0 ? exact : ordered.findLastIndex((m) => m.role === 'user' && Date.parse(m.created_at) <= at);
  if (index < 0) return [];
  const replies: QuestionMessage[] = [];
  for (const message of ordered.slice(index + 1)) {
    if (message.role === 'user') break;
    if (message.role === 'assistant' || message.role === 'agent') replies.push(message);
  }
  return replies;
}