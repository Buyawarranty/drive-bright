import React, { useRef, useState } from 'react';
import { Copy, Check, Mail, Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const RECIPIENT = 'info@buyawarranty.co.uk';
const SUBJECT = 'Vehicle Warranty Sales Executive Application';
const BODY = `Please find my CV attached.\n\nA short note covering:\n- Previous sales experience\n- Strongest sales results\n- Why I would succeed in vehicle warranty sales\n`;

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

export const CareersApplyBlock: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!file) {
      toast.error('Please attach your CV');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`CV must be under ${MAX_MB} MB`);
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
      setFile(null);
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
        <p className="text-base font-bold text-[#111827]">Or apply in one click</p>
        <p className="mt-1 text-sm text-[#6B7280]">
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
            <span className="text-xs font-semibold text-[#374151]">Email (optional)</span>
            <input
              type="email"
              maxLength={255}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-orange-100"
              placeholder="you@example.com"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-semibold text-[#374151]">Phone (optional)</span>
            <input
              type="tel"
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
              placeholder="Sales experience, strongest results, why warranty sales..."
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
                className="block w-full text-sm text-[#374151] file:mr-3 file:rounded-lg file:border-0 file:bg-[#F97316] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#EA580C]"
              />
            </div>
            {file && (
              <p className="mt-1 text-xs text-[#6B7280]">
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#F97316] px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#EA580C] disabled:opacity-60 sm:w-auto"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Sending...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" /> Send CV to {RECIPIENT}
            </>
          )}
        </button>
        <p className="mt-3 text-xs text-[#6B7280]">
          By submitting you agree we may contact you about this role.
        </p>
      </form>
    </div>
  );
};

export default CareersApplyBlock;
