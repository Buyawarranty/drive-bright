import chunks from "./site-knowledge.json" with { type: "json" };

export type KnowledgeChunk = { source: string; section: string; text: string };
export type ScoredChunk = KnowledgeChunk & { score: number; matched: string[] };

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

// Inverse document frequency: a word that appears in most of the approved
// material (e.g. "cover", "warranty") proves nothing about whether the
// question is actually answered, so it must not create false confidence.
const DF = new Map<string, number>();
function idf(term: string): number {
  let df = DF.get(term);
  if (df === undefined) {
    df = KB.filter((c) => `${c.section}\n${c.text}`.toLowerCase().includes(term)).length;
    DF.set(term, df);
  }
  // A word that appears nowhere in the approved material is maximally
  // distinctive: it must count against confidence, never be ignored.
  if (df === 0) return Math.log(KB.length);
  return Math.max(0, Math.log(KB.length / df));
}

function scoreAll(query: string): ScoredChunk[] {
  const terms = tokens(query);
  if (!terms.length) return [];

  return KB.map((chunk) => {
    const haystack = `${chunk.section}\n${chunk.text}`.toLowerCase();
    let score = 0;
    const matched: string[] = [];
    for (const term of terms) {
      const hits = haystack.split(term).length - 1;
      const weight = idf(term);
      if (hits > 0 && weight > 0.15) {
        score += (1 + Math.min(hits, 5) * 0.4) * weight;
        matched.push(term);
      }
    }
    // Reward passages that cover more of the distinctive words in the question.
    const distinctive = terms.filter((t) => idf(t) > 0.15);
    const coverage = distinctive.length ? matched.length / distinctive.length : 0;
    return { ...chunk, score: score * (0.4 + coverage), matched };
  })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Backwards-compatible simple search. */
export function searchKnowledge(query: string, limit = 4): KnowledgeChunk[] {
  return scoreAll(query).slice(0, limit);
}

/**
 * Grounded retrieval. Returns the best approved passages plus an explicit
 * confidence verdict so the assistant can refuse to answer rather than guess
 * about cover, exclusions, limits or contractual terms.
 */
export function retrieveGrounded(query: string, limit = 5) {
  const terms = tokens(query).filter((t) => idf(t) > 0.15);
  const scored = scoreAll(query);
  const top = scored.slice(0, limit);
  const best = top[0]?.score ?? 0;
  // Question words actually found anywhere in the approved material.
  const covered = new Set(top.flatMap((c) => c.matched));
  const coverage = terms.length ? covered.size / terms.length : 0;

  const confident = best >= 1.6 && coverage >= 0.5 && top.length > 0;

  return {
    confident,
    confidence: Number(best.toFixed(2)),
    coverage: Number(coverage.toFixed(2)),
    found: top.length,
    unmatched_terms: terms.filter((t) => !covered.has(t)),
    passages: top.map((c) => ({
      source: c.source,
      section: c.section,
      text: c.text,
      relevance: Number(c.score.toFixed(2)),
    })),
    instruction: confident
      ? "Answer ONLY from these approved passages. Do not add cover, limits, exclusions or terms that are not written above. If the passages do not actually answer the question, treat it as not confident."
      : "NOT GROUNDED: the approved website, product and terms material does not clearly answer this. Do NOT guess or generalise about cover, exclusions, limits or contractual terms. Say plainly that you want to get it confirmed, then offer to connect a warranty specialist (check_availability first) or take their details for a callback.",
  };
}

export const knowledgeSources = [...new Set(KB.map((c) => c.source))];
