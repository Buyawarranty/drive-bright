import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Mail, Clock, CheckCircle, ArrowLeft, MessageSquare } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import pandaService from '@/assets/panda-service.png';

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
};

const Complaints = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (errors[name]) setErrors({ ...errors, [name]: '' });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim()) e.lastName = 'Required';
    if (!form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Valid email required';
    if (!form.warrantyRef.trim()) e.warrantyRef = 'Required';
    if (!form.category) e.category = 'Please select a category';
    if (!form.description.trim() || form.description.trim().length < 10) e.description = 'Please describe the issue (min 10 chars)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) {
      toast({ title: 'Please check the form', description: 'Some required fields are missing.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-complaint', { body: form });
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Submission failed');
      setReference(data.reference);
      setForm(initialForm);
    } catch (err: any) {
      toast({ title: 'Submission failed', description: err.message || 'Please try again or email support@buyawarranty.co.uk', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <SEOHead
        title="Complaints Procedure | Buy A Warranty UK"
        description="Submit a complaint to Buy A Warranty. We acknowledge complaints within 2 working days and aim to resolve within 10."
        keywords="complaints procedure, customer service, Buy A Warranty"
        canonical="https://buyawarranty.co.uk/complaints"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium py-2 px-3 rounded-lg transition-all duration-200 bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      {/* Hero */}
      <section className="bg-gradient-to-r from-blue-900 to-blue-800 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-5">
            <img src={pandaService} alt="Customer service" className="h-20 w-auto" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Complaints Procedure</h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">
            We acknowledge complaints within 2 working days and aim to resolve them within 10. Submit yours below and we'll be in touch.
          </p>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Form */}
        <section className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-1">
            <MessageSquare className="w-5 h-5 text-[#eb4b00]" />
            <h2 className="text-xl font-semibold text-gray-900">Submit a complaint</h2>
          </div>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            Fill in the form below and we'll acknowledge your complaint within 2 working days. All fields marked * are required.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field name="firstName" label="First name *" value={form.firstName} onChange={change} placeholder="e.g. Sarah" error={errors.firstName} />
              <Field name="lastName" label="Last name *" value={form.lastName} onChange={change} placeholder="e.g. Johnson" error={errors.lastName} />
            </div>

            <Field name="email" type="email" label="Email address *" value={form.email} onChange={change} placeholder="e.g. sarah@email.com" error={errors.email} hint="Your confirmation will be sent here" />
            <Field name="phone" type="tel" label="Phone number" value={form.phone} onChange={change} placeholder="e.g. 07700 900000" />
            <Field name="warrantyRef" label="Warranty reference number *" value={form.warrantyRef} onChange={change} placeholder="e.g. BAW-2025-XXXXX" error={errors.warrantyRef} />

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">What is your complaint about? *</label>
              <select
                name="category"
                value={form.category}
                onChange={change}
                className={`w-full px-3 py-2.5 border rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]/30 focus:border-[#1A2B4A] ${errors.category ? 'border-red-400' : 'border-gray-300'}`}
              >
                <option value="">Select a category</option>
                <option>Claims handling</option>
                <option>Policy cancellation</option>
                <option>Customer service</option>
                <option>Billing or payment</option>
                <option>Other</option>
              </select>
              {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">Tell us what happened *</label>
              <textarea
                name="description"
                value={form.description}
                onChange={change}
                rows={4}
                placeholder="Please describe the issue clearly, including relevant dates and any previous correspondence…"
                className={`w-full px-3 py-2.5 border rounded-md text-sm bg-white text-gray-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]/30 focus:border-[#1A2B4A] ${errors.description ? 'border-red-400' : 'border-gray-300'}`}
              />
              {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1.5">How would you like us to resolve this?</label>
              <textarea
                name="desiredOutcome"
                value={form.desiredOutcome}
                onChange={change}
                rows={3}
                placeholder="Optional — let us know what outcome you're hoping for…"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]/30 focus:border-[#1A2B4A]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-[#eb4b00] hover:bg-[#d54300] disabled:opacity-60 text-white font-semibold rounded-md transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit complaint'}
            </button>

            <p className="text-xs text-gray-500 text-center leading-relaxed">
              Your details are handled in line with our{' '}
              <Link to="/privacy-policy" className="text-[#1A2B4A] hover:underline">Privacy Policy</Link>. We will never share them with third parties.
            </p>
          </form>
        </section>

        {/* Contact */}
        <section className="mt-10 bg-gradient-to-r from-blue-900 to-blue-800 text-white rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-5 text-center">Prefer to contact us directly?</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="flex items-center"><Mail className="w-5 h-5 mr-3" /><a href="mailto:complaints@buyawarranty.co.uk" className="text-orange-300 hover:text-orange-200">complaints@buyawarranty.co.uk</a></p>
              <p className="flex items-center"><Phone className="w-5 h-5 mr-3" /><a href="tel:03302295040" className="text-orange-300 hover:text-orange-200">0330 229 5040</a></p>
              <p className="flex items-center"><Clock className="w-5 h-5 mr-3" /><span className="text-blue-200">Monday to Friday, 9am–5pm</span></p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-3">Related</h3>
              <div className="space-y-1.5">
                <Link to="/contact-us" className="block text-blue-200 hover:text-white">Contact Us</Link>
                <Link to="/faq" className="block text-blue-200 hover:text-white">FAQs</Link>
                <Link to="/terms" className="block text-blue-200 hover:text-white">Terms &amp; Conditions</Link>
                <Link to="/privacy-policy" className="block text-blue-200 hover:text-white">Privacy Policy</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Confirmation popup */}
      <Dialog open={!!reference} onOpenChange={(o) => !o && setReference(null)}>
        <DialogContent className="max-w-sm rounded-2xl text-center p-6">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-7 h-7 text-green-700" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Complaint received</h3>
          <p className="text-sm text-gray-600 mb-3 leading-relaxed">
            Thank you — we've received your complaint and a confirmation has been sent to your email address.
          </p>
          <div className="inline-block text-xs bg-gray-100 rounded-md px-3 py-1.5 text-gray-700 mb-3">
            Reference: <span className="font-semibold text-gray-900">{reference}</span>
          </div>
          <p className="text-xs text-gray-600 mb-4 leading-relaxed">
            We'll acknowledge your complaint within <strong>2 working days</strong> and aim to resolve it within <strong>10 working days</strong>.
          </p>
          <button
            onClick={() => { setReference(null); navigate('/'); }}
            className="w-full py-2.5 bg-[#1A2B4A] hover:bg-[#152340] text-white font-medium rounded-md text-sm"
          >
            Back to home
          </button>
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
}

const Field: React.FC<FieldProps> = ({ name, label, value, onChange, placeholder, type = 'text', error, hint }) => (
  <div>
    <label className="block text-sm font-medium text-gray-900 mb-1.5">{label}</label>
    <input
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full px-3 py-2.5 border rounded-md text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]/30 focus:border-[#1A2B4A] ${error ? 'border-red-400' : 'border-gray-300'}`}
    />
    {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
  </div>
);

export default Complaints;
