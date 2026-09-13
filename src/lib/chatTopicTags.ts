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
  if (text.includes('claim')) return 'claim';
  if (text.includes('warranty purchase') || text.includes('quote')) return 'sale';
  if (text.includes('existing policy') || text.includes('existing customer')) return 'existing_customer';
  if (text.includes('cancel') || text.includes('refund')) return 'cancellation';
  if (text.includes('complaint')) return 'complaint';
  if (text.includes('general')) return 'general';
  return null;
};

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

/**
 * @param customerText everything the customer typed in the chat
 * @param handoverHint the reason/notes saved when they asked to be called back
 */
export const classifyChatTopic = (customerText: string, handoverHint?: string | null): ChatTopicTag => {
  const picked = fromPickedTopic(handoverHint ?? '');
  if (picked) return TAGS[picked];

  const text = (customerText || '').toLowerCase();

  if (has(text, ['claim', 'broken down', 'broke down', 'repair', 'garage', 'fault', 'gearbox', 'clutch', 'engine light', 'turbo', 'warning light'])) {
    return TAGS.claim;
  }
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
