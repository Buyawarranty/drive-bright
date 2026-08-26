import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SEOHead } from '@/components/SEOHead';
import {
  CheckCircle, AlertCircle, Upload, FileText, Loader2, ShieldCheck, Clock, Lock,
  Gavel, Scale, Phone, Mail, MessageCircle, Check,
} from 'lucide-react';
import { CLAIMS_PHONE, CLAIMS_PHONE_TEL, CLAIMS_EMAIL, WHATSAPP_URL } from '@/constants/contact';

interface InspectionOption {
  link: string;
  fee: number;
  status: string;
  paidAt: string | null;
}

const STATUS_OPTIONS = [
  'In Progress',
  'Awaiting Parts',
  'Repair Complete',
  'Inspection Required',
  'Approved',
  'Declined',
  'Further Info Required',
  'Awaiting Invoice',
  'Payment Processed',
];

const ClaimUpdateForm = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<any>(null);

  // Independent inspection (optional, paid to the inspection company)
  const [inspection, setInspection] = useState<InspectionOption | null>(null);
  const [inspectionLoading, setInspectionLoading] = useState(false);

  // Form state
  const [statusUpdate, setStatusUpdate] = useState('');
  const [notes, setNotes] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [estimatedCompletion, setEstimatedCompletion] = useState('');
  const [respondentName, setRespondentName] = useState('');
  const [respondentEmail, setRespondentEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [confirmAccurate, setConfirmAccurate] = useState(false);

  useEffect(() => {
    const fetchRequest = async () => {
      if (!token) { setError('Invalid link'); setLoading(false); return; }

      const { data: rows, error: fetchError } = await supabase
        .rpc('get_claim_update_request_by_token', { _token: token });
      const data = rows && rows.length > 0 ? rows[0] : null;

      if (fetchError || !data) {
        setError('This link is invalid or has expired.');
      } else if (new Date(data.expires_at) < new Date()) {
        setError('This link has expired. Please contact Buy a Warranty for a new link.');
      } else if (data.is_responded) {
        setError('An update has already been submitted for this claim. Thank you!');
      } else {
        setRequest(data);
        setRespondentName(data.customer_name || '');
        setRespondentEmail(data.recipient_email || '');
      }
      setLoading(false);
    };
    fetchRequest();
  }, [token]);

  // Look for an existing inspection payment page for this claim.
  useEffect(() => {
    if (!token || !request) return;
    (async () => {
      const { data } = await supabase.functions.invoke('appeal-inspection-option', { body: { token } });
      if (data?.inspection) setInspection(data.inspection as InspectionOption);
    })();
  }, [token, request]);

  const requestInspection = useCallback(async () => {
    if (!token) return;
    setInspectionLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('appeal-inspection-option', {
        body: { token, create: true },
      });
      if (fnError || !data?.inspection) throw new Error('Could not set up the inspection page');
      setInspection(data.inspection as InspectionOption);
    } catch (err) {
      console.error(err);
    } finally {
      setInspectionLoading(false);
    }
  }, [token]);

  const handleFileUpload = async (): Promise<{ url: string; name: string } | null> => {
    if (!file) return null;
    try {
      const ext = file.name.split('.').pop();
      const path = `${token}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('claim-updates').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('claim-updates').getPublicUrl(path);
      return { url: publicUrl, name: file.name };
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusUpdate || !confirmAccurate) return;
    setSubmitting(true);

    try {
      let fileData: { url: string; name: string } | null = null;
      if (file) fileData = await handleFileUpload();

      const { data: result, error: fnError } = await supabase.functions.invoke('submit-claim-update', {
        body: {
          token,
          statusUpdate,
          notes,
          invoiceNumber,
          invoiceAmount: invoiceAmount || null,
          estimatedCompletion,
          fileUrl: fileData?.url || null,
          fileName: fileData?.name || null,
          respondentName,
          respondentEmail,
        },
      });

      if (fnError || (result as any)?.error) throw new Error(fnError?.message || (result as any)?.error || 'Submission failed');
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit your appeal');
    } finally {
      setSubmitting(false);
    }
  };

  const regPlate = request?.vehicle_registration?.toUpperCase() || '';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1A2B4A]" />
      </div>
    );
  }

  const inspectionCard = (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-[#FEF0E8] flex items-center justify-center">
          <Scale className="w-5 h-5 text-[#E8541A]" />
        </div>
        <h3 className="text-base font-semibold text-[#1A2B4A]">Independent inspection (optional)</h3>
      </div>
      <p className="text-sm text-[#5A6B82] leading-relaxed mb-3">
        You can ask for an independent engineer to inspect the vehicle and review the claim. The fee is
        paid directly to the independent inspection company — it is not a Buy a Warranty charge and we
        keep none of it.
      </p>
      <ul className="space-y-2 mb-4 text-sm text-slate-700">
        <li className="flex items-start gap-2"><Clock className="w-4 h-4 text-[#E8541A] mt-0.5 shrink-0" /> Inspections take on average 7–14 working days.</li>
        <li className="flex items-start gap-2"><Gavel className="w-4 h-4 text-[#E8541A] mt-0.5 shrink-0" /> The engineer's findings are full and final, and binding on both of us.</li>
        <li className="flex items-start gap-2"><ShieldCheck className="w-4 h-4 text-[#E8541A] mt-0.5 shrink-0" /> Choosing not to have one costs nothing — our claims manager still reviews your appeal.</li>
      </ul>

      {inspection?.paidAt ? (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Your inspection fee has been received. The inspection company will be in touch to arrange a visit.</span>
        </div>
      ) : inspection ? (
        <a
          href={inspection.link}
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-[#E8541A] hover:bg-[#cf471a] text-white font-semibold rounded-lg transition-colors shadow-sm"
        >
          Complete inspection form &amp; pay £{Number(inspection.fee).toFixed(2)}
        </a>
      ) : (
        <button
          type="button"
          onClick={requestInspection}
          disabled={inspectionLoading}
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 border border-[#E8541A] text-[#E8541A] hover:bg-[#FEF0E8] disabled:opacity-60 font-semibold rounded-lg transition-colors"
        >
          {inspectionLoading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>) : 'I would like an independent inspection'}
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F4F6F8]">
      <SEOHead
        title="Claim Appeal Form | Buy A Warranty UK"
        description="Complete your claim appeal form and, if you wish, arrange an independent engineer's inspection."
        canonical="https://buyawarranty.co.uk/claim-update/"
      />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="relative overflow-hidden bg-white border border-[#E2E8F0] rounded-2xl shadow-sm">
          <div className="relative grid md:grid-cols-[1fr_auto] items-center gap-6 p-8 sm:p-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#FEF0E8] border border-[#E8541A]/20 px-3 py-1.5 text-xs font-medium text-[#E8541A] mb-4">
                <Scale className="w-3.5 h-3.5" /> FINAL APPEAL
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 leading-tight text-[#1A2B4A]">
                Your claim appeal
              </h1>
              <p className="text-[#5A6B82] text-base sm:text-lg max-w-2xl leading-relaxed">
                Tell us your account of the fault in your own words and send us anything you would like
                considered. If you would like an independent engineer to review it, you can arrange that here too.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-[#1A2B4A]">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#E8541A] shrink-0" /> Reviewed by our <strong>claims manager</strong></li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#E8541A] shrink-0" /> Independent inspection is <strong>entirely your choice</strong></li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-[#E8541A] shrink-0" /> Handled privately and securely</li>
              </ul>
            </div>
            <div className="hidden md:flex flex-col items-center justify-center gap-4">
              <div className="relative w-44 h-44 rounded-2xl bg-[#FEF0E8] border border-[#E8541A]/15 flex items-center justify-center">
                <Scale className="w-20 h-20 text-[#E8541A]" strokeWidth={1.3} />
              </div>
              {regPlate && (
                <div
                  className="bg-yellow-400 border-[3px] border-black px-4 py-1.5 rounded font-black text-lg tracking-wider"
                  style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}
                >
                  {regPlate}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Trust cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white rounded-2xl border border-[#E2E8F0] p-2 shadow-sm">
          {[
            { Icon: ShieldCheck, title: 'A fresh pair of eyes', desc: 'Your appeal is reviewed independently of the original decision.' },
            { Icon: Clock, title: 'Clear timescales', desc: "We'll keep you updated at every stage of the appeal." },
            { Icon: Lock, title: 'Private & secure', desc: 'Your details and documents are handled confidentially.' },
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error ? (
          <section className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-8 text-center">
            <AlertCircle className="h-14 w-14 text-amber-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-[#1A2B4A] mb-2">We couldn't open this form</h2>
            <p className="text-sm text-[#5A6B82] leading-relaxed">{error}</p>
            <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center">
              <a href={CLAIMS_PHONE_TEL} className="px-5 py-2.5 rounded-md bg-[#1A2B4A] text-white text-sm font-medium">Call {CLAIMS_PHONE}</a>
              <a href={`mailto:${CLAIMS_EMAIL}`} className="px-5 py-2.5 rounded-md border border-[#E2E8F0] text-[#1A2B4A] text-sm font-medium">Email the claims team</a>
            </div>
          </section>
        ) : submitted ? (
          <section className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 px-6 sm:px-10 py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto mb-3 shadow-md">
                <CheckCircle className="w-9 h-9 text-green-600" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">Thank you</h2>
              <p className="text-sm sm:text-base text-green-50">Your appeal has been submitted to our claims team.</p>
            </div>
            <div className="px-6 sm:px-10 py-7 space-y-5">
              <ul className="space-y-2.5 text-sm text-[#1A2B4A]">
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" /> Our claims manager will review everything you have sent.</li>
                <li className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" /> We'll write to you with the outcome of your appeal.</li>
              </ul>
              {inspectionCard}
            </div>
          </section>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
            {/* Appeal form */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-lg bg-[#E8541A]/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#E8541A]" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900">Appeal form</h2>
              </div>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                {request?.customer_name ? `${request.customer_name} — ` : ''}
                {request?.claim_reason ? `${request.claim_reason}. ` : ''}
                All fields marked <span className="text-[#E8541A]">*</span> are required.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1.5">Your name <span className="text-[#E8541A]">*</span></label>
                    <input
                      value={respondentName}
                      onChange={(e) => setRespondentName(e.target.value)}
                      placeholder="Full name"
                      required
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]/30 focus:border-[#1A2B4A]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1.5">Your email <span className="text-[#E8541A]">*</span></label>
                    <input
                      type="email"
                      value={respondentEmail}
                      onChange={(e) => setRespondentEmail(e.target.value)}
                      placeholder="email@example.com"
                      required
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]/30 focus:border-[#1A2B4A]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1.5">Current position <span className="text-[#E8541A]">*</span></label>
                  <select
                    value={statusUpdate}
                    onChange={(e) => setStatusUpdate(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]/30 focus:border-[#1A2B4A]"
                  >
                    <option value="">Select the current position</option>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-slate-900">Your account of the fault and grounds for appeal</label>
                    <span className="text-xs text-slate-500">{notes.length}/2000</span>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={6}
                    maxLength={2000}
                    placeholder="Tell us what happened, what the garage found, and why you believe the claim should be covered…"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm bg-white text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]/30 focus:border-[#1A2B4A]"
                  />
                </div>

                <div className="border border-slate-200 rounded-xl p-4 space-y-4 bg-slate-50/60">
                  <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#E8541A]" /> Invoice details (if you have them)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-900 mb-1.5">Invoice number</label>
                      <input
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="INV-001"
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]/30"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-900 mb-1.5">Invoice amount (£)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={invoiceAmount}
                        onChange={(e) => setInvoiceAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]/30"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1.5">Estimated completion date</label>
                    <input
                      type="date"
                      value={estimatedCompletion}
                      onChange={(e) => setEstimatedCompletion(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1.5" htmlFor="file-upload">
                    Supporting document (invoice, report, photos, service history)
                  </label>
                  <label
                    htmlFor="file-upload"
                    className="block border-2 border-dashed border-slate-300 rounded-xl p-5 text-center hover:border-[#E8541A] transition-colors cursor-pointer bg-white"
                  >
                    {file ? (
                      <div className="flex items-center justify-center gap-2 text-[#1A2B4A]">
                        <FileText className="h-5 w-5" />
                        <span className="font-medium">{file.name}</span>
                        <span className="text-xs text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span>
                      </div>
                    ) : (
                      <div>
                        <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">Click to upload a file</p>
                        <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG, DOC (max 20MB)</p>
                      </div>
                    )}
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </div>

                <label className={`flex items-start gap-3 p-3 rounded-lg border ${confirmAccurate ? 'border-green-300 bg-green-50/40' : 'border-slate-200 bg-slate-50/50'}`}>
                  <input
                    type="checkbox"
                    checked={confirmAccurate}
                    onChange={(e) => setConfirmAccurate(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-400 text-[#1A2B4A] focus:ring-[#1A2B4A]"
                  />
                  <span className="text-sm text-slate-700 leading-relaxed flex-1">
                    I confirm the information provided is accurate to the best of my knowledge. <span className="text-[#E8541A]">*</span>
                  </span>
                  {confirmAccurate && <Check className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />}
                </label>

                <button
                  type="submit"
                  disabled={submitting || !statusUpdate || !respondentName || !respondentEmail || !confirmAccurate}
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-[#E8541A] hover:bg-[#cf471a] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors shadow-sm"
                >
                  {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>) : 'Submit my appeal'}
                </button>

                <p className="text-xs text-slate-500 text-center leading-relaxed">
                  Your details are handled in line with our{' '}
                  <Link to="/privacy-policy" className="text-[#1A2B4A] hover:underline">Privacy Policy</Link>.
                </p>
              </form>
            </section>

            {/* Side panels */}
            <aside className="space-y-5">
              {inspectionCard}

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-base font-semibold text-[#1A2B4A] mb-4">What happens next?</h3>
                <ol className="space-y-4">
                  {[
                    { n: 1, t: 'We receive your appeal', d: 'Everything you send is added to your claim file straight away.' },
                    { n: 2, t: 'Claims manager review', d: 'Your appeal is reviewed independently of the original decision.' },
                    { n: 3, t: 'Final outcome', d: "We'll write to you with the decision. If an independent engineer inspects the vehicle, their findings are final." },
                  ].map((s) => (
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
                <p className="text-xs text-slate-600 mb-4">Our claims team is here Mon–Sat, 9am–6pm.</p>
                <div className="space-y-3">
                  <a href={CLAIMS_PHONE_TEL} className="flex items-start gap-3 group">
                    <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center group-hover:border-[#1A2B4A] transition">
                      <Phone className="w-4 h-4 text-[#1A2B4A]" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Claims line</p>
                      <p className="text-sm font-semibold text-[#1A2B4A] group-hover:underline">{CLAIMS_PHONE}</p>
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
                    <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center group-hover:border-[#E8541A] transition">
                      <Mail className="w-4 h-4 text-[#E8541A]" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Email</p>
                      <p className="text-sm font-semibold text-[#E8541A] group-hover:underline break-all">{CLAIMS_EMAIL}</p>
                    </div>
                  </a>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      <p className="text-center text-xs text-slate-400 pb-10">
        © {new Date().getFullYear()} Buy a Warranty. All rights reserved.
      </p>
    </div>
  );
};

export default ClaimUpdateForm;
