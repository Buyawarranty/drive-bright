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
  email: '',
  phone: '',
  claimRef: '',
  registrationPlate: '',
  decisionDate: '',
  grounds: '',
  newEvidence: '',
  desiredOutcome: '',
  independentInspection: 'Not sure yet',
  preferredContactMethod: 'Email',
  confirmAccurate: false,
};

const GROUNDS = [
  'New evidence or a new engineer’s report',
  'The fault was not pre-existing',
  'Cover wording applied incorrectly',
  'Repair costs or labour rate disputed',
  'Information was missing when the claim was decided',
  'Other',
];

type FormState = typeof initialForm;

const validators: Record<string, (v: any, f: FormState) => string> = {
  firstName: (v) => (!String(v).trim() ? 'Please enter your first name' : ''),
  lastName: (v) => (!String(v).trim() ? 'Please enter your last name' : ''),
  email: (v) => {
    const s = String(v).trim();
    if (!s) return 'Please enter your email address';
    if (!/^\S+@\S+\.\S+$/.test(s)) return 'Please enter a valid email address';
    return '';
  },
  phone: (v) => {
    const s = String(v).trim();
    if (!s) return '';
    return /^[+0][\d\s()-]{8,}$/.test(s) ? '' : 'Enter a valid UK phone number';
  },
  claimRef: () => '',
  registrationPlate: (v) => (!String(v).trim() ? 'Please enter your vehicle registration' : ''),
  decisionDate: () => '',
  grounds: (v) => (!v ? 'Please select your grounds for appeal' : ''),
  newEvidence: (v) => {
    const s = String(v).trim();
    if (!s) return 'Please tell us why you are appealing';
    if (s.length < 10) return 'Please provide a little more detail (10+ characters)';
    return '';
  },
  desiredOutcome: () => '',
  independentInspection: (v) => (!v ? 'Please choose an option' : ''),
  preferredContactMethod: (v) => (!v ? 'Please choose a contact method' : ''),
  confirmAccurate: (v) => (!v ? 'Please confirm your information is accurate' : ''),
};

const requiredFields = new Set([
  'firstName', 'lastName', 'email', 'registrationPlate', 'grounds',
  'newEvidence', 'independentInspection', 'preferredContactMethod', 'confirmAccurate',
]);

