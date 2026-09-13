/** Slash-command template replies for the WhatsApp agent composer. */
export interface QuickReply {
  /** Slash command, without the leading slash. */
  command: string;
  label: string;
  body: string;
}

export const WHATSAPP_QUICK_REPLIES: QuickReply[] = [
  {
    command: 'hi',
    label: 'Greeting',
    body: "Hi, thanks for getting in touch with Buy A Warranty. I'm here to help - what can I do for you today?",
  },
  {
    command: 'quote',
    label: 'Send a quote',
    body: "Happy to sort a quote for you. Could you send me your vehicle registration and current mileage and I'll come straight back with the price?",
  },
  {
    command: 'reg',
    label: 'Ask for registration',
    body: "Could you send me your vehicle registration please? That's all I need to check your cover options.",
  },
  {
    command: 'cover',
    label: 'What is covered',
    body: 'Our comprehensive cover includes engine, gearbox, clutch, electrics, suspension, steering, braking, fuel and cooling systems, plus labour at your chosen rate. Cover starts as soon as you buy, with the first claim available after 14 days.',
  },
  {
    command: 'start',
    label: 'When cover starts',
    body: 'Your cover starts immediately once payment is made, and your first claim can be made 14 days later.',
  },
  {
    command: 'pay',
    label: 'Ways to pay',
    body: 'You can pay monthly by instalments or in one payment for the full term - both give you exactly the same cover. Would you like me to send the payment link?',
  },
  {
    command: 'link',
    label: 'Send checkout link',
    body: "Here's your link to complete your warranty: https://buyawarranty.co.uk - any trouble at all, just message me here.",
  },
  {
    command: 'claim',
    label: 'How to claim',
    body: 'To start a claim, please visit buyawarranty.co.uk/make-a-claim/ or call our claims team on 0330 229 5045 (Mon-Fri, 9am-5pm). You can also email claims@buyawarranty.co.uk.',
  },
  {
    command: 'garage',
    label: 'Choice of garage',
    body: 'You can use any VAT-registered garage or main dealer in the UK - we settle the repair with them directly once the claim is approved.',
  },
  {
    command: 'docs',
    label: 'Documents sent',
    body: "I've emailed your warranty documents over - please check your inbox (and your junk folder just in case). Let me know once you have them.",
  },
  {
    command: 'renew',
    label: 'Renewal',
    body: "Your warranty is coming up for renewal and I can keep you covered with no break in protection. Would you like me to send your renewal price?",
  },
  {
    command: 'callback',
    label: 'Offer a call',
    body: 'Would you like a quick call to go through it? Let me know a time that suits and I will ring you.',
  },
  {
    command: 'busy',
    label: 'Will come back',
    body: "Thanks for your patience - I'm just checking this for you and will come straight back to you.",
  },
  {
    command: 'thanks',
    label: 'Thanks / close',
    body: "Thanks very much for your time today. If anything else comes up, just message me here and I'll help.",
  },
  {
    command: 'hours',
    label: 'Opening hours',
    body: 'Our team is available Monday to Friday, 9am to 5pm. Message us any time and we will reply as soon as we are back.',
  },
];

/** Matches replies for the text typed after a leading slash. */
export function matchQuickReplies(query: string): QuickReply[] {
  const q = query.trim().toLowerCase();
  if (!q) return WHATSAPP_QUICK_REPLIES;
  return WHATSAPP_QUICK_REPLIES.filter(
    (r) => r.command.includes(q) || r.label.toLowerCase().includes(q) || r.body.toLowerCase().includes(q),
  );
}

/** True when the draft is a slash lookup (a single `/word` with no spaces yet). */
export function slashQuery(draft: string): string | null {
  if (!draft.startsWith('/')) return null;
  const rest = draft.slice(1);
  if (rest.includes('\n')) return null;
  return rest;
}
