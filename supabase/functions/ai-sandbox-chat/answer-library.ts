/**
 * Approved answer library — the answers our managers write in the CRM
 * (Admin dashboard → Chatbot data → Answer library).
 *
 * Miles treats these as approved material: when a customer asks the same or a
 * similar question again, the wording a manager approved is reused instead of
 * the chatbot guessing or handing over. Nothing here is AI-invented; every
 * entry is written or approved by a person.
 */

export type LibraryRow = {
  id: string;
  question: string;
  answer: string;
  keywords: string[] | null;
};

const STOP = new Set([
  "the", "and", "for", "you", "your", "with", "what", "does", "have", "how",
  "are", "can", "our", "this", "that", "from", "will", "about", "when", "who",
  "any", "all", "not", "but", "was", "were", "has", "had", "would", "could",
  "there", "them", "they", "just", "like", "need", "want", "know", "please",
  "car", "vehicle", "warranty", "hello", "hey", "yes", "yeah", "get", "got",
]);

function tokens(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2 && !STOP.has(t)),
    ),
  ];
}

export type LibraryMatch = { row: LibraryRow; score: number };

/** Best approved answers for what the customer just asked. */
export function matchLibrary(question: string, rows: LibraryRow[], limit = 3): LibraryMatch[] {
  const asked = tokens(question);
  if (asked.length === 0 || rows.length === 0) return [];

  return rows
    .map((row) => {
      const bank = new Set([...tokens(row.question), ...(row.keywords ?? []).flatMap(tokens)]);
      if (bank.size === 0) return { row, score: 0 };
      const hits = asked.filter((t) => bank.has(t)).length;
      // How much of the question the stored entry explains, tempered by how
      // much of the stored entry the question actually touches.
      const score = (hits / asked.length) * 0.7 + (hits / bank.size) * 0.3;
      return { row, score };
    })
    .filter((m) => m.score >= 0.34)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** The block appended to Miles's instructions for this reply. */
export function libraryPromptBlock(matches: LibraryMatch[]): string {
  if (matches.length === 0) return "";
  const items = matches
    .map(
      (m, i) =>
        `${i + 1}. Customer question: "${m.row.question}"\n   Approved answer: ${m.row.answer}`,
    )
    .join("\n");
  return `\n\nAPPROVED ANSWER LIBRARY — written and approved by our own team for questions exactly like this one. Treat these as approved material, on the same footing as the plan documents:\n${items}\nUse the approved answer above for this question. Keep it in your own natural voice and within 1-3 short sentences, keep every fact, figure and timescale exactly as written, and never contradict it or add cover, prices or promises that are not in it. Because this is approved material, do NOT hand over to a specialist for this question.`;
}
