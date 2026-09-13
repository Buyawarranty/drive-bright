import { useMemo, useState } from 'react';
import { PhoneCall, Phone, Check, Loader2, X, Clock, ChevronDown, ChevronUp, MessageCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isTeamOpenNow, nextOpeningLabel, openingHoursLabel } from '@/lib/aiSandbox/openingHours';
import { useSalesLineAvailable } from '@/hooks/useSalesLineAvailable';

const CALLBACK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sandbox-callback-request`;

/** UK mobile or landline. */
function validUkPhone(raw: string): boolean {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('44')) digits = `0${digits.slice(2)}`;
  return /^07\d{9}$/.test(digits) || /^0[12]\d{8,9}$/.test(digits) || /^03\d{9}$/.test(digits);
}

function prettyPhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  return raw;
}

function validEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

type Step = 'closed' | 'topic' | 'claimsInfo' | 'number' | 'confirm' | 'done';
type Preference = 'call' | 'whatsapp' | 'email';
type Topic = 'warranty_purchase' | 'general' | 'existing_policy' | 'other';

const TOPICS: { key: Topic; label: string }[] = [
  { key: 'warranty_purchase', label: 'Warranty purchase' },
  { key: 'general', label: 'General enquiry' },
  { key: 'existing_policy', label: 'Existing policy question' },
  { key: 'other', label: 'Something else' },
];

const TOPIC_LABELS: Record<Topic, string> = {
  warranty_purchase: 'Warranty purchase',
  general: 'General enquiry',
  existing_policy: 'Existing policy question',
  other: 'Something else',
};

export function CallMeBackPanel({
  guestToken,
  threadId,
  source,
  registration,
  quotedPrice,
  compact = false,
  asChip = false,
  autoOpen = false,
}: {
  guestToken?: string;
  threadId?: string;
  source?: string;
  registration?: string | null;
  quotedPrice?: number | null;
  compact?: boolean;
  /** Render the idle state as a small one-line chip (for the top action row). */
  asChip?: boolean;
  /** Render expanded straight away at the topic step (inline in the chat stream). */
  autoOpen?: boolean;
}) {
  const [step, setStep] = useState<Step>(autoOpen ? 'number' : 'closed');
  const [collapsed, setCollapsed] = useState(!autoOpen);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [preference, setPreference] = useState<Preference>('call');
  const [topic, setTopic] = useState<Topic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [whenLabel, setWhenLabel] = useState<string>('');

  const open = isTeamOpenNow();
  // Weekends: the phone line only shows while an agent is genuinely live.
  const showPhoneLine = useSalesLineAvailable();
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
          name,
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
        setError(data.message ?? 'Please give us a ring on 0330 229 5040 and we\'ll help straight away.');
        return;
      }
      setWhenLabel(data.when_label ?? (open ? 'shortly' : `from 9am ${nextOpeningLabel()}`));
      setStep('done');
    } catch {
      setError('Network problem - please try again, or call 0330 229 5040.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'done') {
    const contactLabel = isEmail ? 'Email' : isWhatsApp ? 'WhatsApp number' : 'Number';
    const destination = isEmail ? email : prettyPhone(phone);
    return (
      <div className={`${asChip ? '' : 'mx-3'} mb-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3.5 text-emerald-900`}>
        <p className="flex items-center gap-2 text-sm font-bold">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600">
            <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
          </span>
          All sorted - {contactLabel.toLowerCase()} saved
        </p>
        <p className="mt-2 text-xs leading-relaxed">
          <span className="font-semibold">{destination}</span>
          {topic ? ` · ${TOPIC_LABELS[topic]}` : ''}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed">
          {isEmail
            ? `A UK warranty specialist will email you ${open ? whenLabel : `${nextOpeningLabel()} - you're first in the queue`} (${openingHoursLabel}).`
            : open
              ? `A UK warranty specialist will ${isWhatsApp ? 'message you on WhatsApp' : 'ring you'} ${whenLabel}. Have any competitor quote handy - we'll beat it.`
              : `A warranty specialist will ${isWhatsApp ? 'WhatsApp' : 'call'} you back ${nextOpeningLabel()} - you're first in the queue (${openingHoursLabel}).`}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep('number');
            }}
            className="flex h-9 flex-1 items-center justify-center rounded-xl border border-emerald-400 bg-background text-xs font-bold text-emerald-900 transition-colors hover:bg-emerald-100"
          >
            Update details
          </button>
          <button
            type="button"
            onClick={() => setStep('closed')}
            className="flex h-9 flex-1 items-center justify-center rounded-xl bg-emerald-600 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
          >
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
          onClick={() => setStep('number')}
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
      <div className="mx-3 mb-2 flex items-center gap-3 rounded-2xl bg-[#FDEBDF] px-3.5 py-3">
        <MessageCircle className="h-5 w-5 shrink-0 text-[#B4501F]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">All our agents are busy right now</p>
          <p className="text-xs text-muted-foreground">
            {open
              ? 'Leave your number or email and a UK specialist will call, WhatsApp or email you back.'
              : `Leave your number or email - we'll call, WhatsApp or email you ${nextOpeningLabel()} (${openingHoursLabel}).`}
          </p>
          {open && showPhoneLine && (
            <a
              href="tel:03302295040"
              className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#B4501F] underline underline-offset-2"
            >
              <Phone className="h-3 w-3" />
              Or call us now on 0330 229 5040
            </a>
          )}
        </div>
        <Button
          onClick={() => setStep('number')}
          variant="outline"
          className="h-10 shrink-0 rounded-xl border-border bg-background text-sm font-bold shadow-sm hover:bg-muted"
        >
          Message me back
        </Button>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse message back prompt"
          className="shrink-0 rounded p-0.5 text-[#B4501F] hover:text-foreground"
        >
          <ChevronUp className="h-4 w-4" />
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
          {step === 'topic'
            ? "What's it about? (optional)"
            : step === 'claimsInfo'
              ? 'Making a claim'
              : step === 'number'
                ? 'Leave us your number or email'
                : 'Confirm your details'}
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

      {step === 'topic' ? (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Nearly done. What's your query about? It helps the right specialist get back to you, but you can skip it.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TOPICS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTopic(key);
                  setError(null);
                  setStep('confirm');
                }}
                className="flex h-11 items-center justify-center rounded-xl border border-input bg-background px-2 text-sm font-bold text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setStep('claimsInfo')}
              className="col-span-2 flex h-11 items-center justify-center rounded-xl border border-input bg-background px-2 text-sm font-bold text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
            >
              Claims
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setTopic(null);
              setError(null);
              setStep('confirm');
            }}
            className="w-full text-center text-xs font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Skip this step
          </button>
        </div>
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
              <MessageCircle className="h-4 w-4 shrink-0" />
              claims@buyawarranty.co.uk
            </a>
          </div>
          <Button variant="outline" className="h-10 w-full rounded-xl font-semibold" onClick={() => setStep('topic')}>
            Back
          </Button>
        </div>
      ) : step === 'number' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isValid) setStep('topic');
            else setError(isEmail ? 'Enter a valid email address' : 'Enter a valid UK mobile or landline number');
          }}
          className="space-y-3"
        >
          <p className="text-sm leading-relaxed text-muted-foreground">
            {open
              ? 'A UK warranty specialist will get back to you shortly, whichever way you prefer.'
              : `A warranty specialist will be back ${nextOpeningLabel()} - leave your details and you are first in the queue.`}
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
                  }}
                  aria-pressed={preference === key}
                  className={`flex h-12 items-center justify-center gap-1.5 rounded-xl border px-1 text-xs font-bold transition-colors sm:text-sm ${
                    preference === key
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background text-foreground hover:border-primary/40 hover:bg-muted'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${key === 'whatsapp' && preference !== key ? 'text-emerald-600' : ''}`} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor={isEmail ? 'cb-email' : 'cb-phone'} className="block text-xs font-semibold text-foreground">
              {isEmail ? 'Email address' : isWhatsApp ? 'WhatsApp number' : 'Phone number'}
            </label>
            {isEmail ? (
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
                placeholder="alex@example.com"
                aria-label="Your email address"
                className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            ) : (
              <input
                id="cb-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                autoFocus
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/[^\d +]/g, '').slice(0, 16));
                  setError(null);
                }}
                placeholder="07960 123456"
                aria-label={isWhatsApp ? 'Your WhatsApp number' : 'Your phone number'}
                className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {isEmail
                ? `We'll pass this to the team and they'll email you ${open ? 'shortly' : `when we're back ${nextOpeningLabel()}`}.`
                : `We'll pass this to the team and they'll ${isWhatsApp ? 'message you' : 'call you'} ${open ? 'shortly' : `when we're back ${nextOpeningLabel()}`}.`}
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cb-name" className="block text-xs font-semibold text-foreground">
              First name <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="cb-name"
              type="text"
              autoComplete="given-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 60))}
              placeholder="Alex"
              aria-label="Your first name"
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}

          <Button type="submit" disabled={!isValid} className="h-12 w-full rounded-xl text-base font-bold">
            Continue
          </Button>

          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {open
                ? `A warranty specialist is available now (${openingHoursLabel}).`
                : `Opening hours ${openingHoursLabel}.`}
            </span>
          </p>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-base text-foreground">
            {isEmail ? (
              <>Is <span className="font-bold">{email}</span> the right email{name ? `, ${name}` : ''}?</>
            ) : (
              <>Is <span className="font-bold">{prettyPhone(phone)}</span> the right number{name ? `, ${name}` : ''}?</>
            )}
          </p>
          {topic && (
            <p className="text-xs font-semibold text-muted-foreground">
              Query: <span className="text-foreground">{TOPIC_LABELS[topic]}</span>
            </p>
          )}
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isEmail
              ? `We will email you ${open ? 'shortly' : `${nextOpeningLabel()} - you will be first in the queue`} - a UK specialist, no premium numbers.`
              : open
                ? `We will ${isWhatsApp ? 'message you on WhatsApp' : 'ring you'} shortly - a UK specialist, no premium numbers.`
                : `A warranty specialist will ${isWhatsApp ? 'WhatsApp' : 'call'} you ${nextOpeningLabel()} - you will be first in the queue.`}
          </p>
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={submit} disabled={submitting} className="h-12 flex-1 rounded-xl text-base font-bold">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
            </Button>
            <Button
              variant="outline"
              className="h-12 rounded-xl font-semibold"
              disabled={submitting}
              onClick={() => setStep('number')}
            >
              Change
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CallMeBackPanel;
