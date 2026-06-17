import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Mail, Clock, CheckCircle, ArrowLeft, MessageSquare, ShieldCheck, Lock, MessageCircle, Loader2, ClipboardList, HeadphonesIcon, AlertCircle, Check } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import WebsiteFooter from '@/components/WebsiteFooter';
import { CLAIMS_PHONE, CLAIMS_PHONE_TEL, CLAIMS_EMAIL, WHATSAPP_URL } from '@/constants/contact';

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  warrantyRef: '',
  registrationPlate: '',
  category: '',
  description: '',
  desiredOutcome: '',
  preferredContactMethod: 'Email',
  confirmAccurate: false,
};

const CATEGORIES = [
  'Warranty cover',
  'Claim decision',
  'Claim delay',
  'Customer service',
  'Payment or billing',
  'Policy documents',
  'Cancellation',
  'Other',
];

type FormState = typeof initialForm;

// Per-field validators — return error string or '' when valid.
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
    if (!s) return ''; // optional
    return /^[+0][\d\s()-]{8,}$/.test(s) ? '' : 'Enter a valid UK phone number';
  },
  warrantyRef: (v) => (!String(v).trim() ? 'Please enter your warranty reference' : ''),
  registrationPlate: () => '',
  category: (v) => (!v ? 'Please select a category' : ''),
  description: (v) => {
    const s = String(v).trim();
    if (!s) return 'Please describe the issue';
    if (s.length < 10) return 'Please provide a little more detail (10+ characters)';
    return '';
  },
  desiredOutcome: () => '',
  preferredContactMethod: (v) => (!v ? 'Please choose a contact method' : ''),
  confirmAccurate: (v) => (!v ? 'Please confirm your information is accurate' : ''),
};

// Which fields are required (drives the green tick logic — optional fields don't get a tick when empty).
const requiredFields = new Set(['firstName', 'lastName', 'email', 'warrantyRef', 'category', 'description', 'preferredContactMethod', 'confirmAccurate']);

