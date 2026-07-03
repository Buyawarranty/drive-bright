import React, { useRef, useState } from 'react';
import { Download, FileText, Image as ImageIcon, Sparkles, Paperclip, Upload, Loader2 } from 'lucide-react';
import type { ClaimAttachment } from '@/types/claim';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  attachments: ClaimAttachment[];
  /** Claim id — when provided, admins can upload new documents against the claim row */
  claimId?: string;
  /** Called after a successful upload so the parent can refresh */
  onUploaded?: () => void | Promise<void>;
}

const SUPABASE_PUBLIC_PREFIX =
  'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/';

const resolveUrl = (u: string) => {
  if (!u) return u;
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  // Legacy rows stored only the storage path
  const cleaned = u.replace(/^\/+/, '');
  return SUPABASE_PUBLIC_PREFIX + cleaned;
};

const formatSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatWhen = (iso?: string) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

const isImage = (a: ClaimAttachment) => {
  const t = (a.type || '').toLowerCase();
  if (t.startsWith('image/')) return true;
  const n = (a.name || '').toLowerCase();
  return /\.(jpe?g|png|gif|webp|heic|bmp)$/.test(n);
};

const isRecent = (iso?: string) => {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < 1000 * 60 * 60 * 24 * 7; // 7 days
};

export const ClaimAttachmentsPanel: React.FC<Props> = ({ attachments, claimId, onUploaded }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !claimId) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uploaderId = user?.id || 'admin';

      const { data: existing, error: fetchErr } = await supabase
        .from('claims_submissions')
        .select('file_urls')
        .eq('id', claimId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      const current: any[] = Array.isArray(existing?.file_urls) ? [...(existing!.file_urls as any[])] : [];

      const uploaded: any[] = [];
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `claim-admin-uploads/${claimId}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from('policy-documents')
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        const publicUrl = `https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/${path}`;
        uploaded.push({
          url: publicUrl,
          publicUrl,
          name: file.name,
          size: file.size,
          type: file.type,
          addedAs: 'evidence',
          addedAt: new Date().toISOString(),
          evidenceLabel: 'Admin upload',
          uploadedBy: uploaderId,
        });
      }

      const merged = [...current, ...uploaded];
      const { error: updErr } = await supabase
        .from('claims_submissions')
        .update({ file_urls: merged, updated_at: new Date().toISOString() })
        .eq('id', claimId);
      if (updErr) throw updErr;

      toast.success(`Attached ${uploaded.length} file${uploaded.length === 1 ? '' : 's'}`);
      await onUploaded?.();
    } catch (e: any) {
      console.error('Claim attachment upload failed', e);
      toast.error(e?.message || 'Failed to upload files');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const uploadButton = claimId ? (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1.5 rounded-md border border-orange-300 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-60"
      >
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        {uploading ? 'Uploading…' : 'Attach docs'}
      </button>
    </>
  ) : null;

  if (!attachments || attachments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center">
        <Paperclip className="w-5 h-5 text-muted-foreground mx-auto mb-1.5" />
        <p className="text-xs text-muted-foreground mb-2">No documents uploaded yet.</p>
        {uploadButton}
      </div>
    );
  }

  // Newest first: added evidence (with addedAt) followed by original attachments
  const sorted = [...attachments].sort((a, b) => {
    const ta = a.addedAt ? new Date(a.addedAt).getTime() : 0;
    const tb = b.addedAt ? new Date(b.addedAt).getTime() : 0;
    return tb - ta;
  });

  const newEvidenceCount = attachments.filter((a) => a.addedAs === 'evidence').length;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            Attachments
          </span>
          <Badge variant="secondary" className="h-5 text-[11px]">
            {attachments.length}
          </Badge>
          {newEvidenceCount > 0 && (
            <Badge className="h-5 text-[11px] bg-orange-100 text-orange-700 hover:bg-orange-100 border border-orange-200">
              <Sparkles className="w-3 h-3 mr-1" />
              {newEvidenceCount} new
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {uploadButton}
          <a
            href={sorted.map((a) => resolveUrl(a.url)).join('\n')}
            download
            onClick={(e) => {
              // Trigger sequential downloads
              e.preventDefault();
              sorted.forEach((a, i) => {
                setTimeout(() => {
                  const link = document.createElement('a');
                  link.href = resolveUrl(a.url);
                  link.download = a.name || 'attachment';
                  link.target = '_blank';
                  link.rel = 'noreferrer';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }, i * 250);
              });
            }}
            className="text-xs font-medium text-orange-600 hover:text-orange-700 inline-flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            Download all
          </a>
        </div>
      </div>

      <ul className="divide-y divide-border">
        {sorted.map((a, i) => {
          const url = resolveUrl(a.url);
          const evidence = a.addedAs === 'evidence';
          const recent = isRecent(a.addedAt);
          return (
            <li key={`${a.url}-${i}`} className="p-3 flex items-start gap-3">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 h-12 w-12 rounded-md border border-border bg-muted/40 flex items-center justify-center overflow-hidden hover:border-orange-400"
                title="Open"
              >
                {isImage(a) ? (
                  <img
                    src={url}
                    alt={a.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <FileText className="w-5 h-5 text-muted-foreground" />
                )}
              </a>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-foreground hover:text-orange-600 truncate"
                    title={a.name}
                  >
                    {a.name}
                  </a>
                  {evidence && (
                    <Badge
                      className={`h-5 text-[10px] px-1.5 border ${
                        recent
                          ? 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-100'
                          : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                      {recent ? 'New evidence' : 'Evidence'}
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                  {a.evidenceLabel && <span>{a.evidenceLabel}</span>}
                  {formatSize(a.size) && <span>{formatSize(a.size)}</span>}
                  {a.addedAt && <span>Added {formatWhen(a.addedAt)}</span>}
                </div>
              </div>
              <a
                href={url}
                download={a.name}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded border border-border bg-card hover:bg-muted text-muted-foreground"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