// Fields that only exist on the full appeal form (secure email link / customer
// dashboard). The public page is a short "request an appeal" form only.
const FULL_ONLY_FIELDS = new Set([
  'claimRef', 'decisionDate', 'grounds', 'desiredOutcome', 'independentInspection',
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
    if (regStatus !== 'valid') {
      setErrors((prev) => ({
        ...prev,
        registrationPlate: regStatus === 'checking'
          ? 'Checking your registration — one moment…'
          : "We couldn't find that registration on a customer record. Please check and try again.",
      }));
      toast({ title: 'Registration not recognised', description: 'Please enter the vehicle registration linked to your warranty.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-appeal', {
        body: { ...form, mode: requestMode ? 'request' : 'full', token: token || undefined },
      });
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Submission failed');
      setReference(data.reference);
      setForm(initialForm);
      setRegStatus('idle');
      setRegCustomerName(null);
      setTouched({});
      setErrors({});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      toast({ title: 'Submission failed', description: err.message || `Please try again or email ${CLAIMS_EMAIL}`, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const showStatus = (name: string) => touched[name] || !!(form as any)[name];

  return (
    <div className="min-h-screen bg-[#F4F6F8]">
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
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#5A6B82] hover:text-[#1A2B4A] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Help Centre
        </button>
      </div>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        <div className="relative overflow-hidden bg-white border border-[#E2E8F0] rounded-2xl shadow-sm">
          <div className="relative grid md:grid-cols-[1fr_auto] items-center gap-6 p-8 sm:p-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#FEF0E8] border border-[#E8541A]/20 px-3 py-1.5 text-xs font-medium text-[#E8541A] mb-4">
                <Scale className="w-3.5 h-3.5" /> CLAIM APPEALS
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 leading-tight text-[#1A2B4A]">
                {requestMode ? 'Request a warranty appeal' : 'Appeal a claim decision'}
              </h1>
              <p className="text-[#5A6B82] text-base sm:text-lg max-w-2xl leading-relaxed">
                {requestMode
                  ? 'Send us a short request and our claims team will email you a secure link to complete your full appeal — you can also start it from your customer dashboard.'
                  : 'If you believe a claim decision should be looked at again, send us your grounds and any new evidence. A claims manager reviews every appeal.'}
              </p>
              <ul className="mt-5 space-y-2 text-sm text-[#1A2B4A]">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#E8541A] shrink-0" /> Acknowledged within <strong>2 working days</strong></li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#E8541A] shrink-0" /> Reviewed independently of the original decision</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#E8541A] shrink-0" /> Handled privately and securely</li>
              </ul>
            </div>
            <div className="hidden md:flex items-center justify-center">
              <div className="relative w-44 h-44 rounded-2xl bg-[#FEF0E8] border border-[#E8541A]/15 flex items-center justify-center">
                <ClipboardList className="w-20 h-20 text-[#E8541A]" strokeWidth={1.4} />
                <div className="absolute -bottom-3 -right-3 w-14 h-14 rounded-xl bg-[#E8541A] flex items-center justify-center shadow-md">
                  <Scale className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white rounded-2xl border border-[#E2E8F0] p-2 sm:p-2 shadow-sm">
          {[
            { Icon: ShieldCheck, title: 'A fresh pair of eyes', desc: 'Your appeal is reviewed independently of the original decision.' },
            { Icon: Clock, title: 'Clear timescales', desc: "We'll keep you updated at every stage of the appeal." },
            { Icon: Lock, title: 'Private & secure', desc: 'Your details are handled carefully and confidentially.' },
          ].map(({ Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3 p-4 rounded-xl hover:bg-[#F4F6F8] transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[#FEF0E8] flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-[#E8541A]" />
              </div>
              <div>
                <p className="font-semibold text-[#1A2B4A] text-sm">{title}</p>
                <p className="text-xs text-[#5A6B82] mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Main grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {reference ? (
          <section className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
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
                <div className="inline-block text-xs sm:text-sm bg-[#F4F6F8] rounded-md px-3 py-1.5 text-[#1A2B4A]">
                  Reference: <span className="font-semibold">{reference}</span>
                </div>
              </div>
              <ul className="space-y-2.5 mb-6 text-sm text-[#1A2B4A]">
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
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => { setReference(null); setRegStatus('idle'); setRegCustomerName(null); }}
                  className="flex-1 py-2.5 border border-[#E2E8F0] text-[#1A2B4A] hover:bg-[#F4F6F8] font-medium rounded-md text-sm"
                >
                  {requestMode ? 'Send another request' : 'Submit another appeal'}
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="flex-1 py-2.5 bg-[#1A2B4A] hover:bg-[#152340] text-white font-medium rounded-md text-sm"
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
              <div className="w-9 h-9 rounded-lg bg-[#E8541A]/10 flex items-center justify-center">
                <Scale className="w-5 h-5 text-[#E8541A]" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">{requestMode ? 'Request an appeal' : 'Submit an appeal'}</h2>
            </div>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {requestMode
                ? <>Tell us who you are and why you'd like the decision reviewed. Our claims team will then send you a secure link to the full appeal form. All fields marked <span className="text-[#E8541A]">*</span> are required.</>
                : <>Please fill in the form below. All fields marked <span className="text-[#E8541A]">*</span> are required.</>}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field name="firstName" label="First name" required value={form.firstName} onChange={change} placeholder="e.g. Sarah" error={errors.firstName} valid={fieldStatus.firstName.valid && showStatus('firstName')} />
                <Field name="lastName" label="Last name" required value={form.lastName} onChange={change} placeholder="e.g. Hughes" error={errors.lastName} valid={fieldStatus.lastName.valid && showStatus('lastName')} />
              </div>

              {/* Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field name="email" label="Email address" type="email" required value={form.email} onChange={change} placeholder="you@example.com" error={errors.email} valid={fieldStatus.email.valid && showStatus('email')} />
                <Field name="phone" label="Phone number" value={form.phone} onChange={change} placeholder="07123 456789" error={errors.phone} valid={fieldStatus.phone.valid && showStatus('phone')} />
              </div>

              {/* Claim details */}
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
                        : 'The registration linked to your warranty'
                  }
                  inputClassName="uppercase"
                />
                <Field name="claimRef" label="Claim reference" value={form.claimRef} onChange={change} placeholder="Optional — if you have it" error={errors.claimRef} valid={fieldStatus.claimRef.valid && showStatus('claimRef')} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field name="decisionDate" label="Date of the decision" type="date" value={form.decisionDate} onChange={change} error={errors.decisionDate} valid={fieldStatus.decisionDate.valid && showStatus('decisionDate')} />
                <div>
                  <label htmlFor="grounds" className="block text-sm font-medium text-slate-900 mb-1.5">
                    Grounds for appeal <span className="text-[#E8541A]">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="grounds"
                      name="grounds"
                      value={form.grounds}
                      onChange={change}
                      className={`w-full px-3 py-2.5 pr-10 border rounded-md text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]/30 focus:border-[#1A2B4A] ${errors.grounds ? 'border-red-400' : fieldStatus.grounds.valid && showStatus('grounds') ? 'border-green-500' : 'border-slate-300'}`}
                    >
                      <option value="">Select your grounds</option>
                      {GROUNDS.map(c => <option key={c}>{c}</option>)}
                    </select>
                    {fieldStatus.grounds.valid && showStatus('grounds') && !errors.grounds && (
                      <Check className="w-4 h-4 text-green-600 absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none" />
                    )}
                  </div>
                  {errors.grounds && <FieldError msg={errors.grounds} />}
                </div>
              </div>

              {/* Why you're appealing */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="newEvidence" className="block text-sm font-medium text-slate-900">
                    Your account of the fault and why you're appealing <span className="text-[#E8541A]">*</span>
                  </label>
                  <span className="text-xs text-slate-500">{form.newEvidence.length}/2000</span>
                </div>
                <div className="relative">
                  <textarea
                    id="newEvidence"
                    name="newEvidence"
                    value={form.newEvidence}
                    onChange={change}
                    rows={5}
                    maxLength={2000}
                    placeholder="Tell us what happened, what the garage found, and any new evidence such as an engineer's report or invoice…"
                    className={`w-full px-3 py-2.5 pr-10 border rounded-md text-sm bg-white text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]/30 focus:border-[#1A2B4A] ${errors.newEvidence ? 'border-red-400' : fieldStatus.newEvidence.valid && showStatus('newEvidence') ? 'border-green-500' : 'border-slate-300'}`}
                  />
                  {fieldStatus.newEvidence.valid && showStatus('newEvidence') && !errors.newEvidence && (
                    <Check className="w-4 h-4 text-green-600 absolute right-3 top-3 pointer-events-none" />
                  )}
                </div>
                {errors.newEvidence && <FieldError msg={errors.newEvidence} />}
              </div>

              {/* Desired outcome */}
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
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm bg-white text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]/30 focus:border-[#1A2B4A]"
                />
              </div>

              {/* Independent inspection */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Would you like an independent engineer's inspection? <span className="text-[#E8541A]">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Yes please', 'No thank you', 'Not sure yet'].map(option => {
                    const active = form.independentInspection === option;
                    return (
                      <label
                        key={option}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm cursor-pointer transition-all ${active ? 'border-[#E8541A] bg-[#FEF0E8] text-[#1A2B4A] font-medium shadow-sm' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'}`}
                      >
                        <input type="radio" name="independentInspection" value={option} checked={active} onChange={change} className="sr-only" />
                        <span className={`w-3.5 h-3.5 rounded-full border-2 ${active ? 'border-[#1A2B4A]' : 'border-slate-400'} flex items-center justify-center`}>
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-[#1A2B4A]" />}
                        </span>
                        {option}
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-slate-500">Choosing not to have one costs nothing — our claims manager still reviews your appeal.</p>
                {errors.independentInspection && <FieldError msg={errors.independentInspection} />}
              </div>

              {/* Preferred contact method */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Preferred contact method <span className="text-[#E8541A]">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Email', 'Phone', 'WhatsApp'].map(method => {
                    const active = form.preferredContactMethod === method;
                    return (
                      <label
                        key={method}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm cursor-pointer transition-all ${active ? 'border-[#E8541A] bg-[#FEF0E8] text-[#1A2B4A] font-medium shadow-sm' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'}`}
                      >
                        <input type="radio" name="preferredContactMethod" value={method} checked={active} onChange={change} className="sr-only" />
                        <span className={`w-3.5 h-3.5 rounded-full border-2 ${active ? 'border-[#1A2B4A]' : 'border-slate-400'} flex items-center justify-center`}>
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-[#1A2B4A]" />}
                        </span>
                        {method}
                      </label>
                    );
                  })}
                </div>
                {errors.preferredContactMethod && <FieldError msg={errors.preferredContactMethod} />}
              </div>

              {/* Confirmation checkbox */}
              <div>
                <label className={`flex items-start gap-3 p-3 rounded-lg border ${errors.confirmAccurate ? 'border-red-300 bg-red-50/40' : form.confirmAccurate ? 'border-green-300 bg-green-50/40' : 'border-slate-200 bg-slate-50/50'}`}>
                  <input
                    type="checkbox"
                    name="confirmAccurate"
                    checked={form.confirmAccurate}
                    onChange={change}
                    className="mt-0.5 w-4 h-4 rounded border-slate-400 text-[#1A2B4A] focus:ring-[#1A2B4A]"
                  />
                  <span className="text-sm text-slate-700 leading-relaxed flex-1">
                    I confirm that the information provided is accurate to the best of my knowledge. <span className="text-[#E8541A]">*</span>
                  </span>
                  {form.confirmAccurate && <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />}
                </label>
                {errors.confirmAccurate && <FieldError msg={errors.confirmAccurate} />}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-[#E8541A] hover:bg-[#cf471a] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors shadow-sm"
              >
                {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>) : 'Submit my appeal'}
              </button>

              <p className="text-xs text-slate-500 text-center leading-relaxed">
                We'll acknowledge your appeal within 2 working days. Your details are handled in line with our{' '}
                <Link to="/privacy-policy" className="text-[#1A2B4A] hover:underline">Privacy Policy</Link>.
              </p>
            </form>
          </section>

          {/* Side panels */}
          <aside className="space-y-5">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-base font-semibold text-[#1A2B4A] mb-4">What happens next?</h3>
              <ol className="space-y-4">
                {[
                  { n: 1, t: 'We receive your appeal', d: 'Everything you send is added to your claim file straight away.' },
                  { n: 2, t: 'Claims manager review', d: 'Your appeal is reviewed independently of the original decision.' },
                  { n: 3, t: 'Outcome', d: "We'll write to you with the outcome and the reasons behind it." },
                ].map(s => (
                  <li key={s.n} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#1A2B4A] text-white text-xs font-bold flex items-center justify-center shrink-0">{s.n}</div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{s.t}</p>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-6">
              <h3 className="text-base font-semibold text-[#1A2B4A] mb-1">Need help with your appeal?</h3>
              <p className="text-xs text-slate-600 mb-4">Our claims team is here to support you.</p>
              <div className="space-y-3">
                <a href={CLAIMS_PHONE_TEL} className="flex items-start gap-3 group">
                  <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center group-hover:border-[#1A2B4A] transition">
                    <Phone className="w-4 h-4 text-[#1A2B4A]" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Claims line</p>
                    <p className="text-sm font-semibold text-[#1A2B4A] group-hover:underline">{CLAIMS_PHONE}</p>
                    <p className="text-xs text-slate-500">Mon–Fri, 9am–5pm</p>
                  </div>
                </a>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 group">
                  <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center group-hover:border-[#1A2B4A] transition">
                    <MessageSquare className="w-4 h-4 text-[#1A2B4A]" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">WhatsApp</p>
                    <p className="text-sm font-semibold text-[#1A2B4A] group-hover:underline">Message our team</p>
                  </div>
                </a>
                <a href={`mailto:${CLAIMS_EMAIL}`} className="flex items-start gap-3 group">
                  <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center group-hover:border-[#1A2B4A] transition">
                    <Mail className="w-4 h-4 text-[#1A2B4A]" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="text-sm font-semibold text-[#1A2B4A] group-hover:underline break-all">{CLAIMS_EMAIL}</p>
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
      {label}{required && <span className="text-[#E8541A]"> *</span>}
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
        className={`w-full px-3 py-2.5 pr-10 border rounded-md text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]/30 focus:border-[#1A2B4A] ${error ? 'border-red-400' : valid ? 'border-green-500' : 'border-slate-300'} ${inputClassName}`}
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
