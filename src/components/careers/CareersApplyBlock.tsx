import React, { useRef, useState } from 'react';
import { Copy, Check, Mail, Loader2, MousePointerClick } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { careerContactError } from '../../../supabase/functions/_shared/careerApplicationRules';
import SimpleCaptcha, { useSimpleCaptcha } from '@/components/forms/SimpleCaptcha';

const RECIPIENT = 'info@buyawarranty.co.uk';
const SUBJECT = 'Vehicle Warranty Sales Executive Application';
const BODY = `Please find my CV attached.\n\nA short note covering:\n- Previous vehicle sales experience\n- Strongest sales results\n- Why I would succeed in car warranty sales\n`;

const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
  RECIPIENT,
)}&su=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(BODY)}`;
const mailtoUrl = `mailto:${RECIPIENT}?subject=${encodeURIComponent(
  SUBJECT,
)}&body=${encodeURIComponent(BODY)}`;

const MAX_MB = 8;

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const CareersApplyBlock: React.FC<{ role?: string; experienceLabel?: string }> = ({ role, experienceLabel }) => {
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [warrantySalesExperience, setWarrantySalesExperience] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captcha = useSimpleCaptcha();

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(RECIPIENT);
      setCopied(true);
      toast.success('Email address copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Copy failed – please select and copy manually');
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    const contactError = careerContactError({ email, phone, warrantySalesExperience });
    if (contactError) {
      toast.error(contactError);
      return;
    }
    const contact = z.object({
      email: z.string().trim().email().max(255),
      phone: z.string().trim().min(7).max(40).regex(/^[+\d\s().-]+$/),
    }).safeParse({ email, phone });
    if (!contact.success) {
      toast.error('Please enter a valid email address and phone number');
      return;
    }
    if (!file) {
      toast.error('Please attach your CV');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`CV must be under ${MAX_MB} MB`);
      return;
    }
    if (!captcha.verify()) {
      toast.error('Please answer the quick security question before sending');
      return;
    }

    setSubmitting(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('submit-career-application', {
        body: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          note: note.trim(),
          warrantySalesExperience,
          ...(role ? { role } : {}),
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          fileBase64,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast.success('Application sent – thank you! We will be in touch.');
      setName('');
      setEmail('');
      setPhone('');
      setNote('');
      setWarrantySalesExperience(false);
      setFile(null);
      captcha.reset();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error('Career application failed:', err);
      toast.error('Could not send – please email info@buyawarranty.co.uk directly.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-8 space-y-6">
      {/* Email address block */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
        <p className="text-sm font-semibold text-[#111827] mb-3">
          Send your CV to:
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a
            href={mailtoUrl}
            className="text-lg font-bold text-[#F97316] hover:underline break-all"
          >
            {RECIPIENT}
          </a>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyEmail}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-[#F9FAFB]"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <a
              href={gmailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-[#F9FAFB]"
            >
              <Mail className="h-4 w-4" /> Open in Gmail
            </a>
            <a
              href={mailtoUrl}
              target="_top"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-3 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              <Mail className="h-4 w-4" /> Email app
            </a>
          </div>
        </div>
      </div>

      {/* Quick apply form */}
      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-6 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F97316] text-white shadow-sm sm:h-12 sm:w-12">
            <MousePointerClick className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
          </span>
          <h2 className="text-2xl font-extrabold leading-tight tracking-tight text-[#111827] sm:text-3xl">
            Apply in one click
          </h2>
        </div>
        <p className="mt-2 text-base text-[#6B7280]">
          Upload your CV and we will send it straight to our hiring team.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-[#374151]">Full name*</span>
            <input
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-orange-100"
              placeholder="Jane Smith"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#374151]">Email*</span>
            <input
              type="email"
              required
              maxLength={255}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-orange-100"
              placeholder="you@example.com"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-[#374151]">Phone*</span>
            <input
              type="tel"
              required
              minLength={7}
              maxLength={40}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-orange-100"
              placeholder="07700 900000"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-[#374151]">Short note (optional)</span>
            <textarea
              maxLength={2000}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-orange-100"
              placeholder="Previous vehicle sales experience, strongest sales results, why you would succeed in car warranty sales..."
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-[#374151]">
              Upload CV* (PDF, DOC, DOCX – max {MAX_MB}MB)
            </span>
            <div className="mt-1 flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                required
                accept=".pdf,.doc,.docx,.rtf,.odt,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-[#374151] file:mr-3 file:rounded-lg file:border-0 file:bg-[#111827] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-black"
              />
            </div>
            {file && (
              <p className="mt-1 text-xs text-[#6B7280]">
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </label>
        </div>

        <label className="mt-5 flex items-start gap-3 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            required
            checked={warrantySalesExperience}
            onChange={(e) => setWarrantySalesExperience(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          />
          <span>{experienceLabel || 'I have experience of selling vehicle warranties'}*</span>
        </label>
        <SimpleCaptcha captcha={captcha} idPrefix="careers" className="mt-5" />
        <Button
          type="submit"
          disabled={submitting || !warrantySalesExperience}
          className="mt-5 h-auto w-full px-6 py-3 text-sm font-bold sm:w-auto"
        >
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : 'Send CV now'}
        </Button>
        <p className="mt-3 text-sm text-[#6B7280]">
          Or email your CV to{' '}
          <a href={mailtoUrl} target="_top" rel="noopener" className="font-semibold text-[#F97316] hover:underline">
            {RECIPIENT}
          </a>
        </p>
        <p className="mt-2 text-xs text-[#6B7280]">
          By submitting you agree we may contact you about this role.
        </p>
      </form>
    </div>
  );
};

export default CareersApplyBlock;
