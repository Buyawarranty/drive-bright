import { useMemo, useState } from 'react';
import { PhoneCall, Phone, Check, Loader2, X, Clock, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isTeamOpenNow, nextOpeningLabel, openingHoursLabel } from '@/lib/aiSandbox/openingHours';

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

type Step = 'closed' | 'topic' | 'claimsInfo' | 'number' | 'confirm' | 'done';
type Preference = 'call' | 'whatsapp';
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
}: {
  guestToken?: string;
  threadId?: string;
  source?: string;
  registration?: string | null;
  quotedPrice?: number | null;
  compact?: boolean;
  /** Render the idle state as a small one-line chip (for the top action row). */
  asChip?: boolean;
}) {
  const [step, setStep] = useState<Step>('closed');
  const [collapsed, setCollapsed] = useState(true);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [preference, setPreference] = useState<Preference>('call');
  const [topic, setTopic] = useState<Topic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [whenLabel, setWhenLabel] = useState<string>('');

  const open = isTeamOpenNow();
  const isValid = useMemo(() => validUkPhone(phone), [phone]);
  const isWhatsApp = preference === 'whatsapp';

  const submit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(CALLBACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
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
    return (
      <div className={`${asChip ? '' : 'mx-3'} mb-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900`}>
        <p className="flex items-center gap-1.5 font-semibold">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600">
            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
          </span>
          {isWhatsApp ? 'WhatsApp' : 'Call'} saved for {prettyPhone(phone)}
        </p>
        <p className="mt-1 leading-relaxed">
          {open
            ? `A UK warranty specialist will ${isWhatsApp ? 'message you on WhatsApp' : 'ring you'} ${whenLabel}. Have any competitor quote handy - we'll beat it.`
            : `A warranty specialist will ${isWhatsApp ? 'WhatsApp' : 'call'} you back ${nextOpeningLabel()} and you're first in the queue (${openingHoursLabel}).`}
        </p>
      </div>
    );
  }

  if (step === 'closed') {
    if (asChip) {
      return (
        <button
          type="button"
          onClick={() => setStep('topic')}
          title="All our agents are busy - leave your number and we'll call or WhatsApp you back"
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
            All our agents are busy - leave your number and we'll call you back
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
              ? 'Leave your number and a UK specialist will call or WhatsApp you back.'
              : `Leave your number - we'll call or WhatsApp you ${nextOpeningLabel()} (${openingHoursLabel}).`}
          </p>
          {open && (
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
          onClick={() => setStep('topic')}
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
            ? 'All our agents are busy right now'
            : step === 'claimsInfo'
              ? 'Making a claim'
              : step === 'number'
                ? 'Leave us your number'
                : 'Confirm your number'}
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
            Leave your number and we'll call or WhatsApp you back. First, what's your query about?
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TOPICS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTopic(key);
                  setError(null);
                  setStep('number');
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
            if (isValid) setStep('confirm');
            else setError('Enter a valid UK mobile or landline number');
          }}
          className="space-y-3"
        >
          <p className="text-sm leading-relaxed text-muted-foreground">
            {open
              ? 'Leave your number and a UK warranty specialist will get back to you shortly - by call or WhatsApp, whichever you prefer.'
              : `A warranty specialist will be back ${nextOpeningLabel()} - leave your number and you are first in the queue.`}
          </p>

          <div className="space-y-1.5">
            <label htmlFor="cb-phone" className="block text-xs font-semibold text-foreground">
              Phone number
            </label>
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
              aria-label="Your phone number"
              className="h-12 w-full rounded-xl border border-input bg-background px-3 text-base text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-foreground">How should we get back to you?</span>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: 'call' as Preference, label: 'Phone call', Icon: PhoneCall },
                { key: 'whatsapp' as Preference, label: 'WhatsApp', Icon: MessageCircle },
              ]).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPreference(key)}
                  aria-pressed={preference === key}
                  className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition-colors ${
                    preference === key
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-input bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
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
            Is <span className="font-bold">{prettyPhone(phone)}</span> the right number
            {name ? `, ${name}` : ''}?
          </p>
          {topic && (
            <p className="text-xs font-semibold text-muted-foreground">
              Query: <span className="text-foreground">{TOPIC_LABELS[topic]}</span>
            </p>
          )}
          <p className="text-sm leading-relaxed text-muted-foreground">
            {open
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
