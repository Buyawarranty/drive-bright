import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  FileText,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Shield,
  Loader2,
} from 'lucide-react';

type PlanKey = 'terms-and-conditions' | 'platinum';

interface DocRow {
  id: string;
  plan_type: string;
  document_name: string;
  file_url: string;
  file_size: number | null;
  created_at: string;
}

const META: Record<PlanKey, {
  title: string;
  description: string;
  icon: React.ElementType;
  accent: string;
  defaultName: string;
  notificationMessage: string;
}> = {
  'terms-and-conditions': {
    title: 'Terms & Conditions',
    description:
      'The Terms & Conditions PDF shown across the website and the customer portal.',
    icon: FileText,
    accent: 'text-orange-600',
    defaultName: 'Terms and Conditions',
    notificationMessage:
      'Our Terms & Conditions have been updated. Please review the latest version in your portal.',
  },
  platinum: {
    title: 'Platinum Warranty Plan',
    description:
      'The Platinum Warranty Plan PDF shown across the website and the customer portal.',
    icon: Shield,
    accent: 'text-green-600',
    defaultName: 'Platinum Warranty Plan',
    notificationMessage:
      'Your Platinum Warranty Plan document has been updated. Please review the latest version in your portal.',
  },
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const UploadCard: React.FC<{
  planKey: PlanKey;
  docs: DocRow[];
  onChanged: () => void;
  onPreview: (url: string) => void;
}> = ({ planKey, docs, onChanged, onPreview }) => {
  const { toast } = useToast();
  const meta = META[planKey];
  const Icon = meta.icon;
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState(meta.defaultName);
  const [notify, setNotify] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = (f: File | null | undefined) => {
    if (!f) return;
    if (f.type !== 'application/pdf') {
      toast({
        title: 'Invalid file',
        description: 'Please select a PDF file.',
        variant: 'destructive',
      });
      return;
    }
    setFile(f);
    if (!name || name === meta.defaultName) {
      setName(f.name.replace(/\.pdf$/i, ''));
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  }, []);

  const notifyAllCustomers = async () => {
    // Fetch active customer ids in pages, then bulk-insert notifications.
    const pageSize = 1000;
    let from = 0;
    let total = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from('customers')
        .select('id')
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;

      const rows = data.map((c) => ({
        customer_id: c.id,
        message: meta.notificationMessage,
        is_important: true,
      }));

      // Chunk insert (500 per request to stay well under limits).
      for (let i = 0; i < rows.length; i += 500) {
        const slice = rows.slice(i, i + 500);
        const { error: insertErr } = await supabase
          .from('customer_notifications')
          .insert(slice);
        if (insertErr) throw insertErr;
        total += slice.length;
      }

      if (data.length < pageSize) break;
      from += pageSize;
    }
    return total;
  };

  const upload = async () => {
    if (!file || !name.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please choose a PDF and enter a document name.',
        variant: 'destructive',
      });
      return;
    }
    setUploading(true);
    try {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const path = `${planKey}/${slug}-${Date.now()}.pdf`;

      const { error: upErr } = await supabase.storage
        .from('policy-documents')
        .upload(path, file, { contentType: 'application/pdf', upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage
        .from('policy-documents')
        .getPublicUrl(path);

      const { error: dbErr } = await supabase.from('customer_documents').insert({
        plan_type: planKey,
        document_name: name.trim(),
        file_url: pub.publicUrl,
        file_size: file.size,
      });
      if (dbErr) throw dbErr;

      let notifiedCount = 0;
      if (notify) {
        try {
          notifiedCount = await notifyAllCustomers();
        } catch (e: any) {
          console.error('Notification fan-out failed:', e);
          toast({
            title: 'Uploaded — notification failed',
            description:
              e?.message ||
              'The PDF was uploaded but customer notifications could not be sent.',
            variant: 'destructive',
          });
        }
      }

      toast({
        title: 'Document uploaded',
        description: notify
          ? `New ${meta.title} is live. ${notifiedCount} customers notified.`
          : `New ${meta.title} is live.`,
      });

      setFile(null);
      setName(meta.defaultName);
      if (inputRef.current) inputRef.current.value = '';
      onChanged();
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Upload failed',
        description: e?.message || 'Could not upload the document.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this document version? This cannot be undone.')) return;
    const { error } = await supabase
      .from('customer_documents')
      .delete()
      .eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Document deleted' });
    onChanged();
  };

  const current = docs[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${meta.accent}`} />
          {meta.title}
        </CardTitle>
        <CardDescription>{meta.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Drag & drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-gray-300 hover:border-primary/50 hover:bg-gray-50'
          }`}
        >
          <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm font-medium text-gray-700">
            {file ? file.name : 'Drag & drop a PDF here, or click to choose'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {file
              ? `${(file.size / 1024).toFixed(0)} KB — ready to upload`
              : 'PDF only · replaces the current document everywhere'}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        <div>
          <Label htmlFor={`${planKey}-name`}>Document name</Label>
          <Input
            id={`${planKey}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={meta.defaultName}
          />
        </div>

        <label className="flex items-start gap-3 rounded-md border bg-blue-50/60 border-blue-200 px-3 py-3 cursor-pointer">
          <Checkbox
            checked={notify}
            onCheckedChange={(v) => setNotify(v === true)}
            className="mt-0.5"
          />
          <span className="text-sm text-blue-900">
            <span className="font-semibold">
              Notify all customers in their dashboard
            </span>
            <span className="block text-xs text-blue-800/80 mt-0.5">
              Posts an important notification to every customer so they see that
              the {meta.title} has been updated.
            </span>
          </span>
        </label>

        <Button onClick={upload} disabled={!file || uploading} className="w-full">
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload new {meta.title}
            </>
          )}
        </Button>

        {/* Current document */}
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-3">Current document</h4>
          {!current ? (
            <div className="text-center text-gray-500 py-6 bg-gray-50 rounded-lg">
              <FileText className="h-10 w-10 mx-auto text-gray-300 mb-2" />
              <p className="text-sm">No document uploaded yet.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-green-900 truncate">
                    {current.document_name}
                  </p>
                  <p className="text-xs text-green-800/80">
                    Uploaded {formatDate(current.created_at)}
                    {current.file_size
                      ? ` · ${Math.round(current.file_size / 1024)} KB`
                      : ''}
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Live across the website, emails and customer portal.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPreview(current.file_url)}
                >
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => remove(current.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Previous versions */}
        {docs.length > 1 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2 text-sm">
              Previous versions
            </h4>
            <ul className="divide-y rounded-md border bg-white">
              {docs.slice(1).map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-gray-800">{d.document_name}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(d.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onPreview(d.file_url)}
                    >
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(d.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const TermsAndConditionsTab: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [docsByPlan, setDocsByPlan] = useState<Record<PlanKey, DocRow[]>>({
    'terms-and-conditions': [],
    platinum: [],
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_documents')
        .select('id, plan_type, document_name, file_url, file_size, created_at')
        .in('plan_type', ['terms-and-conditions', 'platinum'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      const grouped: Record<PlanKey, DocRow[]> = {
        'terms-and-conditions': [],
        platinum: [],
      };
      (data || []).forEach((row) => {
        if (row.plan_type === 'terms-and-conditions' || row.plan_type === 'platinum') {
          grouped[row.plan_type as PlanKey].push(row as DocRow);
        }
      });
      setDocsByPlan(grouped);
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Failed to load documents',
        description: e?.message || 'Please refresh and try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Terms & Conditions</h1>
        <p className="text-gray-600 mt-1 max-w-3xl">
          Upload the latest <strong>Terms & Conditions</strong> and{' '}
          <strong>Platinum Warranty Plan</strong> PDFs. The newest upload
          automatically becomes the live version everywhere it's shown —
          website, emails, and the customer portal.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UploadCard
            planKey="terms-and-conditions"
            docs={docsByPlan['terms-and-conditions']}
            onChanged={load}
            onPreview={setPreviewUrl}
          />
          <UploadCard
            planKey="platinum"
            docs={docsByPlan.platinum}
            onChanged={load}
            onPreview={setPreviewUrl}
          />
        </div>
      )}

      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-5xl h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Document preview</span>
              {previewUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in new tab
                  </a>
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe
              src={previewUrl}
              className="w-full h-full rounded-lg border"
              title="PDF preview"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TermsAndConditionsTab;
