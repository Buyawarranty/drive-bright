import chunks from "./site-knowledge.json" with { type: "json" };

export type KnowledgeChunk = { source: string; section: string; text: string };

const KB = chunks as KnowledgeChunk[];

const STOP = new Set([
  "the", "and", "for", "you", "your", "with", "what", "does", "have", "how",
  "are", "can", "our", "this", "that", "from", "will", "about", "when", "who",
  "any", "all", "not", "but", "his", "her", "its", "was", "were", "has",
]);

function tokens(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9£\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

export function searchKnowledge(query: string, limit = 4): KnowledgeChunk[] {
  const terms = tokens(query);
  if (!terms.length) return KB.slice(0, limit);

  const scored = KB.map((chunk) => {
    const haystack = `${chunk.section}\n${chunk.text}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      const hits = haystack.split(term).length - 1;
      if (hits > 0) score += 1 + Math.min(hits, 5) * 0.4;
    }
    return { chunk, score };
  })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => s.chunk);
}

export const knowledgeSources = [...new Set(KB.map((c) => c.source))];
