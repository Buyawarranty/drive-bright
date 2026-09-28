// Shared helpers for chat pop-ups and the chatbot queue:
// pick the customer's last real question and tag its topic.

export type ChatTopic = { label: string; className: string };

const TOPICS: { label: string; className: string; re: RegExp }[] = [
  { label: 'Complaint', className: 'bg-red-100 text-red-800 border-red-300', re: /complain|unhappy|disgust|rubbish|terrible|ombudsman|refund me/i },
  { label: 'Claim', className: 'bg-purple-100 text-purple-800 border-purple-300', re: /claim|broke ?down|breakdown|repair|garage|fault|warning light|gearbox|engine (?:light|fail)/i },
  { label: 'Cancellation', className: 'bg-rose-100 text-rose-800 border-rose-300', re: /cancel|refund|money back/i },
  { label: 'Payment', className: 'bg-amber-100 text-amber-900 border-amber-300', re: /pay(?:ment)?|card|direct debit|instal|bumper|charged|invoice/i },
  { label: 'Renewal', className: 'bg-teal-100 text-teal-800 border-teal-300', re: /renew|expir/i },
  { label: 'Account change', className: 'bg-slate-100 text-slate-700 border-slate-300', re: /change (?:my )?(?:address|email|phone|details|car|vehicle)|transfer|sold (?:my|the) car|login|password/i },
  { label: 'Sale / quote', className: 'bg-emerald-100 text-emerald-800 border-emerald-300', re: /quote|price|cost|how much|cover|warranty|buy|plan|excess|claim limit|£/i },
];

export const classifyChatTopic = (text: string): ChatTopic => {
  const t = text || '';
  for (const topic of TOPICS) if (topic.re.test(t)) return { label: topic.label, className: topic.className };
  return { label: 'General', className: 'bg-sky-100 text-sky-800 border-sky-300' };
};

// Messages that are only contact details / a reg / "yes" aren't questions.
const isContactOnly = (t: string) => {
  const stripped = t
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]{2,}/g, '')
    .replace(/(?:\+44|0)\s?\d[\d\s-]{8,13}/g, '')
    .replace(/\b[A-Z]{2}\d{2}\s?[A-Z]{3}\b/gi, '')
    .replace(/[^a-z]/gi, ' ')
    .trim();
  return stripped.split(/\s+/).filter((w) => w.length > 1).length < 3;
};

const firstSentence = (t: string, max = 140) => {
  const clean = t.replace(/\s+/g, ' ').trim();
  const m = clean.match(/^.*?[.?!](?=\s|$)/);
  const s = (m ? m[0] : clean);
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
};

/** Returns the last real customer question (one sentence) from newest-last texts. */
export const lastCustomerQuestion = (texts: string[]): string => {
  const real = texts.filter((t) => t && !isContactOnly(t));
  const pick = real.slice(-1)[0] || texts.filter(Boolean).slice(-1)[0] || '';
  // Prefer the sentence containing a question mark.
  const q = pick.split(/(?<=[.?!])\s+/).reverse().find((s) => s.includes('?'));
  return firstSentence(q || pick);
};

/** Topic from the whole conversation, weighted to the latest real question. */
export const topicForConversation = (texts: string[]): ChatTopic => {
  const last = lastCustomerQuestion(texts);
  const fromLast = classifyChatTopic(last);
  if (fromLast.label !== 'General') return fromLast;
  return classifyChatTopic(texts.join(' '));
};

export const textOfMessage = (m: { content: string | null; parts: any }) => {
  if (m.content && m.content.trim()) return m.content.trim();
  const parts = Array.isArray(m.parts) ? m.parts : [];
  return parts
    .filter((p: any) => p?.type === 'text' && typeof p.text === 'string')
    .map((p: any) => p.text.trim())
    .filter(Boolean)
    .join(' ');
};
