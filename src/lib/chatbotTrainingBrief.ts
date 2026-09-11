/**
 * Builds a plain-text / markdown "training brief" from chatbot activity that can be
 * pasted straight back into Lovable so Miles' approved answers can be improved.
 */

export type BriefEvent = {
  id: string;
  thread_id: string | null;
  event_type: string;
  topic: string | null;
  detail: string | null;
  customer_wording: string | null;
  registration: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  quoted_price: number | null;
  term_months: number | null;
  knowledge_confident: boolean | null;
  created_at: string;
};

const ukTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London' });
  } catch {
    return iso;
  }
};

const clean = (v: string | null | undefined) => (v ?? '').replace(/\s+/g, ' ').trim();

function tally<T>(items: T[], key: (item: T) => string | null): [string, number][] {
  const map = new Map<string, number>();
  items.forEach((item) => {
    const k = key(item);
    if (!k) return;
    map.set(k, (map.get(k) ?? 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export function buildChatbotTrainingBrief(
  events: BriefEvent[],
  opts: { rangeLabel?: string; maxQuestions?: number; maxConversations?: number } = {},
): string {
  const maxQuestions = opts.maxQuestions ?? 60;
  const maxConversations = opts.maxConversations ?? 25;

  const threads = new Set(events.map((e) => e.thread_id).filter(Boolean));
  const questions = events.filter((e) => e.event_type === 'question');
  const gaps = questions.filter((e) => e.knowledge_confident === false);
  const handovers = events.filter((e) => e.event_type === 'handover');
  const prices = events.filter((e) => e.event_type === 'price_quoted' && e.quoted_price);
  const avgPrice = prices.length
    ? Math.round(prices.reduce((a, e) => a + Number(e.quoted_price ?? 0), 0) / prices.length)
    : null;

  const lines: string[] = [];

  lines.push('# Miles chatbot — training brief for Lovable');
  lines.push('');
  lines.push(`Generated: ${ukTime(new Date().toISOString())} (UK time)`);
  if (opts.rangeLabel) lines.push(`Date range: ${opts.rangeLabel}`);
  lines.push('Chatbot page: /used-car-warranty-uk/ (Miles must stay on this page only)');
  lines.push('');
  lines.push('## What I want you to do');
  lines.push('');
  lines.push('1. Read the questions below, especially the ones marked NOT IN APPROVED MATERIAL.');
  lines.push('2. For each one, add an approved answer rule to the chatbot so Miles answers it directly instead of handing over.');
  lines.push('3. Keep answers to 3 sentences maximum, friendly, UK wording, no internal reasoning.');
  lines.push('4. Only use approved material (Platinum Plan v3.7, T&Cs v3.7, step 3 cover options and answers already approved by us).');
  lines.push('5. If a question genuinely needs a decision from us, list it back to me instead of guessing.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Conversations: ${threads.size}`);
  lines.push(`- Customer messages: ${events.filter((e) => e.event_type === 'customer_message').length}`);
  lines.push(`- Questions asked: ${questions.length}`);
  lines.push(`- Questions not covered by approved material: ${gaps.length}`);
  lines.push(`- Asked for a human: ${handovers.length}`);
  lines.push(`- Prices quoted: ${prices.length}${avgPrice ? ` (average £${avgPrice})` : ''}`);
  lines.push(`- Leads captured: ${events.filter((e) => e.event_type === 'lead_captured').length}`);
  lines.push('');

  if (gaps.length) {
    lines.push('## Questions NOT IN APPROVED MATERIAL (fix these first)');
    lines.push('');
    gaps.slice(0, maxQuestions).forEach((e, i) => {
      lines.push(`${i + 1}. "${clean(e.customer_wording) || clean(e.topic) || 'Unknown wording'}"`);
      const meta = [
        e.topic ? `topic: ${clean(e.topic)}` : null,
        e.registration ? `reg: ${e.registration}` : null,
        [e.vehicle_make, e.vehicle_model].filter(Boolean).length
          ? `vehicle: ${[e.vehicle_make, e.vehicle_model].filter(Boolean).join(' ')}`
          : null,
        `asked: ${ukTime(e.created_at)}`,
      ].filter(Boolean);
      lines.push(`   - ${meta.join(' · ')}`);
      lines.push('   - Approved answer to write: ');
    });
    lines.push('');
  }

  const answered = questions.filter((e) => e.knowledge_confident !== false);
  if (answered.length) {
    lines.push('## Questions Miles answered (check the wording is still right)');
    lines.push('');
    answered.slice(0, maxQuestions).forEach((e, i) => {
      lines.push(`${i + 1}. "${clean(e.customer_wording) || clean(e.topic)}"`);
    });
    lines.push('');
  }

  const topics = tally(questions, (e) => (e.topic ? clean(e.topic).toLowerCase() : null));
  if (topics.length) {
    lines.push('## Most asked topics');
    lines.push('');
    topics.slice(0, 20).forEach(([t, n]) => lines.push(`- ${t} — ${n}`));
    lines.push('');
  }

  const vehicles = tally(
    events.filter((e) => e.event_type === 'vehicle_interest'),
    (e) => [e.vehicle_make, e.vehicle_model].filter(Boolean).join(' ') || e.registration || null,
  );
  if (vehicles.length) {
    lines.push('## Vehicles customers looked up');
    lines.push('');
    vehicles.slice(0, 20).forEach(([v, n]) => lines.push(`- ${v} — ${n}`));
    lines.push('');
  }

  if (handovers.length) {
    lines.push('## Why Miles handed over to a person');
    lines.push('');
    handovers.slice(0, 30).forEach((e) => {
      lines.push(`- "${clean(e.customer_wording) || clean(e.detail) || clean(e.topic) || 'No wording captured'}" (${ukTime(e.created_at)})`);
    });
    lines.push('');
  }

  // Conversation transcripts, newest first, so the wording and flow can be reviewed.
  const byThread = new Map<string, BriefEvent[]>();
  events.forEach((e) => {
    if (!e.thread_id) return;
    const arr = byThread.get(e.thread_id) ?? [];
    arr.push(e);
    byThread.set(e.thread_id, arr);
  });
  const threadList = [...byThread.entries()]
    .map(([id, evs]) => ({
      id,
      evs: [...evs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    }))
    .sort(
      (a, b) =>
        new Date(b.evs[b.evs.length - 1].created_at).getTime() -
        new Date(a.evs[a.evs.length - 1].created_at).getTime(),
    )
    .slice(0, maxConversations);

  if (threadList.length) {
    lines.push('## Conversations (newest first)');
    lines.push('');
    threadList.forEach(({ id, evs }, idx) => {
      lines.push(`### Conversation ${idx + 1} — started ${ukTime(evs[0].created_at)}`);
      lines.push(`Thread: ${id}`);
      evs.forEach((e) => {
        const label = e.event_type === 'customer_message' ? 'Customer' : e.event_type;
        const body =
          clean(e.customer_wording) ||
          clean(e.detail) ||
          clean(e.topic) ||
          (e.quoted_price ? `£${e.quoted_price}${e.term_months ? ` over ${e.term_months} months` : ''}` : '');
        if (!body) return;
        const flag = e.event_type === 'question' && e.knowledge_confident === false ? ' [NOT IN APPROVED MATERIAL]' : '';
        lines.push(`- ${label}: ${body}${flag}`);
      });
      lines.push('');
    });
  }

  return lines.join('\n');
}
