import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, AlertCircle, Upload, FileText, Loader2, Shield } from 'lucide-react';

const ClaimUpdateForm = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<any>(null);

  // Form state
  const [statusUpdate, setStatusUpdate] = useState('');
  const [notes, setNotes] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [estimatedCompletion, setEstimatedCompletion] = useState('');
  const [respondentName, setRespondentName] = useState('');
  const [respondentEmail, setRespondentEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchRequest = async () => {
      if (!token) { setError('Invalid link'); setLoading(false); return; }

      const { data, error: fetchError } = await supabase
        .from('claim_update_requests')
        .select('*')
        .eq('token', token)
        .single();

      if (fetchError || !data) {
        setError('This link is invalid or has expired.');
      } else if (new Date(data.expires_at) < new Date()) {
        setError('This link has expired. Please contact Buy a Warranty for a new link.');
      } else if (data.is_responded) {
        setError('An update has already been submitted for this claim. Thank you!');
      } else {
        setRequest(data);
      }
      setLoading(false);
    };
    fetchRequest();
  }, [token]);

  const handleFileUpload = async (): Promise<{ url: string; name: string } | null> => {
    if (!file) return null;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${token}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('claim-updates')
        .upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from('claim-updates')
        .getPublicUrl(path);
      return { url: publicUrl, name: file.name };
    } catch (err) {
      console.error('Upload error:', err);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusUpdate) return;
    setSubmitting(true);

    try {
      let fileData: { url: string; name: string } | null = null;
      if (file) fileData = await handleFileUpload();

      const response = await fetch(
        `https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/submit-claim-update`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU',
          },
          body: JSON.stringify({
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
          }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Submission failed');
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit update');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1e3a5f]" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full text-center">
          <CardContent className="pt-10 pb-10">
            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Update Submitted</h2>
            <p className="text-slate-600">Thank you for your update. The Buy a Warranty team has been notified and will review your submission.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full text-center">
          <CardContent className="pt-10 pb-10">
            <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Unable to Load</h2>
            <p className="text-slate-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const regPlate = request?.vehicle_registration?.toUpperCase() || 'N/A';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="h-6 w-6 text-[#1e3a5f]" />
            <span className="text-xl font-bold text-[#1e3a5f]">Buy a Warranty</span>
          </div>
          <p className="text-slate-500 text-sm">Claims Update Portal</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-lg">Claim Update Required</CardTitle>
                <CardDescription className="mt-1">
                  Customer: <strong>{request?.customer_name}</strong>
                  {request?.claim_reason && <> · Reason: <strong>{request.claim_reason}</strong></>}
                </CardDescription>
              </div>
              <div className="bg-yellow-400 border-[3px] border-black px-4 py-1.5 rounded font-black text-lg tracking-wider" style={{ fontFamily: "'Arial Black', Arial, sans-serif" }}>
                {regPlate}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Your details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Your Name <span className="text-red-500">*</span></Label>
                  <Input value={respondentName} onChange={(e) => setRespondentName(e.target.value)} placeholder="Full name" required className="bg-white" />
                </div>
                <div className="space-y-1.5">
                  <Label>Your Email <span className="text-red-500">*</span></Label>
                  <Input type="email" value={respondentEmail} onChange={(e) => setRespondentEmail(e.target.value)} placeholder="email@example.com" required className="bg-white" />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label>Claim Status <span className="text-red-500">*</span></Label>
                <Select value={statusUpdate} onValueChange={setStatusUpdate} required>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select current status" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border shadow-lg z-50">
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Awaiting Parts">Awaiting Parts</SelectItem>
                    <SelectItem value="Repair Complete">Repair Complete</SelectItem>
                    <SelectItem value="Inspection Required">Inspection Required</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Declined">Declined</SelectItem>
                    <SelectItem value="Further Info Required">Further Info Required</SelectItem>
                    <SelectItem value="Awaiting Invoice">Awaiting Invoice</SelectItem>
                    <SelectItem value="Payment Processed">Payment Processed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label>Update Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Provide detailed update on this claim..." rows={4} className="bg-white" />
              </div>

              {/* Invoice section */}
              <div className="border border-slate-200 rounded-lg p-4 space-y-4 bg-slate-50/50">
                <h3 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Invoice Details (if applicable)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Invoice Number</Label>
                    <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-001" className="bg-white" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Invoice Amount (£)</Label>
                    <Input type="number" step="0.01" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} placeholder="0.00" className="bg-white" />
                  </div>
                </div>
              </div>

              {/* Estimated Completion */}
              <div className="space-y-1.5">
                <Label>Estimated Completion Date</Label>
                <Input type="date" value={estimatedCompletion} onChange={(e) => setEstimatedCompletion(e.target.value)} className="bg-white" />
              </div>

              {/* File Upload */}
              <div className="space-y-1.5">
                <Label>Upload Invoice / Supporting Document</Label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-[#1e3a5f] transition-colors cursor-pointer"
                  onClick={() => document.getElementById('file-upload')?.click()}>
                  <input id="file-upload" type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  {file ? (
                    <div className="flex items-center justify-center gap-2 text-[#1e3a5f]">
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
                </div>
              </div>

              <Button type="submit" className="w-full h-12 text-base font-semibold bg-[#1e3a5f] hover:bg-[#0f2744]" disabled={submitting || !statusUpdate || !respondentName || !respondentEmail}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                ) : (
                  'Submit Update'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          © {new Date().getFullYear()} Buy a Warranty. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default ClaimUpdateForm;
