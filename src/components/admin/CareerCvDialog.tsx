import React from 'react';
import { Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Cv { full_name: string; cv_file_name: string | null; cv_storage_path: string | null }

export async function downloadCareerCv(cv: Cv) {
  if (!cv.cv_storage_path) return;
  const { data, error } = await supabase.storage.from('career-cvs').download(cv.cv_storage_path);
  if (error || !data) { toast.error('Could not download the CV'); return; }
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = cv.cv_file_name || 'CV';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CareerCvDialog({ cv, onClose }: { cv: Cv | null; onClose: () => void }) {
  const [url, setUrl] = React.useState('');
  const [text, setText] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const extension = cv?.cv_file_name?.split('.').pop()?.toLowerCase();

  React.useEffect(() => {
    let cancelled = false;
    setUrl(''); setText(''); setError('');
    if (!cv?.cv_storage_path) return;
    const path = cv.cv_storage_path;
    setLoading(true);
    const load = async () => {
      try {
        if (extension === 'pdf') {
          const { data, error } = await supabase.storage.from('career-cvs').createSignedUrl(path, 300);
          if (error || !data) throw new Error('Could not open the CV');
          if (!cancelled) setUrl(data.signedUrl);
        } else if (extension === 'docx' || extension === 'txt') {
          const { data, error } = await supabase.storage.from('career-cvs').download(path);
          if (error || !data) throw new Error('Could not open the CV');
          const content = extension === 'docx'
            ? (await (await import('mammoth')).extractRawText({ arrayBuffer: await data.arrayBuffer() })).value
            : await data.text();
          if (!cancelled) setText(content || 'No readable text found. Download the original CV below.');
        } else {
          if (!cancelled) setError('This CV format is available to download and open in your document reader.');
        }
      } catch {
        if (!cancelled) setError('Could not preview this CV. Try downloading the original below.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [cv, extension]);

  return <Dialog open={Boolean(cv)} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-4xl max-h-[90vh]">
      <DialogHeader>
        <DialogTitle>{cv?.full_name} — CV</DialogTitle>
        <DialogDescription>{cv?.cv_file_name || 'CV'}</DialogDescription>
      </DialogHeader>
      <div className="h-[60vh] min-h-0 overflow-auto border rounded-md bg-muted/20">
        {loading ? <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
          : url ? <iframe title={`${cv?.full_name} CV`} src={url} className="h-full w-full" />
          : text ? <pre className="whitespace-pre-wrap break-words font-sans text-sm p-5">{text}</pre>
          : <p className="p-5 text-sm text-muted-foreground">{error}</p>}
      </div>
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => { if (cv) void downloadCareerCv(cv); }}>
          <Download className="h-4 w-4 mr-2" />Download CV
        </Button>
      </div>
    </DialogContent>
  </Dialog>;
}