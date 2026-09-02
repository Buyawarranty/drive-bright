import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { OptimizedImage } from '@/components/OptimizedImage';
import buyawarrantyLogo from '@/assets/buyawarranty-logo.webp';
import TrustpilotMicroWidget from '@/components/TrustpilotMicroWidget';
import { CLAIMS_PHONE, CLAIMS_PHONE_TEL, CLAIMS_EMAIL } from '@/constants/contact';
import {
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Gavel,
  AlertCircle,
  Lock,
  BadgeCheck,
  Check,
  Phone,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';

// Worldpay Hosted Payment Page link is returned by the edge function after
// garage details are saved. The customer is redirected to that unique URL.

interface InspectionRequest {
  id: string;
  customer_name: string | null;
  customer_email: string;
  customer_phone: string | null;
  vehicle_registration: string | null;
  claim_reason: string | null;
  inspection_company: string;
  fee_amount: number;
  status: string;
  paid_at: string | null;
  garage_name: string | null;
  garage_contact: string | null;
  garage_phone: string | null;
  garage_address: string | null;
  vehicle_location: string | null;
  current_mileage: number | null;
  availability_notes: string | null;
  additional_notes: string | null;
}

type FormState = {
  garageName: string;
  garageContact: string;
  garagePhone: string;
  garageAddress: string;
  vehicleLocation: string;
  currentMileage: string;
  availabilityNotes: string;
  additionalNotes: string;
};

type ErrorKey = 'garageName' | 'garagePhone' | 'garageAddress' | 'accepted';

const INPUT_BASE =
  'w-full px-3 py-2.5 border rounded-md text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 transition-colors';
const INPUT_OK = 'border-slate-300 focus:ring-[#1A2B4A]/30 focus:border-[#1A2B4A]';
const INPUT_ERROR = 'border-red-500 bg-red-50/40 focus:ring-red-300 focus:border-red-500';

// Light-touch UK phone formatting: keeps digits (and a leading +), groups readably.
const formatUkPhone = (raw: string) => {
  const plus = raw.trim().startsWith('+');
  const digits = raw.replace(/[^0-9]/g, '').slice(0, plus ? 13 : 11);
  if (!digits) return plus ? '+' : '';
  if (plus) {
    return `+${digits.replace(/(\d{2})(\d{4})(\d{0,6})/, (_m, a, b, c) => [a, b, c].filter(Boolean).join(' '))}`;
  }
  if (digits.startsWith('07')) {
    return digits.replace(/(\d{5})(\d{0,6})/, (_m, a, b) => [a, b].filter(Boolean).join(' '));
  }
  if (digits.startsWith('020') || digits.startsWith('011') || digits.startsWith('012') || digits.startsWith('013')) {
    return digits.replace(/(\d{4})(\d{0,3})(\d{0,4})/, (_m, a, b, c) => [a, b, c].filter(Boolean).join(' '));
  }
  return digits.replace(/(\d{5})(\d{0,6})/, (_m, a, b) => [a, b].filter(Boolean).join(' '));
};

// Uppercase anything that looks like a UK postcode inside a free-text address.
const capitalisePostcodes = (value: string) =>
  value.replace(/\b([a-z]{1,2}\d{1,2}[a-z]?)\s*(\d[a-z]{2})\b/gi, (_m, out, inn) => `${String(out).toUpperCase()} ${String(inn).toUpperCase()}`);

const formatMileage = (raw: string) => {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 7);
  return digits ? Number(digits).toLocaleString('en-GB') : '';
};

const scrollFieldIntoView = (e: React.FocusEvent<HTMLElement>) => {
  // Keeps the focused field visible when the mobile keyboard opens.
  const el = e.currentTarget;
  window.setTimeout(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 250);
};

