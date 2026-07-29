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
  Download,
} from 'lucide-react';

async function downloadDoc(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
  } catch {
    window.open(url, '_blank');
  }
}

type PlanKey = 'terms-and-conditions' | 'platinum';

interface DocRow {
  id: string;
  plan_type: string;
  document_name: string;
  file_url: string;
  file_size: number | null;
  created_at: string;
  version: string | null;
  effective_from: string | null;
  effective_to: string | null;
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
  const [version, setVersion] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [notify, setNotify] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState('');
  const lastNotifyKey = `tcs-last-notify-${planKey}`;
  const [lastNotify, setLastNotify] = useState<{ count: number; at: string } | null>(() => {
    try {
      const raw = localStorage.getItem(lastNotifyKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const parseFilename = (fname: string): { version?: string; effectiveFrom?: string; label?: string } => {
    const base = fname.replace(/\.pdf$/i, '');
    const out: { version?: string; effectiveFrom?: string; label?: string } = {};

    // Version: prefer explicit "v"-prefixed tokens (v3.7, V3.7.1). Filenames often
    // also contain other decimals (dates like 20.07.2026, or an older version left
    // in the name), so never just take the first decimal we find.
    const stripped = base
      // remove date-like runs so 20.07.2026 / 2026-07-20 can't be read as a version
      .replace(/\b\d{1,4}[./-]\d{1,2}[./-]\d{2,4}\b/g, ' ');
    const vMatches = [...stripped.matchAll(/v[\s._-]?(\d+\.\d+(?:\.\d+)?)(?![\d.])/gi)].map((m) => m[1]);
    const anyMatches = vMatches.length
      ? vMatches
      : [...stripped.matchAll(/(?<![\d.])(\d+\.\d+(?:\.\d+)?)(?![\d.])/g)].map((m) => m[1]);
    if (anyMatches.length) {
      // Highest version wins when a filename mentions more than one.
      const highest = anyMatches.sort((a, b) => {
        const pa = a.split('.').map(Number);
        const pb = b.split('.').map(Number);
        for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
          const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
          if (diff !== 0) return diff;
        }
        return 0;
      }).pop()!;
      out.version = `v${highest}`;
    }


    // Date: ISO-ish YYYY-MM(-DD) anywhere in the name.
    const iso = base.match(/(20\d{2})[-_](\d{1,2})(?:[-_](\d{1,2}))?/);
    if (iso) {
      const y = iso[1];
      const m = iso[2].padStart(2, '0');
      const d = (iso[3] || '01').padStart(2, '0');
      out.effectiveFrom = `${y}-${m}-${d}`;
    } else {
      // Month name + year, e.g. "Feb 2026" or "February-2026".
      const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      const mn = base.toLowerCase().match(/(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|jun(e)?|jul(y)?|aug(ust)?|sep(tember)?|oct(ober)?|nov(ember)?|dec(ember)?)[\s\-_]+(20\d{2})/i);
      if (mn) {
        const idx = months.findIndex((m) => mn[1].toLowerCase().startsWith(m));
        if (idx >= 0) out.effectiveFrom = `${mn[mn.length - 1]}-${String(idx + 1).padStart(2, '0')}-01`;
      }
    }

    if (out.version) {
      out.label = `${meta.defaultName} ${out.version}`;
    }
    return out;
  };

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
    const parsed = parseFilename(f.name);
    if (parsed.version) setVersion(parsed.version);
    if (parsed.effectiveFrom) setEffectiveFrom(parsed.effectiveFrom);
    if (parsed.label) {
      setName(parsed.label);
    } else if (!name || name === meta.defaultName) {
      setName(f.name.replace(/\.pdf$/i, ''));
    }
    if (parsed.version || parsed.effectiveFrom) {
      toast({
        title: 'Auto-filled from filename',
        description: [
          parsed.version && `Version ${parsed.version}`,
          parsed.effectiveFrom && `Effective ${parsed.effectiveFrom}`,
        ].filter(Boolean).join(' · '),
      });
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  }, []);

  const notifyAllCustomers = async () => {
    // Step 1: Remove ANY prior notifications of this same type (read or unread)
    // so each customer only ever has a single notification for this document.
    const { error: cleanupErr } = await supabase
      .from('customer_notifications')
      .delete()
      .eq('message', meta.notificationMessage);
    if (cleanupErr) throw cleanupErr;


    // Step 2: Fetch customer ids in pages, then bulk-insert one fresh
    // notification per customer.
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

      // Close any prior open-ended version so ranges don't overlap
      if (effectiveFrom) {
        await supabase
          .from('customer_documents')
          .update({ effective_to: effectiveFrom } as any)
          .eq('plan_type', planKey)
          .is('effective_to', null);
      }

      const { error: dbErr } = await supabase.from('customer_documents').insert({
        plan_type: planKey,
        document_name: name.trim(),
        file_url: pub.publicUrl,
        file_size: file.size,
        version: version.trim() || null,
        effective_from: effectiveFrom || null,
      } as any);
      if (dbErr) throw dbErr;

      let notifiedCount = 0;
      if (notify) {
        try {
          notifiedCount = await notifyAllCustomers();
          const record = { count: notifiedCount, at: new Date().toISOString() };
          setLastNotify(record);
          try {
            localStorage.setItem(lastNotifyKey, JSON.stringify(record));
          } catch {
            // ignore quota errors
          }
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`${planKey}-version`}>Version</Label>
            <Input
              id={`${planKey}-version`}
              value={version}
              onChange={(e) => {
                const next = e.target.value;
                // Keep the auto-generated document name in step with the version
                // so the saved name can never disagree with the version field.
                const autoName = new RegExp(`^${meta.defaultName}\\s+v?[\\d.]+$`, 'i');
                if (!name || name === meta.defaultName || autoName.test(name)) {
                  setName(next.trim() ? `${meta.defaultName} ${next.trim()}` : meta.defaultName);
                }
                setVersion(next);
              }}
              placeholder="e.g. v3.1"
            />
          </div>
          <div>
            <Label htmlFor={`${planKey}-eff`}>Effective from</Label>
            <Input
              id={`${planKey}-eff`}
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Purchases on or after this date are matched to this version. Any earlier
          open-ended version is automatically closed off on the same date. Version
          and date auto-fill from the filename when possible (e.g. <code>...v3.6.pdf</code> or <code>...2026-04.pdf</code>).
        </p>


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

        {/* Last notification confirmation */}
        {lastNotify && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <span className="font-semibold">
                Dashboard notification sent to {lastNotify.count.toLocaleString()} customer{lastNotify.count === 1 ? '' : 's'}
              </span>{' '}
              <span className="text-blue-800/80">on {formatDate(lastNotify.at)}.</span>
            </div>
          </div>
        )}

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
                    {current.version && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-green-600 text-white text-[10px] font-semibold uppercase px-2 py-0.5 align-middle">
                        {current.version}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-green-800/80">
                    {current.effective_from
                      ? `Effective from ${new Date(current.effective_from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : `Uploaded ${formatDate(current.created_at)}`}
                    {current.effective_to
                      ? ` → ${new Date(current.effective_to).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : ''}
                    {current.file_size ? ` · ${Math.round(current.file_size / 1024)} KB` : ''}
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
                  onClick={() => downloadDoc(current.file_url, `${current.document_name}${current.version ? ' ' + current.version : ''}.pdf`)}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
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
        {docs.length > 1 && (() => {
          const previous = docs.slice(1);
          const q = filter.trim().toLowerCase();
          const filtered = q
            ? previous.filter((d) => {
                const from = d.effective_from
                  ? new Date(d.effective_from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toLowerCase()
                  : '';
                const to = d.effective_to
                  ? new Date(d.effective_to).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toLowerCase()
                  : '';
                const iso = (d.effective_from || d.created_at || '').toLowerCase();
                return (
                  (d.version || '').toLowerCase().includes(q) ||
                  (d.document_name || '').toLowerCase().includes(q) ||
                  from.includes(q) ||
                  to.includes(q) ||
                  iso.includes(q)
                );
              })
            : previous;
          return (
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h4 className="font-medium text-gray-900 text-sm">Previous versions</h4>
                <input
                  type="text"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter by version or date (e.g. 2026, Feb, v3.1)"
                  className="h-8 w-64 max-w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="overflow-x-auto rounded-md border bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Document</th>
                      <th className="px-3 py-2 text-left font-medium">Version</th>
                      <th className="px-3 py-2 text-left font-medium">Effective from</th>
                      <th className="px-3 py-2 text-left font-medium">Effective to</th>
                      <th className="px-3 py-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-xs text-gray-500">
                          No documents match "{filter}"
                        </td>
                      </tr>
                    ) : (
                      filtered.map((d) => (
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-800">{d.document_name}</td>
                          <td className="px-3 py-2">
                            {d.version ? (
                              <span className="inline-flex items-center rounded-full bg-gray-200 text-gray-700 text-[10px] font-semibold uppercase px-1.5 py-0.5">
                                {d.version}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                            {d.effective_from
                              ? new Date(d.effective_from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                              : formatDate(d.created_at)}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                            {d.effective_to
                              ? new Date(d.effective_to).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                              : <span className="text-gray-400">present</span>}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => onPreview(d.file_url)}>
                                View
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => downloadDoc(d.file_url, `${d.document_name}${d.version ? ' ' + d.version : ''}.pdf`)}
                                title="Download"
                              >
                                <Download className="h-4 w-4" />
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
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
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
        .select('id, plan_type, document_name, file_url, file_size, created_at, version, effective_from, effective_to')
        .in('plan_type', ['terms-and-conditions', 'platinum'])
        .order('effective_from', { ascending: false, nullsFirst: false })
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
          <strong>Platinum Warranty Plan</strong> PDFs, each with a{' '}
          <strong>version</strong> and <strong>effective-from date</strong>. Every
          customer purchase is matched to the version that was live on their
          signup date, so we always know which document applied to which sale.
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
