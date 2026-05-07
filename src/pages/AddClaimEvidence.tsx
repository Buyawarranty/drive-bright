import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Upload, X, Loader2, CheckCircle2, ShieldCheck, ArrowLeft, FileText, Phone, Mail, Lock, Clock, Camera, Video, Receipt, FileSearch, Info } from 'lucide-react';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_FILES = 10;

type EvidenceType = 'photos' | 'video' | 'invoice' | 'diagnostic' | 'other';

const EVIDENCE_TYPES: { id: EvidenceType; label: string; icon: any }[] = [
  { id: 'photos', label: 'Photos', icon: Camera },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'invoice', label: 'Invoice / quote', icon: Receipt },
  { id: 'diagnostic', label: 'Diagnostic report', icon: FileSearch },
  { id: 'other', label: 'Other', icon: Info },
];

const AddClaimEvidence = () => {
  const { toast } = useToast();
  const [reference, setReference] = useState('');
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('photos');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{[k: string]: string}>({});

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const valid: File[] = [];
    for (const f of arr) {
      if (f.size > MAX_FILE_SIZE) {
        toast({ title: 'File too large', description: `${f.name} is over 10MB.`, variant: 'destructive' });
        continue;
      }
      valid.push(f);
    }
    setFiles((prev) => [...prev, ...valid].slice(0, MAX_FILES));
  };

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: {[k: string]: string} = {};
    if (!reference.trim()) newErrors.reference = 'Please enter your claim reference, policy number or vehicle registration.';
    if (files.length === 0 && !notes.trim()) newErrors.files = 'Please attach at least one file or add a note.';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    try {
      const filesPayload: Array<{ name: string; size: number; type: string; data: string }> = [];
      for (const f of files) {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(f);
        });
        filesPayload.push({ name: f.name, size: f.size, type: f.type, data });
      }

      const res = await supabase.functions.invoke('submit-claim-evidence', {
        body: { reference, notes, files: filesPayload },
      });

      if (res.error) {
        const data: any = (res as any).data;
        const message = data?.error || res.error.message || 'Failed to submit evidence';
        throw new Error(message);
      }
      setSuccess(true);
    } catch (err: any) {
      toast({
        title: 'Could not submit evidence',
        description: err.message || 'Please try again, or call us on 0330 229 5045.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Add Evidence to Your Claim | Buy a Warranty"
        description="Already submitted a claim? Quickly upload additional evidence — just enter your registration and email."
      />
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="text-orange-600 font-bold text-lg">Buy a Warranty</Link>
            <Link to="/make-a-claim/" className="text-sm text-gray-600 hover:text-orange-600 inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Back to claims
            </Link>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
          {success ? (
            <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-lg border border-green-200 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <CheckCircle2 className="w-9 h-9 text-green-600" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Evidence received</h1>
              <p className="text-gray-600 mb-2">Thank you. We've added your additional evidence to your existing claim.</p>
              <p className="text-gray-600 mb-6">Our claims team will review it and get back to you as soon as possible.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/"><Button variant="outline" className="w-full sm:w-auto">Back to homepage</Button></Link>
                <a href="tel:03302295045"><Button className="bg-orange-500 hover:bg-orange-600 w-full sm:w-auto"><Phone className="w-4 h-4 mr-2" />Call claims team</Button></a>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold mb-3">
                  <ShieldCheck className="w-3.5 h-3.5" /> Existing claim — additional evidence
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Upload evidence</h1>
                <p className="text-gray-600">
                  Add photos, documents or videos to an open claim.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-gray-600">
                  <span className="inline-flex items-center gap-1.5"><Lock className="w-4 h-4 text-green-600" /> End-to-end encrypted</span>
                  <span className="inline-flex items-center gap-1.5"><Clock className="w-4 h-4 text-orange-600" /> Reviewed within 2 hrs</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 sm:p-8 shadow-lg border border-gray-200 space-y-6">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white text-sm font-bold">1</div>
                    <h2 className="text-lg font-semibold text-gray-900">Find your claim</h2>
                  </div>
                  <Label htmlFor="reference" className="text-sm font-semibold text-gray-900">Claim reference, policy number or vehicle registration <span className="text-red-500">*</span></Label>
                  <Input
                    id="reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. CLM-12345, BAW-00123 or AB12 CDE"
                    className={`mt-1.5 ${errors.reference ? 'border-red-500' : ''}`}
                    autoComplete="off"
                  />
                  {errors.reference && <p className="text-xs text-red-600 mt-1">{errors.reference}</p>}
                </div>

                <div>
                  <Label className="text-sm font-semibold text-gray-900">Upload files</Label>
                  <p className="text-xs text-gray-500 mb-2">Photos, PDFs or garage reports — up to {MAX_FILES} files, max 10MB each.</p>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
                    }}
                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                      isDragging ? 'border-orange-500 bg-orange-50' : 'border-gray-300 bg-gray-50 hover:border-orange-400'
                    }`}
                  >
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">Drag and drop files here, or</p>
                    <label htmlFor="evidence-files">
                      <span className="inline-block px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium cursor-pointer">
                        Choose files
                      </span>
                      <input
                        id="evidence-files"
                        type="file"
                        multiple
                        className="hidden"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={(e) => e.target.files && addFiles(e.target.files)}
                      />
                    </label>
                  </div>
                  {files.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {files.map((f, i) => (
                        <li key={i} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                          <span className="flex items-center gap-2 truncate">
                            <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <span className="truncate">{f.name}</span>
                            <span className="text-xs text-gray-500 flex-shrink-0">({Math.round(f.size / 1024)} KB)</span>
                          </span>
                          <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-600 ml-2">
                            <X className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {errors.files && <p className="text-xs text-red-600 mt-2">{errors.files}</p>}
                </div>

                <div>
                  <Label htmlFor="notes" className="text-sm font-semibold text-gray-900">Note (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Anything you'd like the claims team to know about this evidence."
                    rows={4}
                    className="mt-1.5"
                    maxLength={1500}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-base font-semibold rounded-lg"
                >
                  {isSubmitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>) : 'Submit evidence'}
                </Button>

                <div className="text-center text-xs text-gray-500 pt-2 border-t">
                  Need help? Call <a href="tel:03302295045" className="text-orange-600 font-semibold">0330 229 5045</a> or email{' '}
                  <a href="mailto:claims@buyawarranty.co.uk" className="text-orange-600 font-semibold">claims@buyawarranty.co.uk</a>
                </div>
              </form>
            </>
          )}
        </main>
      </div>
    </>
  );
};

export default AddClaimEvidence;
