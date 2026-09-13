import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import {
  Headset,
  PhoneCall,
  Clock,
  ShieldCheck,
  CalendarDays,
  UserRound,
  FileText,
  Lock,
  ArrowRight,
  ChevronRight,
  CheckCheck,
  X,
  Smile,
  Paperclip,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { loadGuestMessages, saveGuestMessages } from '@/components/ai-sandbox/guestChatStore';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { VoiceDictateButton } from './VoiceDictateButton';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
} from '@/components/ai-elements/prompt-input';
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from '@/components/ai-elements/tool';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import milesAvatar from '@/assets/miles-avatar.png.asset.json';
import milesCalls from '@/assets/miles-calls.png.asset.json';
import { isTeamOpenNow, openingHoursLabel, nextOpeningLabel } from '@/lib/aiSandbox/openingHours';
import { useSandboxSpecialistPresence } from '@/hooks/useSandboxSpecialistPresence';
import { useSalesLineAvailable } from '@/hooks/useSalesLineAvailable';
import { CallMeBackPanel } from '@/components/ai-sandbox/CallMeBackPanel';
import {
  prepareAttachment,
  CHAT_EMOJIS,
  MAX_ATTACHMENTS,
  type ChatAttachment,
} from '@/components/ai-sandbox/chatAttachments';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';