const Complaints = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const v = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    const next = { ...form, [name]: v };
    setForm(next);
    setTouched((t) => ({ ...t, [name]: true }));
    // Live-validate as the user types — no need to click outside the field.
    const validate = validators[name];
    if (validate) {
      const msg = validate(v, next);
      setErrors((prev) => ({ ...prev, [name]: msg }));
    }
  };

  // Live valid/invalid maps used to render green ticks and red borders inline.
  const fieldStatus = useMemo(() => {
    const status: Record<string, { valid: boolean; error: string }> = {};
    for (const key of Object.keys(validators)) {
      const error = validators[key]((form as any)[key], form);
      const filled = key === 'confirmAccurate' ? !!(form as any)[key] : String((form as any)[key] ?? '').trim().length > 0;
      const valid = !error && (requiredFields.has(key) ? filled : filled);
      status[key] = { valid, error };
    }
    return status;
  }, [form]);

  const validateAll = () => {
    const next: Record<string, string> = {};
    const allTouched: Record<string, boolean> = {};
    for (const key of Object.keys(validators)) {
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
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-complaint', { body: form });
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Submission failed');
      setReference(data.reference);
      setForm(initialForm);
      setTouched({});
      setErrors({});
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
        title="Complaints Procedure | Buy A Warranty UK"
        description="Submit a complaint to Buy A Warranty. We acknowledge complaints within 2 working days and aim to resolve within 10 working days."
        keywords="complaints procedure, customer service, Buy A Warranty"
        canonical="https://buyawarranty.co.uk/complaints"
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
                <HeadphonesIcon className="w-3.5 h-3.5" /> CUSTOMER COMPLAINTS
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 leading-tight text-[#1A2B4A]">We're here to help</h1>
              <p className="text-[#5A6B82] text-base sm:text-lg max-w-2xl leading-relaxed">
                We take every complaint seriously and aim to resolve it fairly, clearly, and as quickly as possible.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-[#1A2B4A]">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#E8541A] shrink-0" /> Acknowledged within <strong>2 working days</strong></li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#E8541A] shrink-0" /> Resolved within <strong>10 working days</strong></li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#E8541A] shrink-0" /> Handled privately and securely</li>
              </ul>
            </div>
            <div className="hidden md:flex items-center justify-center">
              <div className="relative w-44 h-44 rounded-2xl bg-[#FEF0E8] border border-[#E8541A]/15 flex items-center justify-center">
                <ClipboardList className="w-20 h-20 text-[#E8541A]" strokeWidth={1.4} />
                <div className="absolute -bottom-3 -right-3 w-14 h-14 rounded-xl bg-[#E8541A] flex items-center justify-center shadow-md">
                  <MessageSquare className="w-7 h-7 text-white" />
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
            { Icon: ShieldCheck, title: "We're on your side", desc: 'Our team is here to listen and help put things right.' },
            { Icon: Clock, title: 'Clear response times', desc: "We'll keep you informed at every stage." },
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
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Form */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-lg bg-[#eb4b00]/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-[#eb4b00]" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">Submit a complaint</h2>
            </div>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Please fill in the form below. All fields marked <span className="text-[#eb4b00]">*</span> are required.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field name="firstName" label="First name" required value={form.firstName} onChange={change} placeholder="e.g. Sarah" error={errors.firstName} valid={fieldStatus.firstName.valid && showStatus('firstName')} />
                <Field name="lastName" label="Last name" required value={form.lastName} onChange={change} placeholder="e.g. Johnson" error={errors.lastName} valid={fieldStatus.lastName.valid && showStatus('lastName')} />
              </div>

              <Field name="email" type="email" label="Email address" required value={form.email} onChange={change} placeholder="e.g. sarah@email.com" error={errors.email} hint="We'll send your confirmation here" valid={fieldStatus.email.valid && showStatus('email')} />
              <Field name="phone" type="tel" label="Phone number" value={form.phone} onChange={change} placeholder="e.g. 07700 900000" error={errors.phone} valid={fieldStatus.phone.valid && showStatus('phone') && !!form.phone} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field name="warrantyRef" label="Warranty reference" required value={form.warrantyRef} onChange={change} placeholder="e.g. BAW-2025-XXXXX" error={errors.warrantyRef} hint="Found on your policy documents" valid={fieldStatus.warrantyRef.valid && showStatus('warrantyRef')} />
                <Field name="registrationPlate" label="Vehicle registration" value={form.registrationPlate} onChange={change} placeholder="e.g. AB12 CDE" valid={!!form.registrationPlate && showStatus('registrationPlate')} />
              </div>

              {/* Category */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-slate-900 mb-1.5">
                  What is your complaint about? <span className="text-[#eb4b00]">*</span>
                </label>
                <div className="relative">
                  <select
                    id="category"
                    name="category"
                    value={form.category}
                    onChange={change}
                    className={`w-full px-3 py-2.5 pr-10 border rounded-md text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]/30 focus:border-[#1A2B4A] ${errors.category ? 'border-red-400' : fieldStatus.category.valid && showStatus('category') ? 'border-green-500' : 'border-slate-300'}`}
                  >
                    <option value="">Select a category</option>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                  {fieldStatus.category.valid && showStatus('category') && !errors.category && (
                    <Check className="w-4 h-4 text-green-600 absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none" />
                  )}
                </div>
                {errors.category && <FieldError msg={errors.category} />}
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="description" className="block text-sm font-medium text-slate-900">
                    Tell us what happened <span className="text-[#eb4b00]">*</span>
                  </label>
                  <span className="text-xs text-slate-500">{form.description.length}/2000</span>
                </div>
                <div className="relative">
                  <textarea
                    id="description"
                    name="description"
                    value={form.description}
                    onChange={change}
                    rows={4}
                    maxLength={2000}
                    placeholder="Please describe the issue clearly, including relevant dates and any previous correspondence…"
                    className={`w-full px-3 py-2.5 pr-10 border rounded-md text-sm bg-white text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]/30 focus:border-[#1A2B4A] ${errors.description ? 'border-red-400' : fieldStatus.description.valid && showStatus('description') ? 'border-green-500' : 'border-slate-300'}`}
                  />
                  {fieldStatus.description.valid && showStatus('description') && !errors.description && (
                    <Check className="w-4 h-4 text-green-600 absolute right-3 top-3 pointer-events-none" />
                  )}
                </div>
                {errors.description && <FieldError msg={errors.description} />}
              </div>

              {/* Desired outcome */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="desiredOutcome" className="block text-sm font-medium text-slate-900">How would you like us to resolve this?</label>
                  <span className="text-xs text-slate-500">{form.desiredOutcome.length}/1000</span>
                </div>
                <textarea
                  id="desiredOutcome"
                  name="desiredOutcome"
                  value={form.desiredOutcome}
                  onChange={change}
                  rows={3}
                  maxLength={1000}
                  placeholder="Optional — let us know what outcome you're hoping for…"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm bg-white text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]/30 focus:border-[#1A2B4A]"
                />
              </div>

              {/* Preferred contact method */}
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Preferred contact method <span className="text-[#eb4b00]">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Email', 'Phone', 'WhatsApp'].map(method => {
                    const active = form.preferredContactMethod === method;
                    return (
                      <label
                        key={method}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm cursor-pointer transition-all ${active ? 'border-[#1A2B4A] bg-blue-50 text-[#1A2B4A] font-medium shadow-sm' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'}`}
                      >
                        <input
                          type="radio"
                          name="preferredContactMethod"
                          value={method}
                          checked={active}
                          onChange={change}
                          className="sr-only"
                        />
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
                    I confirm that the information provided is accurate to the best of my knowledge. <span className="text-[#eb4b00]">*</span>
                  </span>
                  {form.confirmAccurate && <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />}
                </label>
                {errors.confirmAccurate && <FieldError msg={errors.confirmAccurate} />}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-[#eb4b00] hover:bg-[#d54300] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors shadow-sm"
              >
                {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>) : 'Submit complaint'}
              </button>

              <p className="text-xs text-slate-500 text-center leading-relaxed">
                We'll acknowledge your complaint within 2 working days. Your details are handled in line with our{' '}
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
                  { n: 1, t: 'Acknowledgement', d: "We'll confirm we've received your complaint within 2 working days." },
                  { n: 2, t: 'Investigation', d: 'Our team will review your case and may contact you for more information.' },
                  { n: 3, t: 'Resolution', d: "We'll aim to resolve your complaint within 10 working days." },
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

            <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl shadow-sm border border-blue-100 p-6">
              <h3 className="text-base font-semibold text-[#1A2B4A] mb-1">Need help before you submit?</h3>
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
                  <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center group-hover:border-green-500 transition">
                    <MessageCircle className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">WhatsApp</p>
                    <p className="text-sm font-semibold text-slate-900 group-hover:underline">Message us on WhatsApp</p>
                  </div>
                </a>
                <a href={`mailto:${CLAIMS_EMAIL}`} className="flex items-start gap-3 group">
                  <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center group-hover:border-[#eb4b00] transition">
                    <Mail className="w-4 h-4 text-[#eb4b00]" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="text-sm font-semibold text-[#eb4b00] group-hover:underline break-all">{CLAIMS_EMAIL}</p>
                  </div>
                </a>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-base font-semibold text-[#1A2B4A] mb-3">Before you submit</h3>
              <ul className="space-y-2">
                {[
                  'Have your warranty reference number ready',
                  'Include key dates and details',
                  'Attach supporting documents if available',
                  "Tell us what outcome you're hoping for",
                ].map(item => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </main>

      {/* Support CTA banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#FEF0E8] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6 text-[#E8541A]" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold mb-1 text-[#1A2B4A]">Still need help?</h2>
                <p className="text-[#5A6B82] text-sm">Our team is here to support you every step of the way.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={CLAIMS_PHONE_TEL} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1A2B4A] text-white rounded-lg text-sm font-semibold hover:bg-[#152340] transition">
                <Phone className="w-4 h-4" /> Call {CLAIMS_PHONE}
              </a>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#25D366] hover:bg-[#1da851] text-white rounded-lg text-sm font-semibold transition">
                <MessageCircle className="w-4 h-4" /> WhatsApp us
              </a>
              <a href={`mailto:${CLAIMS_EMAIL}`} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#E8541A] hover:bg-[#cf471a] text-white rounded-lg text-sm font-semibold transition">
                <Mail className="w-4 h-4" /> Email us
              </a>
            </div>
          </div>
        </div>
      </section>


      <WebsiteFooter />

      {/* Confirmation popup */}
      <Dialog open={!!reference} onOpenChange={(o) => !o && setReference(null)}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 px-6 pt-7 pb-6 text-center">
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-3 shadow-lg">
              <CheckCircle className="w-9 h-9 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">Thank you!</h3>
            <p className="text-sm text-green-50 leading-relaxed">
              Your complaint has been submitted successfully.
            </p>
          </div>
          <div className="px-6 py-6 text-center">
            <div className="inline-block text-xs bg-slate-100 rounded-md px-3 py-1.5 text-slate-700 mb-4">
              Reference: <span className="font-semibold text-slate-900">{reference}</span>
            </div>
            <ul className="text-left space-y-2.5 mb-5 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <span>A confirmation email has been sent to your inbox.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <span>Our complaints team will acknowledge within <strong>2 working days</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <span>We aim to resolve complaints within <strong>10 working days</strong>.</span>
              </li>
            </ul>
            <button
              onClick={() => { setReference(null); navigate('/'); }}
              className="w-full py-2.5 bg-[#1A2B4A] hover:bg-[#152340] text-white font-medium rounded-md text-sm"
            >
              Back to home
            </button>
          </div>
        </DialogContent>
      </Dialog>
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
}

const Field: React.FC<FieldProps> = ({ name, label, value, onChange, placeholder, type = 'text', error, hint, required, valid }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-slate-900 mb-1.5">
      {label}{required && <span className="text-[#eb4b00]"> *</span>}
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
        className={`w-full px-3 py-2.5 pr-10 border rounded-md text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]/30 focus:border-[#1A2B4A] ${error ? 'border-red-400' : valid ? 'border-green-500' : 'border-slate-300'}`}
      />
      {valid && !error && (
        <Check className="w-4 h-4 text-green-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      )}
    </div>
    {error ? <FieldError msg={error} id={`${name}-error`} /> : hint ? <p id={`${name}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p> : null}
  </div>
);

const FieldError: React.FC<{ msg: string; id?: string }> = ({ msg, id }) => (
  <p id={id} className="mt-1 text-xs text-red-600 flex items-center gap-1">
    <AlertCircle className="w-3 h-3" /> {msg}
  </p>
);

export default Complaints;
