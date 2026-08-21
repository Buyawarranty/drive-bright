import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Headset, PhoneCall, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
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
import { CallMeBackPanel } from '@/components/ai-sandbox/CallMeBackPanel';


const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-sandbox-chat`;

const AGENT_PREFIX = '(Warranty specialist)';

const OPENING_LINE = [
  "Hey, I'm Miles — the AI assistant here. Happy to help.",
  '',
  "- Pop your **reg** in, or the make, model and year",
  "- I'll sort out the right cover and price for you",
  '- Want a human? A real specialist can jump in any time',
].join('\n');


const STARTERS: Array<{ text: string; Icon: LucideIcon }> = [
  { text: "What's covered in my warranty?", Icon: ShieldCheck },
  { text: 'Can I pay monthly?', Icon: CalendarDays },
  { text: 'Feels a bit pricey — can I talk to someone?', Icon: UserRound },
  { text: 'I need help with a claim', Icon: FileText },
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

function SenderLabel({ sender }: { sender: Sender }) {
  if (sender === 'customer') return null;
  if (sender === 'agent') {
    return (
      <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-primary">
        <Headset className="h-3.5 w-3.5" />
        Warranty specialist · human
      </div>
    );
  }
  return (
    <div className="mb-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
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
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-3 text-left shadow-sm sm:p-4">
      <p className="text-sm font-semibold text-foreground">Get an instant price or advice</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Pop your reg in — I'll pull your vehicle details and come straight back with cover options.
      </p>

      <form
        className="mt-3 flex w-full items-stretch gap-1.5 sm:gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && !disabled) onSubmit(clean.toUpperCase());
        }}
      >
        <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-lg border-[3px] border-black bg-[#F0CF5C]">
          <div className="flex min-w-[30px] flex-col items-center justify-center gap-0.5 bg-[#3B6FE0] px-1 py-1 text-[10px] font-extrabold leading-none tracking-wide text-white sm:min-w-[34px] sm:text-[11px]">
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
            className="min-w-0 flex-1 bg-[#F0CF5C] px-2 py-2 text-base font-extrabold uppercase tracking-wide text-[#3A3323] outline-none placeholder:text-[#3A3323]/80 sm:text-lg"
          />
        </div>
        <Button type="submit" disabled={!valid || disabled} className="shrink-0 whitespace-nowrap px-2.5 text-sm font-semibold sm:px-3">
          Get my price
        </Button>


      </form>


      <p className="mt-2 text-sm text-muted-foreground">
        Free quote · no card details needed · takes about 20 seconds
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
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
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

function PriceOptionsPanel({
  disabled,
  onSend,
  reg,
  mileage,
}: {
  disabled?: boolean;
  onSend: (text: string) => void;
  reg?: string | null;
  mileage?: string | null;
}) {
  const [term, setTerm] = useState(24);
  const [limit, setLimit] = useState(2000);
  const [excess, setExcess] = useState(100);
  const [labour, setLabour] = useState(70);
  // Price first, payment second: the card/monthly buttons and the payment-link
  // wording only appear once the customer has asked to see their price.
  const [priceRequested, setPriceRequested] = useState(false);
  const [pending, setPending] = useState<'full' | 'monthly' | null>(null);

  // Chat does persuasion and price; the real cart takes the money. Once we know
  // the reg we can hand the customer straight to plan selection (step 3) with
  // their vehicle pre-filled so nothing is re-typed.
  const checkoutHref = reg
    ? `/?step=3&from=chat&reg=${encodeURIComponent(reg)}${mileage ? `&mileage=${encodeURIComponent(mileage)}` : ''}`
    : null;



  const termLabel = (v: number) => (v % 12 === 0 ? `${v / 12} year${v / 12 > 1 ? 's' : ''}` : `${v} months`);
  const combo = `${termLabel(term)} cover, £${limit.toLocaleString()} claim limit, £${excess} excess, £${labour}/hr labour rate`;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm">
      <p className="text-sm font-semibold text-foreground">Build your price</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Pick your options and I'll show you the price.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <OptionRow label="Cover length" options={TERM_OPTIONS} value={term} onChange={setTerm} format={termLabel} />
        <OptionRow label="Claim limit" options={LIMIT_OPTIONS} value={limit} onChange={setLimit} format={(v) => `£${v.toLocaleString()}`} />
        <OptionRow label="Excess" options={EXCESS_OPTIONS} value={excess} onChange={setExcess} format={(v) => `£${v}`} />
        <OptionRow label="Labour rate" options={LABOUR_OPTIONS} value={labour} onChange={setLabour} format={(v) => `£${v}/hr`} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={disabled}
          className="bg-[#FF6B00] font-bold text-white shadow-sm hover:bg-[#E85F00]"
          onClick={() => {
            setPriceRequested(true);
            onSend(`Price this for me: ${combo}. What's the total?`);
          }}
        >
          Show my price
        </Button>


        {priceRequested && !pending && (
          <>
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => setPending('full')}>
              Pay in full — save 10%
            </Button>
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => setPending('monthly')}>
              Pay monthly — 0% APR
            </Button>
          </>
        )}

        {pending && (
          <>
            <Button
              size="sm"
              disabled={disabled}
              className="bg-[#0BA360] font-bold text-white hover:bg-[#099455]"
              onClick={() => {
                onSend(
                  pending === 'full'
                    ? `Yes — I'll pay in full for ${combo}. Please confirm the discounted total with the 10% pay-in-full saving, then send me a secure card payment link.`
                    : `Yes — I'll pay monthly for ${combo}. Please confirm the monthly amount and the 12-instalment total (0% APR), then send me a secure monthly payment link.`,
                );
                setPending(null);
              }}
            >
              Yes, send my payment link
            </Button>
            <Button size="sm" variant="ghost" disabled={disabled} onClick={() => setPending(null)}>
              No, go back
            </Button>
          </>
        )}
      </div>

      {priceRequested && !pending && checkoutHref && (
        <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/40 p-3">
          <p className="text-xs font-semibold text-foreground">Prefer to finish it yourself?</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            I'll open your cart with {reg} already filled in — pick your plan and pay securely on site. This chat stays
            open if you need me.
          </p>
          <Button asChild size="sm" variant="outline" className="mt-2 font-semibold">
            <a href={checkoutHref}>Continue to checkout →</a>
          </Button>
        </div>
      )}

      {priceRequested && !pending && (
        <p className="mt-2 text-xs text-muted-foreground">
          Happy with the price? Pay in full and you save 10%, or spread it over 12 monthly instalments at 0% APR.
        </p>
      )}


      {pending && (
        <p className="mt-2 text-xs text-muted-foreground">
          {pending === 'full'
            ? "Just to confirm — you'd like to pay in full with the 10% saving applied? I'll confirm the exact total before sending your secure payment link."
            : "Just to confirm — you'd like to pay monthly over 12 instalments at 0% APR? I'll confirm the monthly amount before sending your secure payment link."}
        </p>
      )}

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

  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(isGuest ? [] : null);
  const [handover, setHandover] = useState<Handover | null>(null);
  const [agentMode, setAgentMode] = useState(false);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const open = isTeamOpenNow();
  const { liveCount, liveNames } = useSandboxSpecialistPresence();


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

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: CHAT_URL,
        headers: async () => {
          if (isGuest) return { 'Content-Type': 'application/json' };
          const { data } = await supabase.auth.getSession();
          return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.session?.access_token ?? ''}`,
          };
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


  // Show the price builder once Miles has looked the vehicle up or quoted a price
  const hasPriceQuote = useMemo(
    () =>
      messages.some((m) =>
        m.parts.some(
          (p) =>
            typeof p.type === 'string' &&
            (p.type === 'tool-get_indicative_price' || p.type === 'tool-lookup_vehicle'),
        ),
      ),
    [messages],
  );


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

  const send = (text: string) => {
    const trimmed = (text ?? '').trim();
    if (!trimmed || busy) return;
    if (agentMode) {
      void sendAsAgent(trimmed);
      return;
    }
    sendMessage({ text: trimmed });
  };

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Who you are talking to */}
      {agentMode ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">
          <Headset className="h-3.5 w-3.5" />
          <span className="font-medium">You are replying as a human warranty specialist</span>
          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => setAgentMode(false)}>
            Hand back to AI
          </Button>
        </div>
      ) : (
        <div className="space-y-1 border-b border-border bg-background px-4 py-2.5 text-sm">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-emerald-500 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
            </span>
            AI assistant online
          </p>
          {liveCount > 0 ? (
            <p className="flex items-center gap-2 font-medium text-emerald-700">
              <span className="ml-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
              {liveCount === 1 ? 'A specialist is online now' : `${liveCount} specialists are online now`}
              {liveNames.length > 0 ? ` (${liveNames.slice(0, 2).join(', ')})` : ''}
            </p>
          ) : (
            <p className="flex items-center gap-2 text-muted-foreground">
              {open ? (
                <span className="ml-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
              ) : (
                <Clock className="h-3.5 w-3.5 shrink-0" />
              )}
              {open ? `Specialist available ${openingHoursLabel}` : `Specialists back ${nextOpeningLabel()} · ${openingHoursLabel}`}
            </p>
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

      <Conversation className="flex-1">
        <ConversationContent className={compact ? 'w-full px-3' : 'mx-auto w-full max-w-3xl'}>
          <Message from="assistant">
            <MessageContent>
              <SenderLabel sender="ai" />
              <MessageResponse>{OPENING_LINE}</MessageResponse>
            </MessageContent>
          </Message>

          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              {!compact && <img
                src={milesCalls.url}
                alt="Miles the panda in a buyawarranty polo with a headset, saying hi and offering to check your coverage, file a claim or get answers"
                width={760}
                height={512}
                className="h-auto w-full max-w-[220px]"
                loading="lazy"
              />}

              <RegQuickStart disabled={busy} onSubmit={(reg) => send(`My reg is ${reg} — what would my warranty cost?`)} />

              <p className="max-w-sm text-center text-sm text-muted-foreground">
                Just type your registration plate and mileage — that's all we need to find your vehicle.
                <br />
                For example: <span className="font-medium text-foreground">AB12 CDE, 62,000 miles</span>
              </p>

              <div className="flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}


          {messages.map((message) => {
            const sender = senderOf(message);
            return (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  <SenderLabel sender={sender} />
                  {message.parts.map((part, i) => {
                    if (part.type === 'text') {
                      return <MessageResponse key={i}>{stripPrefix(part.text)}</MessageResponse>;
                    }
                    if (part.type === 'reasoning' && part.text) {
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
            );
          })}

          {!agentMode && hasPriceQuote && (
            <div className="px-2 pb-2">
              <PriceOptionsPanel disabled={busy} onSend={send} reg={detectedReg} mileage={detectedMileage} />
            </div>
          )}



          {status === 'submitted' && (
            <div className="px-2 py-3">
              <Shimmer>Thinking…</Shimmer>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error.message || 'Something went wrong. Please try again.'}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {!agentMode && (
        <div className={compact ? '' : 'mx-auto w-full max-w-3xl'}>
          <CallMeBackPanel
            guestToken={guestToken}
            threadId={threadId}
            source={source}
            compact={compact}
          />
        </div>
      )}

      <div className={compact ? 'w-full p-3' : 'mx-auto w-full max-w-3xl p-4'} ref={composerRef}>

        <PromptInput onSubmit={(message) => send(message.text ?? '')}>
          <PromptInputTextarea
            placeholder={
              agentMode
                ? 'Reply as the warranty specialist…'
                : 'Ask about cover, pricing, claims…'
            }
          />
          <PromptInputFooter className="justify-between">
            <div className="flex items-center gap-2">
              {!isGuest && (
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                  Sandbox · test links only
                </Badge>
              )}
              {agentMode && (
                <Badge className="text-[10px] uppercase tracking-wide">Human specialist</Badge>
              )}
            </div>
            <PromptInputSubmit status={status} onClick={busy ? () => stop() : undefined} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

export default SandboxChatWindow;
