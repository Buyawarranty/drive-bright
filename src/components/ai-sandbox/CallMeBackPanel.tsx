import { useMemo, useState } from 'react';
import { PhoneCall, Phone, Check, Loader2, X, Clock, ChevronDown, ChevronUp } from 'lucide-react';
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

type Step = 'closed' | 'number' | 'confirm' | 'done';

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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [whenLabel, setWhenLabel] = useState<string>('');

  const open = isTeamOpenNow();
  const isValid = useMemo(() => validUkPhone(phone), [phone]);

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
          registration: registration ?? null,
          quotedPrice: quotedPrice ?? null,
          guestToken: guestToken ?? null,
          threadId: threadId ?? null,
          source: source ?? 'website-chat',
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.message ?? "We couldn't save that — please call 0330 229 5040.");
        return;
      }
      if (data.suppressed) {
        setError(data.message ?? 'Please give us a ring on 0330 229 5040 and we\'ll help straight away.');
        return;
      }
      setWhenLabel(data.when_label ?? (open ? 'in the next few minutes' : `from 9am ${nextOpeningLabel()}`));
      setStep('done');
    } catch {
      setError('Network problem — please try again, or call 0330 229 5040.');
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
          Call booked for {prettyPhone(phone)}
        </p>
        <p className="mt-1 leading-relaxed">
          {open
            ? `A UK specialist will ring you ${whenLabel}. Have any competitor quote handy — we'll beat it.`
            : `We're closed right now, so you're first in the queue ${whenLabel} (${openingHoursLabel}).`}
        </p>
      </div>
    );
  }

  if (step === 'closed') {
    if (asChip) {
      return (
        <button
          type="button"
          onClick={() => setStep('number')}
          title={open ? 'Request a call back' : `Request a call back — we ring you ${nextOpeningLabel()}`}
          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
        >
          <PhoneCall className="h-3.5 w-3.5 shrink-0 text-[#B4501F]" />
          <span className="truncate">Call me back</span>
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
          <PhoneCall className="h-3.5 w-3.5 shrink-0 text-[#B4501F]" />
          <span className="flex-1 truncate text-xs font-bold text-foreground">
            Prefer to talk? Request a call back
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#B4501F]" />
        </button>
      );
    }

    return (
      <div className="mx-3 mb-2 flex items-center gap-3 rounded-2xl bg-[#FDEBDF] px-3.5 py-3">
        <PhoneCall className="h-5 w-5 shrink-0 text-[#B4501F]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">Prefer to talk?</p>
          <p className="text-xs text-muted-foreground">
            {open
              ? 'Request a call back and a UK specialist rings you in minutes.'
              : `Request a call back — we'll ring you ${nextOpeningLabel()} (${openingHoursLabel}).`}
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
          onClick={() => setStep('number')}
          variant="outline"
          className="h-10 shrink-0 rounded-xl border-border bg-background text-sm font-bold shadow-sm hover:bg-muted"
        >
          Call me back
        </Button>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse call back prompt"
          className="shrink-0 rounded p-0.5 text-[#B4501F] hover:text-foreground"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>
    );
  }



  return (
    <div className={`${asChip ? 'w-full' : 'mx-3'} mb-2 rounded-lg border border-primary/40 bg-primary/5 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <PhoneCall className="h-4 w-4 text-primary" />
          {step === 'number' ? 'Request a call back' : 'Confirm your number'}
        </p>
        <button
          onClick={() => {
            setStep('closed');
            setError(null);
          }}
          aria-label="Close call back request"
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {step === 'number' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isValid) setStep('confirm');
            else setError('Enter a valid UK mobile or landline number');
          }}
          className="space-y-2"
        >
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            autoFocus
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/[^\d +]/g, '').slice(0, 16));
              setError(null);
            }}
            placeholder="e.g. 07960 123 456"
            aria-label="Your phone number"
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            placeholder="Your first name (optional)"
            aria-label="Your first name"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          <Button type="submit" disabled={!isValid} className="h-10 w-full font-semibold">
            Continue
          </Button>
          <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {open ? 'Team is open now' : `Team's closed — calls start ${nextOpeningLabel()}`}
          </p>
        </form>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-foreground">
            Is <span className="font-semibold">{prettyPhone(phone)}</span> the right number
            {name ? `, ${name}` : ''}?
          </p>
          <p className="text-xs text-muted-foreground">
            {open
              ? 'We’ll ring you straight away — a UK specialist, no premium numbers.'
              : `We'll be closed until ${nextOpeningLabel()} — you'll be first in the queue when we open.`}
          </p>
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={submit} disabled={submitting} className="h-10 flex-1 font-semibold">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : open ? 'Yes, call me now' : 'Yes, book my call'}
            </Button>
            <Button
              variant="outline"
              className="h-10"
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
