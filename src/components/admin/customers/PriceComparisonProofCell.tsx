import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Upload, ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  customerId: string;
  currentPath?: string | null;
  onChange?: (newPath: string | null) => void;
}

const BUCKET = 'price-comparison-proofs';
const MAX_MB = 10;

export function PriceComparisonProofCell({ customerId, currentPath, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [path, setPath] = useState<string | null>(currentPath || null);

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`File must be under ${MAX_MB}MB`);
      return;
    }
    if (!/^image\//.test(file.type) && file.type !== 'application/pdf') {
      toast.error('Only image or PDF files allowed');
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const objectPath = `${customerId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(objectPath, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      // Remove old file if present
      if (path && path !== objectPath) {
        await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
      }

      const { error: dbErr } = await supabase
        .from('customers')
        .update({ price_comparison_proof_url: objectPath })
        .eq('id', customerId);
      if (dbErr) throw dbErr;

      setPath(objectPath);
      onChange?.(objectPath);
      toast.success('Price comparison proof uploaded');
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const handleView = async () => {
    if (!path) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 10);
      if (error) throw error;
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toast.error(e.message || 'Could not open file');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!path) return;
    if (!confirm('Remove the uploaded proof?')) return;
    setBusy(true);
    try {
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
      const { error } = await supabase
        .from('customers')
        .update({ price_comparison_proof_url: null })
        .eq('id', customerId);
      if (error) throw error;
      setPath(null);
      onChange?.(null);
      toast.success('Proof removed');
    } catch (e: any) {
      toast.error(e.message || 'Remove failed');
    } finally {
      setBusy(false);
    }
  };

  const inputId = `pcp-${customerId}`;

  return (
    <div className="flex items-center gap-1">
      <input
        id={inputId}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f);
          e.target.value = '';
        }}
      />
      {path ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={handleView}
            disabled={busy}
            title="View uploaded proof"
            className="h-7 px-2 border-green-300 bg-green-50 text-green-800 hover:bg-green-100"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
            <span className="ml-1 text-xs">View</span>
          </Button>
          <label htmlFor={inputId}>
            <Button
              asChild
              variant="ghost"
              size="sm"
              disabled={busy}
              title="Replace proof"
              className="h-7 px-2"
            >
              <span><Upload className="h-3 w-3" /></span>
            </Button>
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={busy}
            title="Remove proof"
            className="h-7 px-2 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </>
      ) : (
        <label htmlFor={inputId}>
          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={busy}
            title="Upload price comparison proof"
            className="h-7 px-2"
          >
            <span className="flex items-center gap-1">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              <span className="text-xs">Upload</span>
            </span>
          </Button>
        </label>
      )}
    </div>
  );
}
