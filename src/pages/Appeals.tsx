import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, Mail, Clock, CheckCircle, ArrowLeft, MessageSquare, ShieldCheck, Lock, Loader2, ClipboardList, Scale, AlertCircle, Check } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import WebsiteFooter from '@/components/WebsiteFooter';
import { CLAIMS_PHONE, CLAIMS_PHONE_TEL, CLAIMS_EMAIL, WHATSAPP_URL } from '@/constants/contact';

// Public claim-appeal form. Deliberately built to the exact same format as the
// public complaints form (/complaints/) — same hero, trust cards, two-column
// grid, field styling, inline validation ticks and confirmation panel.

const initialForm = {
  firstName: '',
  lastName: '',
  claimRef: '',
  registrationPlate: '',
  warrantyNumber: '',
  decisionDate: '',
  newEvidence: '',
  desiredOutcome: '',
  independentInspection: 'Yes please',
  preferredContactMethod: 'Email',
  confirmAccurate: false,
};

type FormState = typeof initialForm;

// We already hold the customer's contact details (email and phone) against their
// policy, so an appeal only needs their name plus the registration plate — the
// claim itself is based on the vehicle, so the plate is validated against our
// customer records before the appeal can be sent.
const validators: Record<string, (v: any, f: FormState) => string> = {
  firstName: (v) => (!String(v).trim() ? 'Please enter your name' : ''),
  lastName: () => '',
  claimRef: () => '',
  registrationPlate: (v) => {
    const s = String(v).replace(/\s+/g, '').toUpperCase();
    if (!s) return 'Please enter your vehicle registration';
    if (!/^[A-Z0-9]{2,8}$/.test(s)) return 'Please use letters and numbers only, e.g. AB12 CDE';
    const ukFormats = [
      /^[A-Z]{2}[0-9]{2}[A-Z]{3}$/,      // AB12 CDE
      /^[A-Z][0-9]{1,3}[A-Z]{3}$/,       // A123 BCD
      /^[A-Z]{3}[0-9]{1,3}[A-Z]$/,       // ABC 123D
      /^[A-Z]{1,3}[0-9]{1,4}$/,          // ABC 1234
      /^[0-9]{1,4}[A-Z]{1,3}$/,          // 1234 AB
];
    if (!ukFormats.some((r) => r.test(s))) return "That doesn't look like a UK registration — please check it";
    return '';
  },

  warrantyNumber: () => '',
  decisionDate: () => '',
  newEvidence: (v) => {
    const s = String(v).trim();
    if (!s) return 'Please tell us why you are appealing';
    if (s.length < 10) return 'Please provide a little more detail (10+ characters)';
    return '';
  },
  desiredOutcome: () => '',
  independentInspection: (v) => (!v ? 'Please choose an option' : ''),
  confirmAccurate: (v) => (!v ? 'Please confirm your information is accurate' : ''),
};

const requiredFields = new Set([
  'firstName', 'registrationPlate',
  'newEvidence', 'independentInspection', 'confirmAccurate',
]);


// Fields that only exist on the full appeal form (secure email link / customer
// dashboard). The public page is a short "request an appeal" form only.
const FULL_ONLY_FIELDS = new Set([
  'claimRef', 'decisionDate', 'desiredOutcome', 'independentInspection',
]);