const IndependentInspection: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const paidFlag = searchParams.get('paid') === '1';
  const cancelled = searchParams.get('cancelled') === '1';

  const [request, setRequest] = useState<InspectionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  // The vehicle may be sat at a garage or at the customer's own address
  const [locationType, setLocationType] = useState<'garage' | 'home'>('garage');
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<ErrorKey, string>>>({});
  const [form, setForm] = useState<FormState>({
    garageName: '',
    garageContact: '',
    garagePhone: '',
    garageAddress: '',
    vehicleLocation: '',
    currentMileage: '',
    availabilityNotes: '',
    additionalNotes: '',
  });

  const setField = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as ErrorKey];
        return next;
      });
    }
  };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-inspection-request', {
        body: { token },
      });
      if (fnError || !data?.request) {
        setError('This link is invalid or has expired.');
      } else {
        const r = data.request as InspectionRequest;
        setRequest(r);
        setForm((f) => ({
          ...f,
          garageName: r.garage_name || '',
          garageContact: r.garage_contact || '',
          garagePhone: r.garage_phone || '',
          garageAddress: r.garage_address || '',
          vehicleLocation: r.vehicle_location || '',
          currentMileage: r.current_mileage ? Number(r.current_mileage).toLocaleString('en-GB') : '',
          availabilityNotes: r.availability_notes || '',
          additionalNotes: r.additional_notes || '',
        }));
      }
    } catch {
      setError('Something went wrong loading your inspection request.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Return from an in-page Worldpay 3-D Secure challenge
  const wp3dsReturn = searchParams.get('wp3ds') === '1';
  const wp3dsRef = searchParams.get('ref');
  useEffect(() => {
    if (!wp3dsReturn || !token) return;
    // If we're inside the bank's challenge iframe, tell the parent and stop.
    if (window.self !== window.top) {
      window.parent.postMessage('wp3ds-done', window.location.origin);
      return;
    }
    if (wp3dsRef) {
      (async () => {
        await supabase.functions.invoke('worldpay-payment-status', {
          body: { token, transactionReference: wp3dsRef },
        });
        await load();
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wp3dsReturn, wp3dsRef, token]);

  // Confirm payment on return from the Worldpay payment page
  useEffect(() => {
    if (!paidFlag || !token) return;
    const ref = searchParams.get('ref');
    (async () => {
      await supabase.functions.invoke('worldpay-payment-status', { body: { token, transactionReference: ref } });
      await load();
    })();
  }, [paidFlag, searchParams, token, load]);

  const isAtGarage = locationType === 'garage';

  const validate = () => {
    const next: Partial<Record<ErrorKey, string>> = {};
    if (isAtGarage && !form.garageName.trim()) next.garageName = 'Please tell us the garage name';
    if (!form.garagePhone.trim()) next.garagePhone = 'We need a phone number for the garage';
    if (!form.garageAddress.trim()) next.garageAddress = 'Please give the full garage address';
    if (!accepted) next.accepted = 'Please confirm you accept the inspection terms';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) {
      toast.error('Please complete the highlighted fields');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('submit-inspection-request', {
        body: {
          token,
          ...form,
          currentMileage: form.currentMileage.replace(/[^0-9]/g, ''),
          acceptedTerms: true,
        },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.checkout_url) {
        // Details saved — send the customer to the secure Worldpay payment page.
        setCheckoutUrl(data.checkout_url);
        setDetailsSaved(true);
        setSubmitting(false);
        window.location.href = data.checkout_url;
        return;
      }
      throw new Error(data?.error || 'Could not start payment');
    } catch (err: any) {
      toast.error(err?.message || 'Could not start payment. Please try again.');
      setSubmitting(false);
    }
  };

  const isPaid = Boolean(request?.paid_at) || request?.status === 'paid';
  const fee = Number(request?.fee_amount || 140);

  const detailsComplete = Boolean(form.garageName.trim() && form.garagePhone.trim() && form.garageAddress.trim());
  const currentStep = useMemo(() => {
    if (isPaid) return 3;
    if (detailsComplete && accepted) return 3;
    if (detailsComplete) return 2;
    return 1;
  }, [isPaid, detailsComplete, accepted]);

  const Header = (
    <header className="bg-white border-b border-[#E2E8F0]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center">
          <OptimizedImage src={buyawarrantyLogo} alt="Buy a Warranty" className="h-8 sm:h-10 w-auto" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href={CLAIMS_PHONE_TEL}
            className="inline-flex items-center gap-2 rounded-full bg-white border border-[#E2E8F0] px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#1A2B4A] shadow-sm"
          >
            <Phone className="h-3.5 w-3.5 text-[#E8541A]" />
            {CLAIMS_PHONE}
          </a>
        </div>
      </div>
    </header>
  );

  const PageFooter = (
    <footer className="bg-white border-t border-[#E2E8F0] mt-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600">
        <p>Buy a Warranty Claims Department</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <a href={CLAIMS_PHONE_TEL} className="inline-flex items-center gap-1.5 hover:text-[#1A2B4A]">
            <Phone className="h-4 w-4 text-[#E8541A]" /> {CLAIMS_PHONE}
          </a>
          <a href={`mailto:${CLAIMS_EMAIL}`} className="inline-flex items-center gap-1.5 hover:text-[#1A2B4A]">
            <Mail className="h-4 w-4 text-[#E8541A]" /> {CLAIMS_EMAIL}
          </a>
        </div>
      </div>
    </footer>
  );

  // Rendered inside the bank's 3DS iframe — parent page handles completion.
  if (wp3dsReturn && window.self !== window.top) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex flex-col">
        {Header}
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#1A2B4A]" />
        </div>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex flex-col">
        {Header}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-6 text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <h1 className="text-lg font-bold text-[#1A2B4A]">Link unavailable</h1>
            <p className="text-sm text-slate-600">{error}</p>
            <p className="text-sm text-slate-600">
              Please call us on{' '}
              <a href={CLAIMS_PHONE_TEL} className="font-semibold text-[#E8541A]">
                {CLAIMS_PHONE}
              </a>{' '}
              and we'll help.
            </p>
          </div>
        </div>
        {PageFooter}
      </div>
    );
  }

  const steps = ['Your details', 'Confirm terms', 'Payment'];

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex flex-col">
      {Header}

      {/* Progress indicator */}
      <div className="bg-white border-b border-[#E2E8F0]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3">
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[#E8541A] transition-all duration-300"
              style={{ width: `${(currentStep / steps.length) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            {steps.map((label, i) => {
              const n = i + 1;
              const done = n < currentStep || (isPaid && n <= steps.length);
              const active = n === currentStep;
              return (
                <div
                  key={label}
                  className={`flex flex-col items-center text-center ${
                    done || active ? 'text-[#00B67A] font-semibold' : 'text-slate-400'
                  }`}
                >
                  <div
                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${
                      done || active ? 'bg-[#00B67A] text-white' : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" /> : n}
                  </div>
                  <span className="text-xs font-medium px-1">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1A2B4A]">
            {request.customer_name
              ? `Hi ${request.customer_name.split(' ')[0]}, let's arrange your independent inspection`
              : 'Your independent inspection'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Just tell us where the vehicle is, then pay the £{fee.toFixed(0)} inspection fee securely by card. An independent
            engineer will inspect the vehicle and give the final decision on your claim.
          </p>
        </div>

        {isPaid ? (
          <div className="max-w-2xl bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-6 sm:p-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-[#00B67A] mx-auto" />
            <h2 className="text-xl font-bold text-[#1A2B4A]">Payment received — thank you</h2>
            <p className="text-sm text-slate-600">
              Your inspection has been booked with <strong className="text-[#1A2B4A]">{request.inspection_company}</strong>. They
              will contact the garage directly to arrange a visit. Inspections take on average 7 to 14 working days.
            </p>
            <p className="text-sm text-slate-600">We'll be in touch as soon as the engineer's report is available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column — form */}
            <div className="lg:col-span-2 space-y-5">
              {cancelled && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  Payment was cancelled. Your details are saved — you can pay whenever you're ready.
                </div>
              )}

              {/* How it works */}
              <section className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-5 sm:p-6">
                <h2 className="text-base font-bold text-[#1A2B4A] mb-4">How the inspection works</h2>
                <div className="space-y-4 text-sm text-slate-600">
                  {[
                    {
                      Icon: ShieldCheck,
                      body: (
                        <>
                          Your inspection is carried out by{' '}
                          <strong className="text-[#1A2B4A]">{request.inspection_company}</strong>, an independent engineering
                          firm assigned by us based on availability in your area.
                        </>
                      ),
                    },
                    {
                      Icon: Clock,
                      body: (
                        <>
                          Inspections take on average <strong className="text-[#1A2B4A]">7 to 14 working days</strong> to
                          complete.
                        </>
                      ),
                    },
                    {
                      Icon: Gavel,
                      body: (
                        <>
                          The engineer's findings are the <strong className="text-[#1A2B4A]">full and final decision</strong> on
                          this claim and are binding on both you and Buy a Warranty.
                        </>
                      ),
                    },
                  ].map(({ Icon, body }, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#FEF0E8] flex items-center justify-center shrink-0">
                        <Icon className="h-4.5 w-4.5 text-[#E8541A]" />
                      </div>
                      <p className="leading-relaxed pt-1.5">{body}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Garage details */}
              <section className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-5 sm:p-6 space-y-4">
                <h2 className="text-base font-bold text-[#1A2B4A]">Where is the vehicle?</h2>

                {/* The vehicle can be at a garage or at the customer's own address */}
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { key: 'garage', label: 'At a garage' },
                    { key: 'home', label: 'At my address' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        setLocationType(opt.key);
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.garageName;
                          return next;
                        });
                      }}
                      className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                        locationType === opt.key
                          ? 'border-[#E8541A] bg-[#FEF0E8] text-[#1A2B4A]'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {isAtGarage && (
                    <div>
                      <label htmlFor="garageName" className="block text-sm font-medium text-[#1A2B4A] mb-1.5">
                        Garage name *
                      </label>
                      <input
                        id="garageName"
                        value={form.garageName}
                        onFocus={scrollFieldIntoView}
                        onChange={(e) => setField('garageName', e.target.value)}
                        placeholder="e.g. Smith's Autos"
                        aria-invalid={Boolean(errors.garageName)}
                        className={`${INPUT_BASE} ${errors.garageName ? INPUT_ERROR : INPUT_OK}`}
                      />
                      {errors.garageName && <p className="mt-1 text-xs font-medium text-red-600">{errors.garageName}</p>}
                    </div>
                  )}

                  <div>
                    <label htmlFor="garagePhone" className="block text-sm font-medium text-[#1A2B4A] mb-1.5">
                      {isAtGarage ? 'Garage phone *' : 'Your contact phone *'}
                    </label>

                    <input
                      id="garagePhone"
                      type="tel"
                      inputMode="tel"
                      value={form.garagePhone}
                      onFocus={scrollFieldIntoView}
                      onChange={(e) => setField('garagePhone', formatUkPhone(e.target.value))}
                      placeholder="01234 567890"
                      aria-invalid={Boolean(errors.garagePhone)}
                      className={`${INPUT_BASE} ${errors.garagePhone ? INPUT_ERROR : INPUT_OK}`}
                    />
                    {errors.garagePhone && <p className="mt-1 text-xs font-medium text-red-600">{errors.garagePhone}</p>}
                  </div>

                  <div>
                    <label htmlFor="garageContact" className="block text-sm font-medium text-[#1A2B4A] mb-1.5">
                      Contact at garage
                    </label>
                    <input
                      id="garageContact"
                      value={form.garageContact}
                      onFocus={scrollFieldIntoView}
                      onChange={(e) => setField('garageContact', e.target.value)}
                      placeholder="Name of the person to ask for"
                      className={`${INPUT_BASE} ${INPUT_OK}`}
                    />
                  </div>

                  <div>
                    <label htmlFor="currentMileage" className="block text-sm font-medium text-[#1A2B4A] mb-1.5">
                      Current mileage
                    </label>
                    <input
                      id="currentMileage"
                      inputMode="numeric"
                      value={form.currentMileage}
                      onFocus={scrollFieldIntoView}
                      onChange={(e) => setField('currentMileage', formatMileage(e.target.value))}
                      placeholder="e.g. 84,500"
                      className={`${INPUT_BASE} ${INPUT_OK}`}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="garageAddress" className="block text-sm font-medium text-[#1A2B4A] mb-1.5">
                    Garage address *
                  </label>
                  <textarea
                    id="garageAddress"
                    rows={2}
                    value={form.garageAddress}
                    onFocus={scrollFieldIntoView}
                    onChange={(e) => setField('garageAddress', capitalisePostcodes(e.target.value))}
                    placeholder="Street, town, postcode"
                    aria-invalid={Boolean(errors.garageAddress)}
                    className={`${INPUT_BASE} ${errors.garageAddress ? INPUT_ERROR : INPUT_OK}`}
                  />
                  {errors.garageAddress && <p className="mt-1 text-xs font-medium text-red-600">{errors.garageAddress}</p>}
                </div>

                <div>
                  <label htmlFor="vehicleLocation" className="block text-sm font-medium text-[#1A2B4A] mb-1.5">
                    Anything the engineer needs to know to find the vehicle?
                  </label>
                  <input
                    id="vehicleLocation"
                    value={form.vehicleLocation}
                    onFocus={scrollFieldIntoView}
                    onChange={(e) => setField('vehicleLocation', e.target.value)}
                    placeholder="e.g. Vehicle in rear workshop, ask at reception"
                    className={`${INPUT_BASE} ${INPUT_OK}`}
                  />
                </div>

                <div>
                  <label htmlFor="availabilityNotes" className="block text-sm font-medium text-[#1A2B4A] mb-1.5">
                    Best days or times for the inspection
                  </label>
                  <input
                    id="availabilityNotes"
                    value={form.availabilityNotes}
                    onFocus={scrollFieldIntoView}
                    onChange={(e) => setField('availabilityNotes', e.target.value)}
                    placeholder="e.g. Weekday mornings"
                    className={`${INPUT_BASE} ${INPUT_OK}`}
                  />
                </div>

                <div>
                  <label htmlFor="additionalNotes" className="block text-sm font-medium text-[#1A2B4A] mb-1.5">
                    Anything else about the fault
                  </label>
                  <textarea
                    id="additionalNotes"
                    rows={3}
                    value={form.additionalNotes}
                    onFocus={scrollFieldIntoView}
                    onChange={(e) => setField('additionalNotes', e.target.value)}
                    placeholder="Optional"
                    className={`${INPUT_BASE} ${INPUT_OK}`}
                  />
                </div>

                {/* Terms — compulsory */}
                <label
                  htmlFor="accept"
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                    errors.accepted
                      ? 'border-red-500 bg-red-50/60'
                      : accepted
                        ? 'border-green-400 bg-green-50/50'
                        : 'border-[#E8541A] bg-[#FEF0E8]'
                  }`}
                >
                  <input
                    id="accept"
                    type="checkbox"
                    required
                    aria-required="true"
                    aria-invalid={Boolean(errors.accepted)}
                    checked={accepted}
                    onChange={(e) => {
                      setAccepted(e.target.checked);
                      if (e.target.checked) {
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.accepted;
                          return next;
                        });
                      }
                    }}
                    className="mt-0.5 h-5 w-5 rounded border-slate-400 text-[#E8541A] focus:ring-[#E8541A]"
                  />
                  <span className="text-sm font-bold text-[#1A2B4A] leading-relaxed">
                    I understand the independent inspection is completed by {request.inspection_company}, takes on average 7 to
                    14 working days, and I accept the engineer's findings as the full and final decision on this claim.{' '}
                    <span className="text-[#E8541A]">*</span>
                    <span className="block mt-1 text-xs font-bold text-[#E8541A]">
                      Please confirm you accept the inspection terms — this is required
                    </span>
                    {errors.accepted && (
                      <span className="block mt-1 text-xs font-bold text-red-600">{errors.accepted}</span>
                    )}
                  </span>
                </label>

              </section>
            </div>

            {/* Right column — sticky summary */}
            <aside className="lg:col-span-1">
              <div className="lg:sticky lg:top-6 space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E2E8F0]">
                    <h2 className="text-base font-bold text-[#1A2B4A]">Inspection summary</h2>
                  </div>
                  <div className="p-5 space-y-3 text-sm">
                    {request.vehicle_registration && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-600">Vehicle</span>
                        <span
                          className="font-mono font-bold text-xs uppercase px-2 py-1 rounded border border-black"
                          style={{ backgroundColor: '#FCD34D' }}
                        >
                          {request.vehicle_registration.toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-600">Engineer</span>
                      <span className="font-medium text-[#1A2B4A] text-right">{request.inspection_company}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">Approximate turnaround</span>
                      <span className="font-medium text-[#1A2B4A]">7–21 working days</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      You'll be given direct contact details of the independent inspection company.
                    </p>


                    <div className="h-px bg-[#E2E8F0]" />

                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-[#1A2B4A]">Inspection fee</span>
                      <span className="text-xl font-bold text-[#1A2B4A]">£{fee.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-slate-500">Paid directly to the independent inspection company.</p>

                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F4F6F8] p-3">
                      <TrustpilotMicroWidget />
                    </div>


                    <button
                      type="button"
                      onClick={() => {
                        if (detailsSaved && checkoutUrl) {
                          window.location.href = checkoutUrl;
                        } else {
                          submit();
                        }
                      }}
                      disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-[#E8541A] hover:bg-[#cf471a] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors shadow-sm"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          {detailsSaved ? `Continue to secure payment · £${fee.toFixed(2)}` : `Pay now · £${fee.toFixed(2)}`}
                        </>
                      )}
                    </button>
                    <p className="text-xs text-center text-slate-500">
                      {detailsSaved
                        ? 'Your details are saved. You\u2019ll be taken to Worldpay\u2019s secure payment page.'
                        : 'You\u2019ll be taken to Worldpay\u2019s secure payment page to enter your card details.'}
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-5 text-sm text-slate-600">
                  <p className="font-semibold text-[#1A2B4A] mb-1">Need a hand?</p>
                  <p>
                    Call the claims team on{' '}
                    <a href={CLAIMS_PHONE_TEL} className="font-semibold text-[#E8541A]">
                      {CLAIMS_PHONE}
                    </a>
                    .
                  </p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      {PageFooter}
      {/* Breathing room so the button never sits under mobile browser chrome */}
      <div className="h-6 lg:hidden" />
    </div>
  );
};

export default IndependentInspection;