const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-sandbox-chat`;

const AGENT_PREFIX = '(Warranty specialist)';
const CONTACT_CARD_MARKER = '[[CONTACT_CARD]]';
const HUMAN_INTENT = /\b(speak|talk|chat)\b[^.!?]{0,30}\b(human|agent|person|someone|advisor|specialist)\b|\blive agent\b|\breal person\b|\bsomeone real\b|\ba human\b|\bhuman please\b/i;

// Pulls a short trailing question off the end of a reply so it can be
// highlighted separately from the guidance above it.
const splitTrailingQuestion = (text: string): { body: string; question: string } => {
  const trimmed = text.trimEnd();
  const idx = trimmed.lastIndexOf('\n\n');
  if (idx === -1) return { body: trimmed, question: '' };
  const tail = trimmed.slice(idx + 2).trim();
  const isPlainQuestion =
    tail.endsWith('?') && tail.length <= 200 && !/^[-*#>\d]/.test(tail);
  if (!isPlainQuestion) return { body: trimmed, question: '' };
  return { body: trimmed.slice(0, idx).trimEnd(), question: tail };
};

// Keeps every markdown element (headings, list items, paragraphs, bold) at one

// consistent chat body size so replies don't render at mixed font sizes.
const CHAT_TEXT = [
  'text-base leading-relaxed',
  '[&_p]:text-base [&_p]:leading-relaxed [&_p]:my-2',
  '[&_li]:text-base [&_li]:leading-relaxed',
  '[&_ul]:my-2 [&_ol]:my-2 [&_ul]:pl-5 [&_ol]:pl-5',
  '[&_h1]:text-base [&_h2]:text-base [&_h3]:text-base [&_h4]:text-base [&_h5]:text-base [&_h6]:text-base',
  '[&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h4]:font-semibold',
  '[&_h1]:my-2 [&_h2]:my-2 [&_h3]:my-2 [&_h4]:my-2',
  '[&_strong]:font-semibold [&_a]:underline',
].join(' ');

const OPENING_LINE = [

  "Hi, I'm Miles. How can I help?",
  '',
  'I can get you a quote, check what\'s covered, or help with a claim.',
].join('\n');


const STARTERS: Array<{ text: string; Icon: LucideIcon }> = [
  { text: 'Get my price', Icon: CalendarDays },
  { text: "Check what's covered", Icon: ShieldCheck },
  { text: 'Make a claim', Icon: FileText },
  { text: 'Speak to someone', Icon: UserRound },
];



type Handover = {
  id: string;
  kind: string;
  status: string;
  reason: string | null;
  customer_name: string | null;
  cover_summary: string | null;
  quoted_price: number | null;
  created_at: string;
};

type Sender = 'ai' | 'agent' | 'customer';

function senderOf(message: UIMessage): Sender {
  if (message.role === 'user') return 'customer';
  const meta = message.metadata as { sender?: Sender } | undefined;
  if (meta?.sender === 'agent') return 'agent';
  const firstText = message.parts.find((p) => p.type === 'text') as { text?: string } | undefined;
  if (firstText?.text?.startsWith(AGENT_PREFIX)) return 'agent';
  return 'ai';
}

// Internal working-out sometimes leaks into the visible answer (a stray
// "thought" label, references to the system prompt or tool names). Customers
// must never read that, so scrub it before rendering.
const INTERNAL_LINE = /(system prompt|confident:\s*(true|false)|approved material|i must not|let'?s call\s+\w+|check_availability|get_indicative_price|lookup_vehicle|tool call|function call)/i;

function sanitizeForCustomer(text: string) {
  let out = text.replace(/^\s*(thought|thinking|reasoning)\b[:\-–—]?\s*/i, '');
  const kept = out
    .split(/\n{2,}/)
    .filter((block) => !INTERNAL_LINE.test(block));
  out = (kept.length ? kept : out.split(/\n{2,}/)).join('\n\n');
  return out.trim();
}

function stripPrefix(text: string) {
  return text.startsWith(AGENT_PREFIX) ? text.slice(AGENT_PREFIX.length).trim() : text;
}



function rowsToUIMessages(
  rows: Array<{ id: string; role: string; parts: unknown; content: string }>,
): UIMessage[] {
  return rows.map((row) => {
    const parts =
      Array.isArray(row.parts) && row.parts.length > 0
        ? (row.parts as UIMessage['parts'])
        : [{ type: 'text', text: row.content } as UIMessage['parts'][number]];
    const isAgent = row.role === 'agent' || row.content.startsWith(AGENT_PREFIX);
    return {
      id: row.id,
      role: isAgent ? 'assistant' : (row.role as UIMessage['role']),
      parts,
      ...(isAgent ? { metadata: { sender: 'agent' as Sender } } : {}),
    };
  });
}

// Chat-app style time stamp under each bubble. Read messages get a double tick
// on the customer's own side, exactly like a messaging app.
function MessageStamp({ side, time, read }: { side: 'left' | 'right'; time: Date; read?: boolean }) {
  const label = time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return (
    <div
      className={`mt-1 flex items-center gap-1 text-[11px] text-muted-foreground ${
        side === 'right' ? 'justify-end pr-1' : 'pl-11'
      }`}
    >
      <span>{label}</span>
      {read && <CheckCheck className="h-3.5 w-3.5 text-primary" />}
    </div>
  );
}

function SenderLabel({ sender }: { sender: Sender }) {

  if (sender === 'customer') return null;
  if (sender === 'agent') {
    return (
      <div className="mb-1.5 flex items-center gap-1.5 border-b border-primary/30 pb-1.5 text-sm font-bold text-primary">
        <Headset className="h-3.5 w-3.5" />
        Warranty specialist · human
      </div>
    );
  }

  return (
    <div className="mb-1.5 flex items-center gap-1.5 border-b border-border pb-1.5 text-sm font-bold text-foreground">
      <img
        src={milesAvatar.url}
        alt="Miles the panda"
        width={20}
        height={20}
        className="h-5 w-5 rounded-full"
        loading="lazy"
      />
      Miles · AI assistant
    </div>
  );
}


function ChatAvatar({ sender }: { sender: Sender }) {
  if (sender === 'customer') {
    return (
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground ring-1 ring-border">
        <UserRound className="h-4 w-4" />
      </span>
    );
  }
  if (sender === 'agent') {
    return (
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Headset className="h-4 w-4" />
      </span>
    );
  }
  return (
    <img
      src={milesAvatar.url}
      alt="Miles the panda"
      width={32}
      height={32}
      className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-card object-cover ring-1 ring-border"
      loading="lazy"
    />
  );
}


function RegQuickStart({
  onSubmit,
  disabled,
}: {
  onSubmit: (reg: string) => void;
  disabled?: boolean;
}) {
  const [reg, setReg] = useState('');
  const clean = reg.replace(/\s+/g, '');
  const valid = clean.length >= 5;

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-border bg-card p-3.5 text-left shadow-sm sm:p-4">
      <p className="text-base font-bold tracking-tight text-foreground">Get your price in seconds</p>

      <form
        className="mt-3 grid w-full min-w-0 grid-cols-1 items-stretch gap-2 min-[360px]:grid-cols-[minmax(0,1fr)_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !disabled) onSubmit(clean.toUpperCase());
        }}
      >
        <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-lg border-2 border-black bg-[#F0CF5C] focus-within:ring-2 focus-within:ring-primary/40">
          <div className="flex min-w-[28px] flex-col items-center justify-center gap-0.5 bg-[#3B6FE0] px-1 py-1 text-[9px] font-extrabold leading-none tracking-wide text-white sm:min-w-[32px] sm:text-[10px]">
            <span>GB</span>
            <span>UK</span>
          </div>
          <input
            value={reg}
            onChange={(e) => setReg(e.target.value.replace(/[^A-Za-z0-9 ]/g, '').toUpperCase())}
            placeholder="ENTER REG"
            aria-label="Vehicle registration"
            maxLength={9}
            disabled={disabled}
            className="min-w-0 flex-1 bg-[#F0CF5C] px-2 py-2 text-sm font-extrabold uppercase tracking-wide text-[#3A3323] outline-none placeholder:text-[#3A3323]/70 sm:text-base"
          />
          {valid && <ArrowRight className="mr-1.5 h-4 w-4 shrink-0 self-center text-[#3A3323]" />}
        </div>
        <Button
          type="submit"
          disabled={!valid || disabled}
          className="h-11 w-full whitespace-nowrap rounded-lg bg-[#EF6C33] px-3 text-sm font-bold text-white shadow-sm transition-transform hover:bg-[#DC5F27] hover:scale-[1.02] disabled:hover:scale-100 min-[360px]:w-auto"
        >
          Get my price
        </Button>
      </form>

      <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        Your details are secure and never shared.
      </p>
    </div>
  );
}

const TERM_OPTIONS = [12, 24, 36];
const LIMIT_OPTIONS = [1000, 2000, 3000];
const EXCESS_OPTIONS = [0, 50, 100, 150, 250, 500];
const LABOUR_OPTIONS = [50, 70, 100, 150];

function OptionRow({
  label,
  options,
  value,
  onChange,
  format,
}: {
  label: string;
  options: number[];
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              value === o
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {format(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Pulls the headline total (and any monthly figure) out of the assistant's reply. */
function extractPrice(text?: string | null) {
  if (!text) return null;
  const amounts = Array.from(text.matchAll(/£\s?([\d,]+(?:\.\d{2})?)/g))
    .map((m) => ({ raw: `£${m[1]}`, value: Number(m[1].replace(/,/g, '')) }))
    .filter((a) => Number.isFinite(a.value));
  const monthly = amounts.find((a) => a.value > 5 && a.value < 200 && /month/i.test(text));
  const total = amounts.filter((a) => a.value >= 150).sort((a, b) => b.value - a.value)[0];
  if (!total) return null;
  return { total: total.raw, monthly: monthly && monthly.raw !== total.raw ? monthly.raw : null };
}

function PriceOptionsPanel({
  disabled,
  onSend,
  onClose,
  reg,
  mileage,
  lastAssistantText,
}: {
  disabled?: boolean;
  onSend: (text: string) => void;
  onClose?: () => void;
  reg?: string | null;
  mileage?: string | null;
  lastAssistantText?: string | null;
}) {
  const [term, setTerm] = useState(24);
  const [limit, setLimit] = useState(2000);
  const [excess, setExcess] = useState(100);
  const [labour, setLabour] = useState(70);
  // Price first, payment second: the card/monthly buttons and the payment-link
  // wording only appear once the customer has asked to see their price.
  const [priceRequested, setPriceRequested] = useState(false);
  const [pending, setPending] = useState<'full' | 'monthly' | null>(null);
  // Once a price has been asked for, the tall option grid folds away so the
  // answer above stays visible — the customer can reopen it to tweak options.
  const [optionsOpen, setOptionsOpen] = useState(true);

  // Chat does persuasion and price; the real cart takes the money. Once we know
  // the reg we can hand the customer straight to plan selection (step 3) with
  // their vehicle pre-filled so nothing is re-typed.
  const checkoutHref = reg
    ? `/?step=3&from=chat&reg=${encodeURIComponent(reg)}${mileage ? `&mileage=${encodeURIComponent(mileage)}` : ''}`
    : null;



  const termLabel = (v: number) => (v % 12 === 0 ? `${v / 12} year${v / 12 > 1 ? 's' : ''}` : `${v} months`);
  const combo = `${termLabel(term)} cover, £${limit.toLocaleString()} claim limit, £${excess} excess, £${labour}/hr labour rate`;
  const quoted = priceRequested ? extractPrice(lastAssistantText) : null;

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-border bg-card p-3.5 text-left shadow-sm sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-foreground">Build your price</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {optionsOpen ? "Pick your options and I'll show you the price." : combo}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {priceRequested && (
            <button
              type="button"
              onClick={() => setOptionsOpen((v) => !v)}
              className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted"
            >
              {optionsOpen ? 'Hide options' : 'Change options'}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close price builder"
              title="Close price builder"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {quoted && (
        <div className="mt-3 rounded-xl border border-[#FF6B00]/30 bg-[#FF6B00]/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#B34A08]">Your price</p>
          <p className="mt-0.5 text-2xl font-extrabold leading-none text-foreground">{quoted.total}</p>
          <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {combo}
            {quoted.monthly ? ` · or ${quoted.monthly}/month over 12 instalments at 0% APR` : ''}
          </p>
        </div>
      )}

      {optionsOpen && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <OptionRow label="Cover length" options={TERM_OPTIONS} value={term} onChange={setTerm} format={termLabel} />
          <OptionRow label="Claim limit" options={LIMIT_OPTIONS} value={limit} onChange={setLimit} format={(v) => `£${v.toLocaleString()}`} />
          <OptionRow label="Excess" options={EXCESS_OPTIONS} value={excess} onChange={setExcess} format={(v) => `£${v}`} />
          <OptionRow label="Labour rate" options={LABOUR_OPTIONS} value={labour} onChange={setLabour} format={(v) => `£${v}/hr`} />
        </div>
      )}

      <div className="mt-3 flex min-w-0 flex-wrap gap-2">
        <Button
          size="sm"
          disabled={disabled}
          className="bg-[#FF6B00] font-bold text-white shadow-sm hover:bg-[#E85F00]"
          onClick={() => {
            setPriceRequested(true);
            setOptionsOpen(false);
            onSend(
              `Price this for me: ${combo}. Reply with the total price in £ on the first line, and the monthly amount if paying over 12 instalments.`,
            );
          }}
        >
          {priceRequested ? 'Update my price' : 'Show my price'}
        </Button>



        {priceRequested && !pending && (
          <div className="mt-3 w-full min-w-0 space-y-3">
            <p className="text-sm text-foreground">
              <strong>Happy with the price?</strong> Pay in full and you save <strong>10%</strong>, or spread it over <strong>12 monthly instalments</strong> at <strong>0% APR</strong>.
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              {/* Option 1 — Pay monthly */}
              <Button
                size="sm"
                disabled={disabled}
                onClick={() => setPending('monthly')}
                className="h-auto min-h-11 w-full min-w-0 justify-between gap-2 whitespace-normal bg-[#FF6B00] px-4 py-2.5 font-bold text-white shadow-sm hover:bg-[#E85F00]"
              >
                <span className="text-left leading-tight">
                  <span className="block text-sm">Pay monthly — 0% APR</span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-white" strokeWidth={2.5} />
              </Button>

              {/* Option 2 — Continue to checkout */}
              <Button
                asChild
                size="sm"
                disabled={disabled || !checkoutHref}
                className="h-auto min-h-11 w-full min-w-0 justify-between gap-2 whitespace-normal bg-[#0BA360] px-4 py-2.5 font-bold text-white shadow-sm hover:bg-[#099455]"
              >
                <a href={checkoutHref || undefined}>
                  <span className="text-left leading-tight">
                    <span className="block text-sm">Continue to checkout</span>
                  </span>
                  <ArrowRight className="h-5 w-5 shrink-0 text-white" strokeWidth={2.5} />
                </a>
              </Button>
            </div>

            <div className="rounded-xl border border-dashed border-border bg-muted/40 p-3">
              <p className="text-xs font-semibold text-foreground">Prefer to finish it yourself?</p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                I'll open your cart with <strong className="text-foreground">{reg || 'FOR3'}</strong> already filled in — pick your plan and pay securely on site. This chat stays open if you need me.
              </p>
            </div>

            <ul className="space-y-1 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[#0BA360]">✓</span>
                <span><strong className="text-foreground">Pay in full</strong> and save <strong className="text-foreground">10%</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[#FF6B00]">✓</span>
                <span><strong className="text-foreground">Pay monthly</strong> over 12 instalments at <strong className="text-foreground">0% APR</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[#0BA360]">✓</span>
                <span>Secure checkout with instant cover</span>
              </li>
            </ul>
          </div>
        )}

        {pending === 'full' && (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-foreground">
              <strong>Pay in full</strong> — save 10% on your total.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={disabled}
                className="bg-[#0BA360] font-bold text-white hover:bg-[#099455]"
                onClick={() => {
                  onSend(
                    `Yes — I'll pay in full for ${combo}. Please confirm the discounted total with the 10% pay-in-full saving, then send me a secure card payment link.`,
                  );
                  setPending(null);
                }}
              >
                Yes, send my payment link
              </Button>
              <Button size="sm" variant="ghost" disabled={disabled} onClick={() => setPending(null)}>
                No, go back
              </Button>
            </div>
          </div>
        )}

        {pending === 'monthly' && (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-foreground">
              <strong>Pay monthly</strong> — 12 equal instalments at 0% APR.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={disabled}
                className="bg-[#FF6B00] font-bold text-white hover:bg-[#E85F00]"
                onClick={() => {
                  onSend(
                    `Yes — I'll pay monthly for ${combo}. Please confirm the monthly amount and the 12-instalment total (0% APR), then send me a secure monthly payment link.`,
                  );
                  setPending(null);
                }}
              >
                Yes, send my payment link
              </Button>
              <Button size="sm" variant="ghost" disabled={disabled} onClick={() => setPending(null)}>
                No, go back
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}




export function SandboxChatWindow({
  threadId,
  guestToken,
  source,
  compact = false,
  autoFocus = true,
}: {
  threadId?: string;
  /** Website visitor mode: the browser owns the conversation via this random token. */
  guestToken?: string;
  /** Which page the chat was opened from (stored with the conversation). */
  source?: string;
  /** Tighter spacing + no staff-only chrome, for the floating website widget. */
  compact?: boolean;
  autoFocus?: boolean;
}) {
  const isGuest = Boolean(guestToken);
  const chatId = threadId || `guest-${guestToken}`;

  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(() =>
    isGuest && guestToken ? loadGuestMessages(guestToken) : null,
  );
  const [handover, setHandover] = useState<Handover | null>(null);
  const [agentMode, setAgentMode] = useState(false);
  const [pricePanelOpen, setPricePanelOpen] = useState(true);
  const composerRef = useRef<HTMLDivElement | null>(null);
  // Keeps a stable "sent at" time per message so stamps don't jump on re-render.
  const stampsRef = useRef<Map<string, Date>>(new Map());
  const stampFor = (id: string) => {
    const existing = stampsRef.current.get(id);
    if (existing) return existing;
    const now = new Date();
    stampsRef.current.set(id, now);
    return now;
  };

  const open = isTeamOpenNow();
  const { liveNames } = useSandboxSpecialistPresence();
  // Weekends: only show the phone line when an agent is genuinely live.
  const showPhoneLine = useSalesLineAvailable();






  // Website visitor: keep listening for replies typed by a real person in the
  // CRM. Whatever a specialist sends there drops straight into this chat box
  // while the visitor is still here, so the conversation carries on live.
  const seenAgentIdsRef = useRef<Set<string>>(new Set());
  const lastAgentAtRef = useRef<string | null>(null);
  const [specialistJoined, setSpecialistJoined] = useState(false);

  useEffect(() => {
    if (!isGuest || !guestToken) return;
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-live-reply`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'poll',
              guestToken,
              since: lastAgentAtRef.current,
            }),
          },
        );
        const data = await res.json().catch(() => null);
        if (!active || !data?.ok || !Array.isArray(data.messages)) return;
        const fresh = (data.messages as Array<{ id: string; text: string; created_at: string }>)
          .filter((m) => m.text && !seenAgentIdsRef.current.has(m.id));
        if (fresh.length === 0) return;
        for (const m of fresh) {
          seenAgentIdsRef.current.add(m.id);
          if (!lastAgentAtRef.current || m.created_at > lastAgentAtRef.current) {
            lastAgentAtRef.current = m.created_at;
          }
        }
        setSpecialistJoined(true);
        
        setMessages((prev) => [
          ...prev,
          ...fresh.map(
            (m) =>
              ({
                id: `agent-${m.id}`,
                role: 'assistant',
                parts: [{ type: 'text', text: m.text }],
                metadata: { sender: 'agent' as Sender },
              }) as UIMessage,
          ),
        ]);
      } catch {
        /* transient — try again on the next tick */
      }
    };

    void poll();
    const t = window.setInterval(poll, 5000);
    return () => {
      active = false;
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest, guestToken]);

  useEffect(() => {
    if (isGuest || !threadId) return;
    let active = true;
    setInitialMessages(null);
    setAgentMode(false);
    (async () => {
      const { data, error } = await supabase
        .from('ai_sandbox_messages')
        .select('id, role, parts, content')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      if (!active) return;
      if (error) {
        console.error('Failed to load sandbox messages', error);
        setInitialMessages([]);
        return;
      }
      setInitialMessages(rowsToUIMessages(data ?? []));
    })();
    return () => {
      active = false;
    };
  }, [threadId, isGuest]);

  const loadHandover = useCallback(async () => {
    if (isGuest || !threadId) return;
    const { data } = await supabase
      .from('ai_sandbox_handovers')
      .select('id, kind, status, reason, customer_name, cover_summary, quoted_price, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setHandover((data as Handover) ?? null);
  }, [threadId, isGuest]);

  useEffect(() => {
    loadHandover();
  }, [loadHandover]);

  // Remembers the last thing the visitor sent so a dropped connection can be retried.
  const lastSentRef = useRef<string | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: CHAT_URL,
        headers: async () => {
          if (isGuest) return {};
          const { data } = await supabase.auth.getSession();
          return { Authorization: `Bearer ${data.session?.access_token ?? ''}` };
        },
        body: isGuest ? { guestToken, source: source ?? null } : { threadId },
      }),
    [threadId, guestToken, source, isGuest],
  );


  const { messages, setMessages, sendMessage, status, error, stop } = useChat({
    id: chatId,
    transport,
    messages: initialMessages ?? [],
    onFinish: () => {
      loadHandover();
    },
  });

  // Website visitors keep their transcript across page navigations (e.g. the
  // "Continue to checkout" hand-off to step 3).
  useEffect(() => {
    if (!isGuest || !guestToken) return;
    if (status === 'streaming') return;
    saveGuestMessages(guestToken, messages);
  }, [isGuest, guestToken, messages, status]);

  useEffect(() => {
    if (!autoFocus) return;
    composerRef.current?.querySelector('textarea')?.focus();
  }, [chatId, status, agentMode, autoFocus]);

  const busy = status === 'submitted' || status === 'streaming';

  // Pull the reg and mileage back out of the conversation so the "Continue to
  // checkout" hand-off can pre-fill the real cart. Latest mention wins.
  const { detectedReg, detectedMileage } = useMemo(() => {
    const texts: string[] = [];
    for (const m of messages) {
      for (const p of m.parts) {
        if (p.type === 'text' && typeof (p as { text?: string }).text === 'string') {
          texts.push((p as { text: string }).text);
        }
      }
    }
    const joined = texts.join('\n');
    const regMatches = joined.match(
      /\b([A-Z]{2}[0-9]{2}\s?[A-Z]{3}|[A-Z][0-9]{1,3}\s?[A-Z]{3}|[A-Z]{3}\s?[0-9]{1,3}[A-Z]?)\b/gi,
    );
    const mileMatches = joined.match(/([0-9][0-9,\.]{2,9})\s*(?:miles|mile|mi\b|k\b)/gi);
    const rawMileage = mileMatches?.[mileMatches.length - 1]?.replace(/[^0-9]/g, '') ?? '';
    const mileageNum = Number(rawMileage);
    return {
      detectedReg: regMatches?.[regMatches.length - 1]?.replace(/\s+/g, '').toUpperCase() ?? null,
      detectedMileage: mileageNum >= 100 && mileageNum <= 300000 ? String(mileageNum) : null,
    };
  }, [messages]);


  // Show the price builder only when Miles has actually priced a vehicle.
  // A plain vehicle lookup (e.g. "what's covered?") should not open the panel.
  const hasPriceQuote = useMemo(
    () =>
      messages.some((m) =>
        m.parts.some(
          (p) => typeof p.type === 'string' && p.type === 'tool-get_indicative_price',
        ),
      ),
    [messages],
  );

  // Reopen the price builder automatically when a fresh price is quoted.
  useEffect(() => {
    if (hasPriceQuote) setPricePanelOpen(true);
  }, [hasPriceQuote]);

  // Latest assistant reply, so the price panel can echo the quoted figure.
  const lastAssistantText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (m.role !== 'assistant') continue;
      const text = m.parts
        .map((p) => (p.type === 'text' ? (p as { text: string }).text : ''))
        .join(' ')
        .trim();
      if (text) return text;
    }
    return null;
  }, [messages]);




  const sendAsAgent = async (text: string) => {
    const content = `${AGENT_PREFIX} ${text}`;
    const { data: session } = await supabase.auth.getUser();
    const localId = `agent-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: localId,
        role: 'assistant',
        parts: [{ type: 'text', text: content }],
        metadata: { sender: 'agent' as Sender },
      } as UIMessage,
    ]);
    const { error: insertError } = await supabase.from('ai_sandbox_messages').insert({
      thread_id: threadId,
      user_id: session.user?.id as string,
      role: 'agent',
      content,
      parts: [{ type: 'text', text: content }],
    });
    if (insertError) console.error('Failed to save specialist message', insertError);
  };

  // WhatsApp-style attachments: photos picked here are shrunk in the browser
  // first, so nothing large is held in memory or uploaded.
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setAttachError(null);
    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      setAttachError(`You can send up to ${MAX_ATTACHMENTS} photos at a time.`);
      return;
    }
    for (const file of Array.from(files).slice(0, room)) {
      try {
        const prepared = await prepareAttachment(file);
        setAttachments((prev) => [...prev, prepared]);
      } catch (e) {
        setAttachError(e instanceof Error ? e.message : 'That file could not be attached.');
      }
    }
  };

  const insertIntoComposer = (snippet: string) => {
    const ta = composerRef.current?.querySelector('textarea');
    if (!ta) return;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    const next = `${ta.value}${snippet}`;
    setter ? setter.call(ta, next) : (ta.value = next);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.focus();
  };

  const send = (text: string) => {
    const trimmed = (text ?? '').trim();
    const files = attachments;
    if ((!trimmed && files.length === 0) || busy) return;
    if (agentMode) {
      if (trimmed) void sendAsAgent(trimmed);
      return;
    }
    lastSentRef.current = trimmed;
    if (files.length) {
      sendMessage({
        text: trimmed || 'Here you go.',
        files: files.map((f) => ({
          type: 'file' as const,
          filename: f.name,
          mediaType: f.mediaType,
          url: f.url,
        })),
      });
      setAttachments([]);
      return;
    }
    sendMessage({ text: trimmed });
  };

  // There is no live-agent handover: customers either call us, or leave a
  // number and the team calls or WhatsApps them back (CallMeBackPanel).



  const takeChat = async () => {
    setAgentMode(true);
    if (!handover) return;
    const { data: session } = await supabase.auth.getUser();
    await supabase
      .from('ai_sandbox_handovers')
      .update({
        status: 'accepted',
        claimed_by: session.user?.id ?? null,
        claimed_at: new Date().toISOString(),
      })
      .eq('id', handover.id);
    loadHandover();
  };

  if (initialMessages === null) {
    return <div className="flex-1 p-6 text-sm text-muted-foreground">Loading conversation…</div>;
  }

  const waiting = handover?.status === 'waiting' && handover.kind === 'live_handover';
  const leadCaptured = handover?.kind === 'out_of_hours_lead' || handover?.kind === 'callback_request';

  // "Can I speak to a human / live agent?" shows the contact card inline.
  // Miles marks those replies with [[CONTACT_CARD]]; a plain-English ask in the
  // customer's own words triggers it too, so the card never depends on the model.
  const contactCardWanted = !leadCaptured && (() => {
    for (const m of messages) {
      if (m.role !== 'user') {
        for (const p of m.parts ?? []) {
          if (p.type === 'text' && typeof p.text === 'string' && p.text.includes(CONTACT_CARD_MARKER)) return true;
        }
      }
    }
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return false;
    const txt = (lastUser.parts ?? []).map((p) => (p.type === 'text' ? p.text : '')).join(' ');
    return HUMAN_INTENT.test(txt);
  })();

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden">
      {/* Who you are talking to */}
      {agentMode ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">
          <Headset className="h-3.5 w-3.5" />
          <span className="font-medium">You are replying as a human warranty specialist</span>
          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setAgentMode(false)}>
            Hand back to AI
          </Button>
        </div>
      ) : compact ? null : (
        <div className="border-b border-border bg-background px-4 py-2 text-sm">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-emerald-500 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
            </span>
            Miles · AI agent online
          </p>
        </div>
      )}

      {/* Compact top action row — call us, or leave a number for a call / WhatsApp back. */}
      {!agentMode && (
        <div className="border-b border-border bg-background px-3 py-2.5">
          {specialistJoined ? (
            <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Headset className="h-3.5 w-3.5 shrink-0 text-primary" />
              A warranty specialist has replied in this chat.
            </p>
          ) : (
            <div className={showPhoneLine ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1 gap-2'}>
              {showPhoneLine && (
                <a
                  href="tel:03302295040"
                  className="flex min-w-0 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-primary/10"
                >
                  <PhoneCall className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">Call 0330 229 5040</span>
                </a>
              )}
              <CallMeBackPanel
                asChip
                guestToken={guestToken}
                threadId={threadId}
                source={source}
                compact={compact}
                registration={detectedReg}
              />
            </div>
          )}
        </div>
      )}

      {(waiting || leadCaptured) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          <PhoneCall className="h-3.5 w-3.5" />
          {waiting ? (
            <>
              <span className="font-medium">A warranty specialist has been alerted</span>
              <span>
                Reason: {handover?.reason?.replace(/_/g, ' ')}
                {handover?.quoted_price ? ` · £${Math.round(handover.quoted_price)}` : ''}
              </span>
              {!agentMode && (
                <Button size="sm" className="h-6 px-2" onClick={takeChat}>
                  Take this chat
                </Button>
              )}
            </>
          ) : (
            <span className="font-medium">
              Lead captured out of hours{handover?.customer_name ? ` for ${handover.customer_name}` : ''} — a
              specialist picks this up {nextOpeningLabel()}
            </span>
          )}
        </div>
      )}

      <Conversation
        className="min-w-0 max-w-full flex-1 overflow-x-hidden"
        initial={messages.some((m) => m.role === 'user') ? 'smooth' : false}
        resize="smooth"
      >
        <ConversationContent className={compact ? 'w-full min-w-0 max-w-full overflow-x-hidden px-3' : 'mx-auto w-full min-w-0 max-w-3xl overflow-x-hidden'}>
          <div>
            <Message from="assistant" className="min-w-0 max-w-full flex-row items-start gap-2">
              <ChatAvatar sender="ai" />
              <MessageContent className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-foreground">
                <SenderLabel sender="ai" />
                <MessageResponse className={CHAT_TEXT}>{OPENING_LINE}</MessageResponse>
              </MessageContent>
            </Message>
            <MessageStamp side="left" time={stampFor('opening')} />
          </div>


          {messages.length === 0 && (
            <div className="flex flex-col gap-3 py-2">
              {!compact && <img
                src={milesCalls.url}
                alt="Miles the panda in a buyawarranty polo with a headset, saying hi and offering to check your coverage, file a claim or get answers"
                width={760}
                height={512}
                className="mx-auto h-auto w-full max-w-[220px]"
                loading="lazy"
              />}

              <RegQuickStart disabled={busy} onSubmit={(reg) => send(`My reg is ${reg} — what would my warranty cost?`)} />

              <div className="flex flex-col gap-2">
                {STARTERS.map(({ text, Icon }) => (
                  <button
                    key={text}
                    onClick={() => send(text)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left text-sm font-semibold text-foreground shadow-sm transition-all hover:border-primary/50 hover:bg-primary/5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-primary/10">
                      <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                    </span>
                    <span className="min-w-0 flex-1">{text}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                ))}
              </div>
            </div>
          )}


          {messages.map((message, msgIndex) => {
            const sender = senderOf(message);
            return (
              <div key={message.id} className={msgIndex > 0 ? 'mt-4' : undefined}>
              <Message
                from={message.role}
                className={
                  message.role === 'user'
                    ? 'flex-row-reverse items-start gap-2'
                    : 'flex-row items-start gap-2'
                }
              >
                {message.role !== 'user' && <ChatAvatar sender={sender} />}
                <MessageContent
                  className={
                    message.role === 'user'
                       ? 'max-w-[calc(100vw-2rem)] break-words rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-primary-foreground shadow-sm [overflow-wrap:anywhere] sm:max-w-full'
                       : 'break-words rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-foreground [overflow-wrap:anywhere]'
                  }
                >

                  <SenderLabel sender={sender} />

                  {message.parts.map((part, i) => {
                    if (part.type === 'text') {
                      const text = stripPrefix(part.text).split(CONTACT_CARD_MARKER).join('').trim();
                      if (message.role !== 'user') {
                        const clean = agentMode ? text : sanitizeForCustomer(text);
                        if (!clean) return null;
                        const { body, question } = splitTrailingQuestion(clean);
                        return (

                          <div key={i}>
                            {body && <MessageResponse className={CHAT_TEXT}>{body}</MessageResponse>}
                            {question && (
                              <p className="mt-2 border-l-2 border-primary pl-3 text-base font-semibold leading-relaxed text-primary">
                                {question}
                              </p>
                            )}
                          </div>
                        );
                      }
                      return <MessageResponse key={i} className={`${CHAT_TEXT} text-primary-foreground [&_p]:text-primary-foreground`}>{text}</MessageResponse>;
                    }

                    // Photos the visitor attached, shown WhatsApp-style inside
                    // the bubble.
                    if (part.type === 'file') {
                      const f = part as unknown as { url: string; mediaType?: string; filename?: string };
                      if (!f.url || !(f.mediaType ?? '').startsWith('image/')) return null;
                      return (
                        <img
                          key={i}
                          src={f.url}
                          alt={f.filename || 'Attached photo'}
                          loading="lazy"
                          className="mt-1 max-h-56 w-full rounded-lg object-cover"
                        />
                      );
                    }



                    // Model "thinking" is internal working-out — never show it to a
                    // customer. Agent mode keeps it for debugging.
                    if (part.type === 'reasoning' && part.text) {
                      if (!agentMode) return null;
                      return (
                        <p key={i} className="text-xs italic text-muted-foreground">
                          {part.text}
                        </p>
                      );
                    }

                    if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
                      const p = part as unknown as {
                        type: string;
                        state: string;
                        input?: unknown;
                        output?: unknown;
                        errorText?: string;
                      };

                      // Customers must never see raw tool names/JSON — it reads like
                      // code and looks unprofessional. Show a plain-English status
                      // while we work, and nothing once it's done (the answer follows).
                      if (!agentMode) {
                        const done = p.state === 'output-available' || p.state === 'output-error';
                        if (done) return null;
                        const labels: Record<string, string> = {
                          'tool-lookup_vehicle': 'Checking your vehicle details…',
                          'tool-get_indicative_price': 'Working out your price…',
                        };
                        return (
                          <p key={i} className="text-xs text-muted-foreground">
                            {labels[p.type] || 'Just checking a few details…'}
                          </p>
                        );
                      }

                      return (
                        <Tool key={i} defaultOpen={false}>
                          <ToolHeader type={p.type as `tool-${string}`} state={p.state as never} />
                          <ToolContent>
                            <ToolInput input={p.input} />
                            <ToolOutput output={p.output} errorText={p.errorText} />
                          </ToolContent>
                        </Tool>
                      );
                    }

                    return null;
                  })}
                </MessageContent>
              </Message>
              <MessageStamp
                side={message.role === 'user' ? 'right' : 'left'}
                time={stampFor(message.id)}
                read={message.role === 'user'}
              />
              </div>

            );

          })}

          {contactCardWanted && (
            <div className="w-full min-w-0 max-w-full px-0 pb-2 sm:px-2">
              <CallMeBackPanel
                autoOpen
                guestToken={guestToken}
                threadId={threadId}
                source={source}
                compact={compact}
                registration={detectedReg}
              />
            </div>
          )}

          {!agentMode && hasPriceQuote && pricePanelOpen && (
            <div className="w-full min-w-0 max-w-full px-0 pb-2 sm:px-2">
              <PriceOptionsPanel
                disabled={busy}
                onSend={send}
                onClose={() => setPricePanelOpen(false)}
                reg={detectedReg}
                mileage={detectedMileage}
                lastAssistantText={lastAssistantText}
              />
            </div>
          )}



          {status === 'submitted' && (
            <div className="px-2 py-3">
              <Shimmer>Thinking…</Shimmer>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <p>
                {/^(failed to fetch|network|load failed|typeerror)/i.test(error.message ?? '')
                  ? "That didn't send — the connection dropped. Try again, or call us on 0330 229 5040."
                  : error.message || 'Something went wrong. Please try again.'}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 h-7"
                onClick={() => {
                  const last = lastSentRef.current;
                  if (last) sendMessage({ text: last });
                }}
              >
                Try again
              </Button>
            </div>
          )}

        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>


      <div
        className={`${compact ? 'w-full min-w-0 max-w-full px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3' : 'mx-auto w-full min-w-0 max-w-3xl p-4'} border-t border-border bg-background`}
        ref={composerRef}
      >

        {(attachments.length > 0 || attachError) && (
          <div className="mb-2 space-y-2">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <div key={a.id} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border">
                    <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label={`Remove ${a.name}`}
                      onClick={() => setAttachments((prev) => prev.filter((p) => p.id !== a.id))}
                      className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5 text-foreground shadow"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {attachError && <p className="text-xs text-destructive">{attachError}</p>}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void addFiles(e.target.files);
            e.currentTarget.value = '';
          }}
        />

        <PromptInput
          onSubmit={(message) => send(message.text ?? '')}
          className="rounded-2xl border border-primary/40 bg-card shadow-md transition-all focus-within:border-primary focus-within:shadow-lg focus-within:ring-2 focus-within:ring-primary/20"
        >
          <PromptInputTextarea
            className="min-h-[44px] text-base placeholder:text-muted-foreground/80"
            placeholder={
              agentMode
                ? 'Reply as the warranty specialist…'
                : 'Ask about cover, pricing, claims…'
            }
          />
          <PromptInputFooter className="items-center justify-between gap-2 border-0 pt-0">
            <div className="flex min-w-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Attach a photo"
                disabled={busy || attachments.length >= MAX_ATTACHMENTS}
                onClick={() => fileInputRef.current?.click()}
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Insert an emoji"
                    className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary"
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" side="top" className="w-64 p-2">
                  <div className="grid grid-cols-8 gap-1">
                    {CHAT_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="rounded p-1 text-lg leading-none hover:bg-muted"
                        onClick={() => {
                          insertIntoComposer(emoji);
                          setEmojiOpen(false);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex min-w-0 items-center gap-2">

              {!isGuest && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                  Sandbox · test links only
                </Badge>
              )}
              {agentMode && (
                <Badge className="text-[10px] uppercase tracking-wide">Human specialist</Badge>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <VoiceDictateButton
                iconOnly
                disabled={busy}
                onTranscript={(text) => {
                  const ta = composerRef.current?.querySelector('textarea');
                  if (ta) {
                    const setter = Object.getOwnPropertyDescriptor(
                      window.HTMLTextAreaElement.prototype,
                      'value',
                    )?.set;
                    const next = ta.value ? `${ta.value} ${text}` : text;
                    setter ? setter.call(ta, next) : (ta.value = next);
                    ta.dispatchEvent(new Event('input', { bubbles: true }));
                    ta.focus();
                  } else {
                    send(text);
                  }
                }}
              />
              <PromptInputSubmit
                status={status}
                onClick={busy ? () => stop() : undefined}
                className="h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-105 hover:bg-primary/90 [&_svg]:size-5"
              />
            </div>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

export default SandboxChatWindow;
