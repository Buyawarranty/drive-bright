import { useMemo, useState } from 'react';
import {
  PhoneCall,
  Phone,
  Check,
  Loader2,
  X,
  Clock,
  ChevronDown,
  MessageCircle,
  Mail,
  Pencil,
} from 'lucide-react';
import { isTeamOpenNow, nextOpeningLabel, openingHoursLabel } from '@/lib/aiSandbox/openingHours';
import { SALES_PHONE, SALES_PHONE_TEL, WHATSAPP_URL } from '@/constants/contact';

const CALLBACK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sandbox-callback-request`;

/** UK mobile or landline. */
function validUkPhone(raw: string): boolean {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('44')) digits = `0${digits.slice(2)}`;
  if (!/^07\d{9}$/.test(digits) && !/^0[12]\d{8,9}$/.test(digits) && !/^03\d{9}$/.test(digits)) return false;
  // Reject obvious junk: the same digit repeated 5+ times in a row.
  if (/(\d)\1{4,}/.test(digits)) return false;
  return true;
}

/** Keep typing sane: digits/spaces/+, capped at a normal UK length. */
function capUkPhone(raw: string): string {
  const cleaned = raw.replace(/[^\d +]/g, '');
  const digits = cleaned.replace(/\D/g, '');
  const max = digits.startsWith('44') || cleaned.trim().startsWith('+') ? 13 : 11;
  if (digits.length <= max) return cleaned;
  // Trim trailing digits beyond the cap, preserving spacing roughly.
  let kept = '';
  let count = 0;
  for (const ch of cleaned) {
    if (/\d/.test(ch)) {
      if (count >= max) continue;
      count += 1;
    }
    kept += ch;
  }
  return kept;
}

function prettyPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  return raw;
}

function validEmail(raw: string): boolean {
  const v = raw.trim();
  // Sensible shape: local part, @, domain labels, alphabetic TLD of 2+ chars.
  if (!/^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9][A-Za-z0-9.-]{0,253}\.[A-Za-z]{2,24}$/.test(v)) return false;
  if (v.includes('..')) return false;
  return true;
}

type Step = 'closed' | 'method' | 'claimsInfo' | 'number' | 'done';
type Preference = 'call' | 'whatsapp' | 'email';
type Topic = 'warranty_purchase' | 'general' | 'existing_policy' | 'other';

const TOPIC_SENTENCE: Record<Topic, string> = {
  warranty_purchase: 'warranty purchase',
  general: 'general enquiry',
  existing_policy: 'existing policy question',
  other: '',
};

export function CallMeBackPanel({
  guestToken,
  threadId,
  source,
  registration,
  quotedPrice,
  compact: _compact = false,
  asChip = false,
  autoOpen = false,
  agentLive = false,
  onRequestLiveChat,
}: {
  guestToken?: string;
  threadId?: string;
  source?: string;
  registration?: string | null;
  quotedPrice?: number | null;
  /** Accepted for backwards compatibility; layout is always compact. */
  compact?: boolean;
  /** Render the idle state as a small one-line chip (for the top action row). */
  asChip?: boolean;
  /** Render expanded straight away (inline in the chat stream). */
  autoOpen?: boolean;
  /** True only while a staff member has switched themselves on duty. */
  agentLive?: boolean;
  onRequestLiveChat?: () => void;
}) {
  const [step, setStep] = useState<Step>(autoOpen ? 'method' : 'closed');
  const [collapsed, setCollapsed] = useState(!autoOpen);
  const [touched, setTouched] = useState(false);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [preference, setPreference] = useState<Preference>('call');
  const [topic, setTopic] = useState<Topic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const open = isTeamOpenNow();
  const isEmail = preference === 'email';
  const isWhatsApp = preference === 'whatsapp';
  const isValid = useMemo(() => (isEmail ? validEmail(email) : validUkPhone(phone)), [isEmail, email, phone]);

  const submit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(CALLBACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: isEmail ? '' : phone,
          email: isEmail ? email.trim() : '',
          name: '',
          contactPreference: preference,
          topic: topic ?? 'other',
          registration: registration ?? null,
          quotedPrice: quotedPrice ?? null,
          guestToken: guestToken ?? null,
          threadId: threadId ?? null,
          source: source ?? 'website-chat',
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? "We couldn't save that - please call 0330 229 5040.");
        return;
      }
      if (data.suppressed) {
        setError(data.message ?? "Please give us a ring on 0330 229 5040 and we'll help straight away.");
        return;
      }
      setStep('done');
    } catch {
      setError('Network problem - please try again, or call 0330 229 5040.');
    } finally {
      setSubmitting(false);
    }
  };

  const pickMethod = (key: Preference) => {
    setPreference(key);
    setError(null);
    setTouched(false);
    setStep('number');
  };

  const methodList = (
    <div className="space-y-2">
      <p className="text-sm font-bold text-foreground">How would you like to get in touch?</p>
      {agentLive && onRequestLiveChat && (
        <button
          type="button"
          onClick={onRequestLiveChat}
          className="flex h-12 w-full items-center gap-3 rounded-xl border border-primary bg-primary px-4 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <MessageCircle className="h-4 w-4 shrink-0" />
          Chat with a specialist now
        </button>
      )}
      <a
        href={SALES_PHONE_TEL}
        className="flex h-12 w-full items-center gap-3 rounded-xl border border-input bg-background px-4 text-sm font-bold text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
      >
        <Phone className="h-4 w-4 shrink-0 text-[#B4501F]" />
        Call us · {SALES_PHONE}
      </a>
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-12 w-full items-center gap-3 rounded-xl border border-input bg-background px-4 text-sm font-bold text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
      >
        <MessageCircle className="h-4 w-4 shrink-0 text-emerald-600" />
        WhatsApp us
      </a>
      <button
        type="button"
        onClick={() => pickMethod('call')}
        className="flex h-12 w-full items-center gap-3 rounded-xl border border-primary/50 bg-[#FDEBDF] px-4 text-sm font-bold text-foreground transition-colors hover:bg-[#FBE0CE]"
      >
        <PhoneCall className="h-4 w-4 shrink-0 text-[#B4501F]" />
        Request a callback
      </button>
      <p className="flex items-start gap-1.5 pt-1 text-xs leading-relaxed text-muted-foreground">
        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {open
            ? agentLive
              ? `A specialist is on duty now, or you can call, WhatsApp or request a callback (${openingHoursLabel}).`
              : `Call or WhatsApp us now, or request a callback (${openingHoursLabel}).`
            : `Our team is available ${openingHoursLabel}. You can WhatsApp us now or request a callback ${nextOpeningLabel()}.`}
        </span>
      </p>
    </div>
  );

  if (step === 'done') {
    const destination = isEmail ? email : prettyPhone(phone);
    const topicBit = topic && TOPIC_SENTENCE[topic] ? ` about your ${TOPIC_SENTENCE[topic]}` : '';
    const actionSentence = isEmail
      ? `email you at ${destination}${topicBit}`
      : `${isWhatsApp ? 'message you on WhatsApp' : 'call you'} on ${destination}${topicBit}`;
    return (
      <div className={`${asChip ? 'col-span-full w-full' : 'mx-3'} mb-2 space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-6 text-center`}>
        <div className="flex flex-col items-center gap-3">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600">
            <Check className="h-7 w-7 text-white" strokeWidth={3} />
          </span>
          <p className="text-lg font-bold text-foreground">Thanks! We've got it.</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            One of our team will {actionSentence}.
          </p>
        </div>
        <div className="border-t border-emerald-200 pt-4">
          <p className="flex items-start justify-center gap-2 text-xs leading-relaxed text-muted-foreground">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
            <span>
              Our team is available <span className="font-semibold text-foreground">{openingHoursLabel}</span>.
              <br />
              We'll be in touch as soon as possible.
            </span>
          </p>
        </div>
        <div className="space-y-2 border-t border-emerald-200 pt-4 text-left">
          <p className="text-xs font-bold text-foreground">Need to change anything?</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep('number');
            }}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/50 bg-background text-sm font-bold text-foreground transition-colors hover:bg-[#FDEBDF]"
          >
            <Pencil className="h-4 w-4 shrink-0 text-[#B4501F]" />
            Update my details
          </button>
          <button
            type="button"
            onClick={() => setStep('closed')}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-input bg-background text-sm font-bold text-foreground transition-colors hover:bg-muted"
          >
            <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
            Continue chatting
          </button>
        </div>
      </div>
    );
  }

  if (step === 'closed') {
    if (asChip) {
      return (
        <button
          type="button"
          onClick={() => setStep('method')}
          title="All our agents are busy - leave your number or email and we'll call, WhatsApp or email you back"
          className="flex min-w-0 items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-bold text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
        >
          <MessageCircle className="h-4 w-4 shrink-0 text-[#B4501F]" />
          <span className="truncate">Message me back</span>
        </button>
      );
    }

    if (collapsed) {
      return (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="mx-3 mb-2 flex w-[calc(100%-1.5rem)] items-center gap-2 rounded-xl bg-[#FDEBDF] px-3 py-1.5 text-left transition-colors hover:bg-[#FBE0CE]"
          aria-expanded={false}
        >
          <MessageCircle className="h-3.5 w-3.5 shrink-0 text-[#B4501F]" />
          <span className="flex-1 truncate text-xs font-bold text-foreground">
            All our agents are busy - leave your number or email and we'll get back to you
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#B4501F]" />
        </button>
      );
    }

    return (
      <div className="mx-3 mb-2 rounded-2xl bg-[#FDEBDF] px-3.5 py-3">
        {methodList}
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="mt-2 w-full text-center text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Hide
        </button>
      </div>
    );
  }

  return (
    <div
      className={`${asChip ? 'col-span-full w-full' : 'mx-3'} mb-2 rounded-2xl border border-primary/40 bg-card p-4 shadow-sm`}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-base font-bold text-foreground">
          <MessageCircle className="h-4 w-4 shrink-0 text-primary" />
          {step === 'method'
            ? 'Get in touch'
            : step === 'claimsInfo'
              ? 'Making a claim'
              : 'No problem!'}
        </p>
        <button
          onClick={() => {
            setStep('closed');
            setError(null);
          }}
          aria-label="Close message back request"
          className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {step === 'method' ? (
        methodList
      ) : step === 'claimsInfo' ? (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Our Claims team is open <span className="font-semibold text-foreground">Monday to Friday, 9am to 5pm</span>.
            The quickest way to start a claim is online:
          </p>
          <a
            href="https://buyawarranty.co.uk/make-a-claim/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-base font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Make a claim online
          </a>
          <div className="space-y-1.5 text-sm">
            <a href="tel:03302295045" className="flex items-center gap-2 font-bold text-[#B4501F] underline underline-offset-2">
              <Phone className="h-4 w-4 shrink-0" />
              Claims line: 0330 229 5045
            </a>
            <a href="mailto:claims@buyawarranty.co.uk" className="flex items-center gap-2 font-bold text-[#B4501F] underline underline-offset-2">
              <Mail className="h-4 w-4 shrink-0" />
              claims@buyawarranty.co.uk
            </a>
          </div>
          <button
            type="button"
            onClick={() => setStep('number')}
            className="h-10 w-full rounded-xl border border-input bg-background text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Back
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isValid) {
              setError(isEmail ? 'Enter a valid email address' : 'Enter a valid UK mobile or landline number');
              return;
            }
            void submit();
          }}
          className="space-y-3"
        >
          <p className="text-sm leading-relaxed text-muted-foreground">
            I can arrange for a specialist to get back to you.
          </p>

          <div className="space-y-2">
            <span className="block text-sm font-bold text-foreground">How would you like us to contact you?</span>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'call' as Preference, label: 'Call me', Icon: PhoneCall },
                { key: 'whatsapp' as Preference, label: 'WhatsApp me', Icon: MessageCircle },
                { key: 'email' as Preference, label: 'Email me', Icon: Mail },
              ]).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setPreference(key);
                    setError(null);
                    setTouched(false);
                  }}
                  aria-pressed={preference === key}
                  className={`flex h-16 flex-col items-center justify-center gap-1 rounded-xl border px-1 text-xs font-bold transition-colors ${
                    preference === key
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background text-foreground hover:border-primary/40 hover:bg-muted'
                  }`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${key === 'whatsapp' && preference !== key ? 'text-emerald-600' : ''}`} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={isEmail ? 'cb-email' : 'cb-phone'} className="block text-sm font-bold text-foreground">
              {isEmail ? 'Please enter your email address' : 'Please enter your phone number'}
            </label>
            {(() => {
              const fieldValue = isEmail ? email : phone;
              const showInvalid = touched && fieldValue.trim().length > 0 && !isValid;
              const fieldClass = `h-12 w-full rounded-xl border bg-background pr-10 text-base text-foreground outline-none placeholder:text-muted-foreground/70 focus:ring-2 ${
                isValid
                  ? 'border-emerald-500 focus:border-emerald-500 focus:ring-emerald-500/20'
                  : showInvalid
                    ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
                    : 'border-input focus:border-primary focus:ring-primary/20'
              }`;
              return (
                <>
                  {isEmail ? (
                    <div className="relative">
                      <input
                        id="cb-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value.slice(0, 160));
                          setError(null);
                        }}
                        onBlur={() => setTouched(true)}
                        placeholder="alex@example.com"
                        aria-label="Your email address"
                        aria-invalid={showInvalid}
                        className={`${fieldClass} px-3`}
                      />
                      {isValid && (
                        <Check className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-600" strokeWidth={3} />
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base" aria-hidden>
                        🇬🇧
                      </span>
                      <input
                        id="cb-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        autoFocus
                        value={phone}
                        onChange={(e) => {
                          setPhone(capUkPhone(e.target.value));
                          setError(null);
                        }}
                        onBlur={() => setTouched(true)}
                        placeholder="07123 456789"
                        aria-label={isWhatsApp ? 'Your WhatsApp number' : 'Your phone number'}
                        aria-invalid={showInvalid}
                        className={`${fieldClass} pl-10`}
                      />
                      {isValid && (
                        <Check className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-600" strokeWidth={3} />
                      )}
                    </div>
                  )}
                  {showInvalid && (
                    <p className="text-xs font-medium text-destructive">
                      {isEmail ? 'That email address doesn\'t look right - check it and try again.' : 'Enter a valid UK mobile or landline number.'}
                    </p>
                  )}
                </>
              );
            })()}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {isEmail
                ? "We'll use this email to get back to you."
                : `We'll use this number to ${isWhatsApp ? 'message' : 'call'} you back.`}
            </p>
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-bold text-foreground">
              What can we help you with? <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <button
              type="button"
              onClick={() => setTopic(topic === 'warranty_purchase' ? null : 'warranty_purchase')}
              aria-pressed={topic === 'warranty_purchase'}
              className={`flex h-11 w-full items-center justify-center rounded-xl border px-3 text-sm font-bold transition-colors ${
                topic === 'warranty_purchase'
                  ? 'border-primary/50 bg-[#FDEBDF] text-foreground'
                  : 'border-input bg-background text-foreground hover:border-primary/40 hover:bg-muted'
              }`}
            >
              Warranty purchase
            </button>
            <button
              type="button"
              onClick={() => setTopic(topic === 'existing_policy' ? null : 'existing_policy')}
              aria-pressed={topic === 'existing_policy'}
              className={`flex h-11 w-full items-center justify-center rounded-xl border px-3 text-sm font-bold transition-colors ${
                topic === 'existing_policy'
                  ? 'border-primary/50 bg-[#FDEBDF] text-foreground'
                  : 'border-input bg-background text-foreground hover:border-primary/40 hover:bg-muted'
              }`}
            >
              Existing policy question
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStep('claimsInfo')}
                className="flex h-11 items-center justify-center rounded-xl border border-input bg-background px-3 text-sm font-bold text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
              >
                Claims
              </button>
              <button
                type="button"
                onClick={() => setTopic(topic === 'general' ? null : 'general')}
                aria-pressed={topic === 'general'}
                className={`flex h-11 items-center justify-center rounded-xl border px-3 text-sm font-bold transition-colors ${
                  topic === 'general'
                    ? 'border-primary/50 bg-[#FDEBDF] text-foreground'
                    : 'border-input bg-background text-foreground hover:border-primary/40 hover:bg-muted'
                }`}
              >
                General enquiry
              </button>
            </div>
            <button
              type="button"
              onClick={() => setTopic(topic === 'other' ? null : 'other')}
              aria-pressed={topic === 'other'}
              className={`flex h-11 w-full items-center justify-center rounded-xl border px-3 text-sm font-bold transition-colors ${
                topic === 'other'
                  ? 'border-primary/50 bg-[#FDEBDF] text-foreground'
                  : 'border-input bg-background text-foreground hover:border-primary/40 hover:bg-muted'
              }`}
            >
              Something else
            </button>
          </div>

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={!isValid || submitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEmail ? (
              'Request my email'
            ) : isWhatsApp ? (
              'Request my WhatsApp'
            ) : (
              'Request my callback'
            )}
          </button>
        </form>
      )}
    </div>
  );
}

export default CallMeBackPanel;
