export type AssistantThread = { id: string; title: string; updated_at: string; archived_at: string | null };

export function conversationList(threads: AssistantThread[], history: boolean) {
  return threads.filter(thread => Boolean(thread.archived_at) === history)
    .sort((a, b) => Date.parse(b.archived_at || b.updated_at) - Date.parse(a.archived_at || a.updated_at));
}

export const DAILY_SEO_QUESTION = 'Give me today’s SEO recommendations using the latest available saved website and Google evidence. State the evidence dates and gaps; do not imply a fresh scan. List priorities, who acts next and the smallest safe improvements, protecting pages that already rank well. Do not implement or publish anything.';