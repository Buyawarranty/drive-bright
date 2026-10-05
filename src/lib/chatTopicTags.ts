/**
 * Works out, in plain words, what a website chat is about so staff can see at a
 * glance whether it is a sale, a claim, an existing customer or a general question.
 */
export type ChatTopicKey =
  | 'claim'
  | 'sale'
  | 'existing_customer'
  | 'cancellation'
  | 'complaint'
  | 'general';

export type ChatTopicTag = {
  key: ChatTopicKey;
  label: string;
  className: string;
};

const TAGS: Record<ChatTopicKey, ChatTopicTag> = {
  claim: {
    key: 'claim',
    label: 'Claim',
    className: 'bg-red-600 text-white border-red-700',
  },
  sale: {
    key: 'sale',
    label: 'Warranty purchase',
    className: 'bg-emerald-600 text-white border-emerald-700',
  },
  existing_customer: {
    key: 'existing_customer',
    label: 'Existing customer',
    className: 'bg-blue-600 text-white border-blue-700',
  },
  cancellation: {
    key: 'cancellation',
    label: 'Cancellation / refund',
    className: 'bg-orange-600 text-white border-orange-700',
  },
  complaint: {
    key: 'complaint',
    label: 'Complaint',
    className: 'bg-fuchsia-700 text-white border-fuchsia-800',
  },
  general: {
    key: 'general',
    label: 'General enquiry',
    className: 'bg-slate-600 text-white border-slate-700',
  },
};

export const chatTopicTag = (key: ChatTopicKey): ChatTopicTag => TAGS[key];

export const CHAT_TOPIC_ORDER: ChatTopicKey[] = [
  'claim',
  'sale',
  'existing_customer',
  'cancellation',
  'complaint',
  'general',
];

/** The query type the customer picked in the "Message me back" form, if any. */
const fromPickedTopic = (raw: string): ChatTopicKey | null => {
  const text = raw.toLowerCase();
  if (!text) return null;
  if (text.includes('claim') && !/claim\s*limit/.test(text) && (/^\W*(a\s+|existing\s+|new\s+|make\s+a\s+)?claims?\b/.test(text.trim()) || CLAIM_INTENT.some((re) => re.test(text)))) return 'claim';
  if (text.includes('warranty purchase') || text.includes('quote')) return 'sale';
  if (text.includes('existing policy') || text.includes('existing customer')) return 'existing_customer';
  if (text.includes('cancel') || text.includes('refund')) return 'cancellation';
  if (text.includes('complaint')) return 'complaint';
  if (text.includes('general')) return 'general';
  return null;
};

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

const CLAIM_INTENT: RegExp[] = [
  /\b(make|making|submit|submitting|start|starting|open|opening|raise|raising|log|logging|file|filing|put in|lodge)\s+(a\s+|an\s+|my\s+)?claim\b/,
  /\b(want|need|like|wish|going|trying|have)\s+to\s+claim\b/,
  /\bclaim\s+(for|on)\s+(my|the|a)\s+(car|vehicle|van|bike|motorbike|repair|gearbox|engine|clutch|turbo)\b/,
  /\bmy\s+(current\s+|open\s+|existing\s+)?claim\b/,
  /\bclaim\s+(number|reference|ref|status|update|form|was|has been|is)\b/,
  /\b(chase|chasing|update on|progress of|status of)\s+(a\s+|my\s+|the\s+)?claim\b/,
  /\bmy car (has |just )?(broken down|broke down)\b/,
  /\b(car|vehicle|van) (has |just )?(broken down|broke down)\b/,
];

/** True only when the text shows the customer wants to make or chase a claim. */
export const hasClaimIntent = (raw: string) => CLAIM_INTENT.some((re) => re.test((raw || '').toLowerCase()));

/**
 * @param customerText everything the customer typed in the chat
 * @param handoverHint the reason/notes saved when they asked to be called back
 */
export const classifyChatTopic = (customerText: string, handoverHint?: string | null): ChatTopicTag => {
  const picked = fromPickedTopic(handoverHint ?? '');
  if (picked) return TAGS[picked];

  const text = (customerText || '').toLowerCase();

  // "Claim" on its own usually means the claim limit / what a plan covers.
  // Only tag Claim when the customer clearly wants to make or chase a claim.
  if (CLAIM_INTENT.some((re) => re.test(text))) return TAGS.claim;
  if (has(text, ['cancel', 'refund', 'money back', 'stop my policy'])) return TAGS.cancellation;
  if (has(text, ['complaint', 'complain', 'ombudsman', 'unhappy', 'disgusted', 'appeal'])) return TAGS.complaint;
  if (has(text, ['my policy', 'my warranty', 'my cover', 'renew', 'renewal', 'i am a customer', 'existing customer', 'my documents', 'my certificate', 'change my', 'transfer'])) {
    return TAGS.existing_customer;
  }
  if (has(text, ['price', 'quote', 'cost', 'how much', 'buy', 'purchase', 'cover for my', 'plan', 'monthly', 'discount', 'sign up'])) {
    return TAGS.sale;
  }
  return TAGS.general;
};