const Appeals = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('t');
  const [signedIn, setSignedIn] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  // Full appeal form is private: reachable only with a secure link we email, or
  // from inside the signed-in customer dashboard. Everyone else gets the short
  // request form (footer link "Warranty appeals").
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSignedIn(!!data.session);
      setAccessChecked(true);
    }).catch(() => { if (active) setAccessChecked(true); });
    return () => { active = false; };
  }, []);

  const requestMode = !(token || signedIn);

  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [submittedToken, setSubmittedToken] = useState<string | null>(null);
  const [submittedInspectionChoice, setSubmittedInspectionChoice] = useState<string | null>(null);
  const [inspectionLink, setInspectionLink] = useState<string | null>(null);
  const [creatingInspectionLink, setCreatingInspectionLink] = useState(false);
  const [regStatus, setRegStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid' | 'error'>('idle');
  const [regCustomerName, setRegCustomerName] = useState<string | null>(null);
  const regTimer = useRef<number | null>(null);

  // Debounced lookup: confirm the registration matches an existing customer record.
  useEffect(() => {
    const raw = form.registrationPlate.trim();
    if (!raw) { setRegStatus('idle'); setRegCustomerName(null); return; }
    setRegStatus('checking');
    if (regTimer.current) window.clearTimeout(regTimer.current);
    regTimer.current = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('validate-customer-reg', {
          body: { registrationPlate: raw },
        });
        if (error) { setRegStatus('error'); return; }
        if (data?.valid) {
          setRegStatus('valid');
          setRegCustomerName(data.customerName || null);
        } else {
          setRegStatus('invalid');
          setRegCustomerName(null);
        }
      } catch {
        setRegStatus('error');
      }
    }, 500);
    return () => { if (regTimer.current) window.clearTimeout(regTimer.current); };
  }, [form.registrationPlate]);

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const v = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    const next = { ...form, [name]: v };
    setForm(next);
    setTouched((t) => ({ ...t, [name]: true }));
    const validate = validators[name];
    if (validate) setErrors((prev) => ({ ...prev, [name]: validate(v, next) }));
  };

  const activeKeys = useMemo(
    () => Object.keys(validators).filter((k) => !(requestMode && FULL_ONLY_FIELDS.has(k))),
    [requestMode],
  );

  const fieldStatus = useMemo(() => {
    const status: Record<string, { valid: boolean; error: string }> = {};
    for (const key of Object.keys(validators)) {
      const error = validators[key]((form as any)[key], form);
      const filled = key === 'confirmAccurate'
        ? !!(form as any)[key]
        : String((form as any)[key] ?? '').trim().length > 0;
      status[key] = { valid: !error && filled, error };
    }
    return status;
  }, [form]);

  const validateAll = () => {
    const next: Record<string, string> = {};
    const allTouched: Record<string, boolean> = {};
    for (const key of activeKeys) {
      next[key] = validators[key]((form as any)[key], form);
      allTouched[key] = true;
    }
    setErrors(next);
    setTouched(allTouched);
    return Object.values(next).every((m) => !m);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (submitting) return;
    if (!validateAll()) {
      toast({ title: 'Please check the form', description: 'Some required fields need attention.', variant: 'destructive' });
      return;
    }
    // The claim is based on the vehicle, so the registration must always match a
    // customer record before an appeal can be submitted.
    if (regStatus !== 'valid') {
      setErrors((prev) => ({
        ...prev,
        registrationPlate: regStatus === 'checking'
          ? 'Checking your registration — one moment…'
          : "We couldn't find that registration on our records. Please check it and try again.",
      }));
      toast({ title: 'Registration not recognised', description: `Please check the registration, or call us on ${CLAIMS_PHONE}.`, variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const chosenInspection = form.independentInspection;
      const { data, error } = await supabase.functions.invoke('submit-appeal', {
        body: { ...form, mode: requestMode ? 'request' : 'full', token: token || undefined },
      });
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Submission failed');
      setReference(data.reference);
      setSubmittedToken(data.token || null);
      setSubmittedInspectionChoice(chosenInspection);
      setInspectionLink(null);
      setForm(initialForm);
      setRegStatus('idle');
      setRegCustomerName(null);
      setTouched({});
      setErrors({});
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // They asked for an independent inspection — take them straight to payment.
      if (!requestMode && chosenInspection === 'Yes please' && data.token) {
        createInspectionLink(data.token);
      }
    } catch (err: any) {
      toast({ title: 'Submission failed', description: err.message || `Please try again or email ${CLAIMS_EMAIL}`, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const createInspectionLink = async (overrideToken?: string) => {
    const payToken = overrideToken || submittedToken || token;
    if (!payToken || creatingInspectionLink) return;
    setCreatingInspectionLink(true);
    try {
      const { data, error } = await supabase.functions.invoke('appeal-inspection-option', {
        body: { token: payToken, create: true },
      });
      if (error || !data?.inspection?.link) throw new Error(error?.message || data?.error || 'Could not create inspection link');
      setInspectionLink(data.inspection.link);
      window.location.href = data.inspection.link;
    } catch (err: any) {
      toast({ title: 'Could not start payment', description: err.message || 'Please call us to arrange the inspection.', variant: 'destructive' });
    } finally {
      setCreatingInspectionLink(false);
    }
  };


  const showStatus = (name: string) => touched[name] || !!(form as any)[name];

  return (
    <div className="min-h-screen bg-brand-gray-bg">
      <SEOHead
        title={requestMode ? 'Warranty Appeals | Request an Appeal | Buy A Warranty UK' : 'Appeal a Claim Decision | Buy A Warranty UK'}
        description={requestMode
          ? 'Request an appeal of a warranty claim decision. Send us a short request and our claims team will email you a secure link to complete your appeal.'
          : 'Appeal a claim decision with Buy A Warranty. Send us new evidence and our claims manager will review your case independently of the original decision.'}
        keywords="warranty appeals, claim appeal, appeal claim decision, warranty claim review"
        canonical="https://buyawarranty.co.uk/appeals/"
      />

      {/* Back link */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-500 hover:text-brand-blue-dark transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Help Centre
        </button>
      </div>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        <div className="relative overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="relative grid md:grid-cols-[1fr_auto] items-center gap-6 p-8 sm:p-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-blue/10 border border-brand-blue/20 px-3 py-1.5 text-xs font-medium text-brand-blue mb-4">
                <Scale className="w-3.5 h-3.5" /> CLAIM APPEALS
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 leading-tight text-brand-blue-dark">
                {requestMode ? 'Request a warranty appeal' : 'Appeal a claim decision'}
              </h1>
              <p className="text-slate-500 text-base sm:text-lg max-w-2xl leading-relaxed">
                {requestMode
                  ? 'Send us a short request and our claims team will email you a secure link to complete your full appeal — you can also start it from your customer dashboard.'
                  : 'If you believe a claim decision should be looked at again, send us your account and any new evidence. A claims manager reviews every appeal.'}
              </p>
              <ul className="mt-5 space-y-2 text-sm text-brand-blue-dark">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-brand-blue shrink-0" /> Acknowledged within <strong>2 working days</strong></li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-brand-blue shrink-0" /> Reviewed independently of the original decision</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-brand-blue shrink-0" /> Handled privately and securely</li>
              </ul>
            </div>
            <div className="hidden md:flex items-center justify-center">
              <div className="relative w-44 h-44 rounded-2xl bg-brand-blue/10 border border-brand-blue/15 flex items-center justify-center">
                <ClipboardList className="w-20 h-20 text-brand-blue" strokeWidth={1.4} />
                <div className="absolute -bottom-3 -right-3 w-14 h-14 rounded-xl bg-brand-blue flex items-center justify-center shadow-md">
                  <Scale className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white rounded-2xl border border-slate-200 p-2 sm:p-2 shadow-sm">
          {[
            { Icon: ShieldCheck, title: 'A fresh pair of eyes', desc: 'Your appeal is reviewed independently of the original decision.' },
            { Icon: Clock, title: 'Clear timescales', desc: "We'll keep you updated at every stage of the appeal." },
            { Icon: Lock, title: 'Private & secure', desc: 'Your details are handled carefully and confidentially.' },
          ].map(({ Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3 p-4 rounded-xl hover:bg-brand-gray-bg transition-colors">
              <div className="w-10 h-10 rounded-lg bg-brand-blue/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-brand-blue" />
              </div>
              <div>
                <p className="font-semibold text-brand-blue-dark text-sm">{title}</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Main grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {reference ? (
          <section className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 px-6 sm:px-10 py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-3 shadow-md">
                <CheckCircle className="w-9 h-9 text-green-600" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">Thank you!</h2>
              <p className="text-sm sm:text-base text-green-50 leading-relaxed">
                {requestMode
                  ? 'Your appeal request has been sent to our claims team.'
                  : 'Your appeal has been submitted to our claims team.'}
              </p>
            </div>
            <div className="px-6 sm:px-10 py-7">
              <div className="text-center mb-5">
                <div className="inline-block text-xs sm:text-sm bg-brand-gray-bg rounded-md px-3 py-1.5 text-brand-blue-dark">
                  Reference: <span className="font-semibold">{reference}</span>
                </div>
              </div>
              <ul className="space-y-2.5 mb-6 text-sm text-brand-blue-dark">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <span>A confirmation email has been sent to your inbox.</span>
                </li>
                {requestMode ? (
                  <>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                      <span>Our claims team will email you a <strong>secure link</strong> to complete your full appeal.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                      <span>You can also complete it from your customer dashboard.</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                      <span>Our claims team will acknowledge within <strong>2 working days</strong>.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                      <span>We'll write to you with the outcome of your appeal.</span>
                    </li>
                  </>
                )}
              </ul>

              {/* Asked for an inspection — we send them straight to payment. */}
              {!requestMode && submittedInspectionChoice === 'Yes please' && submittedToken && (
                <div className="rounded-xl border border-brand-blue/20 bg-brand-blue/10 p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-blue/20 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-5 h-5 text-brand-blue" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-brand-blue-dark text-sm">Taking you to secure payment…</h3>
                      <p className="text-sm text-brand-blue-dark/80 mt-1 leading-relaxed">
                        The £140 fee covers the engineer's visit to your vehicle anywhere in the UK. If the payment page doesn't open, use the button below.
                      </p>
                      <button
                        onClick={() => createInspectionLink()}
                        disabled={creatingInspectionLink}
                        className="mt-3 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-60 text-white text-sm font-medium rounded-md transition-colors"
                      >
                        {creatingInspectionLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                        Pay £140 securely by card
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Said no / not sure — quiet option in case they change their mind. */}
              {!requestMode && submittedInspectionChoice !== 'Yes please' && submittedToken && (
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  If you'd still like an independent engineer's inspection (£140),{' '}
                  <button
                    onClick={() => createInspectionLink()}
                    disabled={creatingInspectionLink}
                    className="underline font-medium text-brand-blue hover:text-brand-blue-dark disabled:opacity-60"
                  >
                    {creatingInspectionLink ? 'opening secure payment…' : 'you can pay for one here'}
                  </button>.
                </p>
              )}

              <div className="flex">
                <button
                  onClick={() => navigate('/')}
                  className="flex-1 py-2.5 bg-brand-blue-dark hover:bg-brand-blue-dark text-white font-medium rounded-md text-sm"
                >
                  Back to home
                </button>

              </div>
            </div>
          </section>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">

          {/* Form */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-lg bg-brand-blue/10 flex items-center justify-center">
                <Scale className="w-5 h-5 text-brand-blue" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">{requestMode ? 'Request an appeal' : 'Submit an appeal'}</h2>
            </div>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {requestMode
                ? <>Tell us who you are and why you'd like the decision reviewed. Our claims team will then send you a secure link to the full appeal form. All fields marked <span className="text-brand-blue">*</span> are required.</>
                : <>Please fill in the form below. All fields marked <span className="text-brand-blue">*</span> are required.</>}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Name — we already hold the rest of your details */}
              <Field name="firstName" label="Your name" required value={form.firstName} onChange={change} placeholder="e.g. Sarah" error={errors.firstName} valid={fieldStatus.firstName.valid && showStatus('firstName')} hint="We already hold your details — just your first name is fine" />

              {/* Registration is the identifier the claim is based on, so it is
                  required and checked against our customer records. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  name="registrationPlate"
                  label="Vehicle registration"
                  required
                  value={form.registrationPlate}
                  onChange={change}
                  placeholder="e.g. AB12 CDE"
                  error={errors.registrationPlate}
                  loading={regStatus === 'checking'}
                  valid={regStatus === 'valid'}
                  hint={
                    regStatus === 'valid'
                      ? `Found${regCustomerName ? `: ${regCustomerName}` : ''}`
                      : regStatus === 'invalid'
                        ? undefined
                        : 'We check this against your policy — the claim is based on this vehicle'
                  }
                  inputClassName="uppercase"
                />
                <Field
                  name="warrantyNumber"
                  label="Warranty number (optional)"
                  value={form.warrantyNumber}
                  onChange={change}
                  placeholder="e.g. BAW-123456"
                  error={errors.warrantyNumber}
                  valid={fieldStatus.warrantyNumber.valid && showStatus('warrantyNumber')}
                  hint="Only if you have it to hand"
                />
              </div>


              {/* No contact details asked for — we already hold the customer's
                  email and phone against the registration they enter above. */}


              {!requestMode && (
                <Field name="claimRef" label="Claim reference (optional)" value={form.claimRef} onChange={change} placeholder="If you have it" error={errors.claimRef} valid={fieldStatus.claimRef.valid && showStatus('claimRef')} />
              )}

              {!requestMode && (
                <Field name="decisionDate" label="Date of the decision" type="date" value={form.decisionDate} onChange={change} error={errors.decisionDate} valid={fieldStatus.decisionDate.valid && showStatus('decisionDate')} />
              )}

              {/* Why you're appealing */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="newEvidence" className="block text-sm font-medium text-slate-900">
                    {requestMode
                      ? <>Why would you like the decision reviewed?</>
                      : <>Your account of the fault and why you're appealing</>} <span className="text-brand-blue">*</span>
                  </label>
                  <span className="text-xs text-slate-500">{form.newEvidence.length}/2000</span>
                </div>
                <div className="relative">
                  <textarea
                    id="newEvidence"
                    name="newEvidence"
                    value={form.newEvidence}
                    onChange={change}
                    rows={requestMode ? 4 : 5}
                    maxLength={2000}
                    placeholder={requestMode
                      ? 'A short summary is fine — you can add full details and documents on the secure form we send you…'
                      : "Tell us what happened, what the garage found, and any new evidence such as an engineer's report or invoice…"}
                    className={`w-full px-3 py-2.5 pr-10 border rounded-md text-sm bg-white text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-blue-dark/30 focus:border-brand-blue-dark ${errors.newEvidence ? 'border-red-400' : fieldStatus.newEvidence.valid && showStatus('newEvidence') ? 'border-green-500' : 'border-slate-300'}`}
                  />
                  {fieldStatus.newEvidence.valid && showStatus('newEvidence') && !errors.newEvidence && (
                    <Check className="w-4 h-4 text-green-600 absolute right-3 top-3 pointer-events-none" />
                  )}
                </div>
                {errors.newEvidence && <FieldError msg={errors.newEvidence} />}
              </div>

              {/* Desired outcome */}
              {!requestMode && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="desiredOutcome" className="block text-sm font-medium text-slate-900">What outcome are you hoping for?</label>
                  <span className="text-xs text-slate-500">{form.desiredOutcome.length}/1000</span>
                </div>
                <textarea
                  id="desiredOutcome"
                  name="desiredOutcome"
                  value={form.desiredOutcome}
                  onChange={change}
                  rows={3}
                  maxLength={1000}
                  placeholder="Optional — for example, the repair authorised or the invoice reconsidered…"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm bg-white text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-blue-dark/30 focus:border-brand-blue-dark"
                />
              </div>
              )}

              {/* Independent inspection */}
              {!requestMode && (
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Would you like an independent engineer's inspection? <span className="text-brand-blue">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Yes please', 'No thank you', 'Not sure / speak to an expert'].map(option => {
                    const active = form.independentInspection === option;
                    return (
                      <label
                        key={option}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm cursor-pointer transition-all ${active ? 'border-brand-blue bg-brand-blue/10 text-brand-blue-dark font-medium shadow-sm' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'}`}
                      >
                        <input type="radio" name="independentInspection" value={option} checked={active} onChange={change} className="sr-only" />
                        <span className={`w-3.5 h-3.5 rounded-full border-2 ${active ? 'border-brand-blue-dark' : 'border-slate-400'} flex items-center justify-center`}>
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-brand-blue-dark" />}
                        </span>
                        {option}
                      </label>
                    );
                  })}
                </div>
                {errors.independentInspection && <FieldError msg={errors.independentInspection} />}

                {form.independentInspection === 'Yes please' && (
                  <div className="mt-4 rounded-xl border border-brand-blue/20 bg-brand-blue/10 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-blue/20 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5 text-brand-blue" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-brand-blue-dark text-sm">What happens next</h4>
                        <ul className="mt-2 space-y-1.5 text-sm text-brand-blue-dark/90 leading-relaxed">
                          <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-brand-blue mt-0.5 shrink-0" /> We appoint one independent engineering firm — <strong className="font-medium">ACE</strong> or <strong className="font-medium">Scotia</strong> — based on availability in your area.</li>
                          <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-brand-blue mt-0.5 shrink-0" /> The £140 fee covers the engineer's inspection visit to your vehicle, wherever it is in the UK.</li>
                          <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-brand-blue mt-0.5 shrink-0" /> You accept that the engineer's decision is <strong className="font-medium">full and final</strong>.</li>
                          <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-brand-blue mt-0.5 shrink-0" /> Payment is taken securely by card through Stripe.</li>
                          <li className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-brand-blue mt-0.5 shrink-0" /> Your secure Stripe payment link for the £140 fee appears as soon as you submit this appeal.</li>
                        </ul>
                        {token && (
                          <button
                            type="button"
                            onClick={createInspectionLink}
                            disabled={creatingInspectionLink}
                            className="mt-3 inline-flex items-center justify-center rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-blue-dark disabled:opacity-60"
                          >
                            {creatingInspectionLink ? 'Opening secure payment…' : <><Lock className="w-4 h-4 mr-1.5" /> Pay £140 securely by card (Stripe)</>}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {form.independentInspection === 'Not sure / speak to an expert' && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 text-sm">Speak to an expert first</h4>
                        <p className="mt-1 text-sm text-slate-700 leading-relaxed">
                          Choosing not to have one costs nothing — our claims manager still reviews your appeal.
                        </p>
                        <div className="mt-4 grid gap-3">
                          <a href={CLAIMS_PHONE_TEL} className="flex items-center gap-2 text-sm text-brand-blue-dark hover:underline">
                            <Phone className="w-4 h-4 shrink-0" /> <span>Claims line: <strong className="font-medium">{CLAIMS_PHONE}</strong></span>
                          </a>
                          <a href={`mailto:${CLAIMS_EMAIL}`} className="flex items-center gap-2 text-sm text-brand-blue-dark hover:underline">
                            <Mail className="w-4 h-4 shrink-0" /> <span>Email: <strong className="font-medium">{CLAIMS_EMAIL}</strong></span>
                          </a>
                          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-brand-blue-dark hover:underline">
                            <MessageSquare className="w-4 h-4 shrink-0" /> <span>Message us on WhatsApp</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              )}

              {/* Preferred contact method — appeals are handled in writing only */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1.5">
                  How we'll respond
                </label>
                <p className="text-sm text-slate-600 leading-relaxed">
                  We handle appeals in writing so we can keep a clear record. We'll respond to the email address above.
                </p>
                <input type="hidden" name="preferredContactMethod" value="Email" />
              </div>

              {/* Confirmation checkbox */}
              <div>
                <label className={`flex items-start gap-3 p-3 rounded-lg border ${errors.confirmAccurate ? 'border-red-300 bg-red-50/40' : form.confirmAccurate ? 'border-green-300 bg-green-50/40' : 'border-slate-200 bg-slate-50/50'}`}>
                  <input
                    type="checkbox"
                    name="confirmAccurate"
                    checked={form.confirmAccurate}
                    onChange={change}
                    className="mt-0.5 w-4 h-4 rounded border-slate-400 text-brand-blue-dark focus:ring-brand-blue-dark"
                  />
                  <span className="text-sm text-slate-700 leading-relaxed flex-1">
                    I confirm that the information provided is accurate to the best of my knowledge. <span className="text-brand-blue">*</span>
                  </span>
                  {form.confirmAccurate && <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />}
                </label>
                {errors.confirmAccurate && <FieldError msg={errors.confirmAccurate} />}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors shadow-sm"
              >
                {submitting
                  ? (<><Loader2 className="w-4 h-4 animate-spin" /> {requestMode ? 'Sending…' : 'Submitting…'}</>)
                  : requestMode ? 'Request an appeal' : 'Submit my appeal'}
              </button>

              <p className="text-xs text-slate-500 text-center leading-relaxed">
                {requestMode
                  ? "We'll respond within 2 working days with a secure link to your full appeal form. "
                  : "We'll acknowledge your appeal within 2 working days. "}
                Your details are handled in line with our{' '}
                <Link to="/privacy-policy" className="text-brand-blue-dark hover:underline">Privacy Policy</Link>.
              </p>
            </form>
          </section>

          {/* Side panels */}
          <aside className="space-y-5">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-base font-semibold text-brand-blue-dark mb-4">What happens next?</h3>
              <ol className="space-y-4">
                {(requestMode ? [
                  { n: 1, t: 'We receive your request', d: 'Your request goes straight to our claims team with your vehicle details.' },
                  { n: 2, t: 'We send you a secure link', d: 'You complete the full appeal form privately — or start it in your customer dashboard.' },
                  { n: 3, t: 'Claims manager review', d: 'Your appeal is reviewed independently of the original decision.' },
                ] : [
                  { n: 1, t: 'We receive your appeal', d: 'Everything you send is added to your claim file straight away.' },
                  { n: 2, t: 'Claims manager review', d: 'Your appeal is reviewed independently of the original decision.' },
                  { n: 3, t: 'Outcome', d: "We'll write to you with the outcome and the reasons behind it." },
                ]).map(s => (
                  <li key={s.n} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-brand-blue-dark text-white text-xs font-bold flex items-center justify-center shrink-0">{s.n}</div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{s.t}</p>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-base font-semibold text-brand-blue-dark mb-1">Need help with your appeal?</h3>
              <p className="text-xs text-slate-600 mb-4">Our claims team is here to support you.</p>
              <div className="space-y-3">
                <a href={CLAIMS_PHONE_TEL} className="flex items-start gap-3 group">
                  <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center group-hover:border-brand-blue-dark transition">
                    <Phone className="w-4 h-4 text-brand-blue-dark" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Claims line</p>
                    <p className="text-sm font-semibold text-brand-blue-dark group-hover:underline">{CLAIMS_PHONE}</p>
                    <p className="text-xs text-slate-500">Mon–Fri, 9am–5pm</p>
                  </div>
                </a>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 group">
                  <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center group-hover:border-brand-blue-dark transition">
                    <MessageSquare className="w-4 h-4 text-brand-blue-dark" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">WhatsApp</p>
                    <p className="text-sm font-semibold text-brand-blue-dark group-hover:underline">Message our team</p>
                  </div>
                </a>
                <a href={`mailto:${CLAIMS_EMAIL}`} className="flex items-start gap-3 group">
                  <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center group-hover:border-brand-blue-dark transition">
                    <Mail className="w-4 h-4 text-brand-blue-dark" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="text-sm font-semibold text-brand-blue-dark group-hover:underline break-all">{CLAIMS_EMAIL}</p>
                  </div>
                </a>
              </div>
            </div>
          </aside>
        </div>
        )}
      </main>

      <WebsiteFooter />
    </div>
  );
};

interface FieldProps {
  name: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  valid?: boolean;
  loading?: boolean;
  inputClassName?: string;
}

const Field: React.FC<FieldProps> = ({ name, label, value, onChange, placeholder, type = 'text', error, hint, required, valid, loading, inputClassName = '' }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-slate-900 mb-1.5">
      {label}{required && <span className="text-brand-blue"> *</span>}
    </label>
    <div className="relative">
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className={`w-full px-3 py-2.5 pr-10 border rounded-md text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue-dark/30 focus:border-brand-blue-dark ${error ? 'border-red-400' : valid ? 'border-green-500' : 'border-slate-300'} ${inputClassName}`}
      />
      {loading ? (
        <Loader2 className="w-4 h-4 text-slate-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      ) : valid && !error ? (
        <Check className="w-4 h-4 text-green-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      ) : null}
    </div>
    {error ? <FieldError msg={error} id={`${name}-error`} /> : hint ? <p id={`${name}-hint`} className={`mt-1 text-xs ${valid ? 'text-green-700' : 'text-slate-500'}`}>{hint}</p> : null}
  </div>
);

const FieldError: React.FC<{ msg: string; id?: string }> = ({ msg, id }) => (
  <p id={id} className="mt-1 text-xs text-red-600 flex items-center gap-1">
    <AlertCircle className="w-3 h-3" /> {msg}
  </p>
);

export default Appeals;
