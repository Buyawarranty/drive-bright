import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { FileText, Upload, Download, Trash2, Eye, FolderOpen, Search, Calendar, Lock, Users, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { useCurrentAdminId } from '@/hooks/useCurrentAdminId';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';

interface StaffHubDoc {
  id: string;
  title: string;
  description: string | null;
  category: string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  is_archived: boolean;
  created_at: string;
}

const CATEGORIES = [
  { id: 'timesheets', label: 'Timesheets' },
  { id: 'holidays', label: 'Holidays & Leave' },
  { id: 'sickness', label: 'Sickness & Absence' },
  { id: 'conduct', label: 'Code of Conduct' },
  { id: 'handbook', label: 'Staff Handbook' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'health-safety', label: 'Health & Safety' },
  { id: 'other', label: 'Other' },
];

const categoryLabel = (id: string) => CATEGORIES.find(c => c.id === id)?.label || id;

const formatBytes = (n: number | null) => {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

export const StaffHubTab: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const adminId = useCurrentAdminId();

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<StaffHubDoc | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string>('');
  const [viewerLoading, setViewerLoading] = useState(false);


  // Upload form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('handbook');
  const [file, setFile] = useState<File | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['staff-hub-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_hub_documents')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as StaffHubDoc[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docs.filter(d => {
      if (filterCategory !== 'all' && d.category !== filterCategory) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q) ||
        d.file_name.toLowerCase().includes(q)
      );
    });
  }, [docs, search, filterCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, StaffHubDoc[]>();
    filtered.forEach(d => {
      const arr = map.get(d.category) || [];
      arr.push(d);
      map.set(d.category, arr);
    });
    return map;
  }, [filtered]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('handbook');
    setFile(null);
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast({ title: 'Missing fields', description: 'Title and file are required.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${category}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from('staff-hub').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from('staff_hub_documents').insert({
        title: title.trim(),
        description: description.trim() || null,
        category,
        storage_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: adminId || null,
      });
      if (insErr) {
        // Roll back storage on metadata insert failure
        await supabase.storage.from('staff-hub').remove([path]);
        throw insErr;
      }
      toast({ title: 'Document uploaded', description: title });
      resetForm();
      setUploadOpen(false);
      queryClient.invalidateQueries({ queryKey: ['staff-hub-documents'] });
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: StaffHubDoc, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    try {
      const { data, error } = await supabase.storage
        .from('staff-hub')
        .createSignedUrl(doc.storage_path, 300, { download: doc.file_name });
      if (error || !data) throw error;
      // Trigger download via hidden anchor to avoid any popup-blocker fallback navigation
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = doc.file_name;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e: any) {
      toast({ title: 'Could not download', description: e.message, variant: 'destructive' });
    }
  };


  const handleView = async (doc: StaffHubDoc, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setViewerDoc(doc);
    setViewerUrl('');
    setViewerLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('staff-hub')
        .createSignedUrl(doc.storage_path, 600);
      if (error || !data) throw error;
      setViewerUrl(data.signedUrl);
    } catch (e: any) {
      toast({ title: 'Could not open', description: e.message, variant: 'destructive' });
      setViewerDoc(null);
    } finally {
      setViewerLoading(false);
    }
  };


  const deleteMutation = useMutation({
    mutationFn: async (doc: StaffHubDoc) => {
      await supabase.storage.from('staff-hub').remove([doc.storage_path]);
      const { error } = await supabase.from('staff_hub_documents').delete().eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Document deleted' });
      queryClient.invalidateQueries({ queryKey: ['staff-hub-documents'] });
    },
    onError: (e: any) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FolderOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Staff Hub</h1>
            <p className="text-sm text-muted-foreground">
              Central library for staff policies — timesheets, holidays, code of conduct and more.
            </p>
          </div>
        </div>

        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Upload className="h-4 w-4 mr-2" />
              Upload document
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Upload a staff document</DialogTitle>
              <DialogDescription>PDFs, Word docs and images are supported.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="sh-title">Title *</Label>
                <Input id="sh-title" value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Holiday request policy 2026" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sh-cat">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="sh-cat"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sh-desc">Description</Label>
                <Textarea id="sh-desc" value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Short summary of what's in this document" rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sh-file">File *</Label>
                <label
                  htmlFor="sh-file"
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-500', 'bg-blue-50'); }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50'); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) setFile(dropped);
                  }}
                  className="flex flex-col items-center justify-center gap-1 cursor-pointer rounded-md border-2 border-dashed border-muted-foreground/30 bg-muted/30 px-4 py-6 text-center transition-colors hover:bg-muted/50"
                >
                  <span className="text-sm font-medium">Drag & drop a file here</span>
                  <span className="text-xs text-muted-foreground">or click to browse — PDF, Word, Excel or image</span>
                  {file && (
                    <span className="mt-2 text-xs font-medium text-foreground">
                      {file.name} ({formatBytes(file.size)})
                    </span>
                  )}
                </label>
                <Input id="sh-file" type="file" className="hidden"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.xls"
                  onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>Cancel</Button>
              <Button onClick={handleUpload} disabled={uploading || !file || !title.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white">
                {uploading ? 'Uploading…' : 'Upload'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card className="border-2">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search documents…"
              className="pl-9"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-xs">
            {filtered.length} document{filtered.length === 1 ? '' : 's'}
          </Badge>
        </CardContent>
      </Card>

      {/* Documents grouped by category */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2">
          <CardContent className="p-10 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No documents yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload your first staff policy to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {CATEGORIES.filter(c => grouped.has(c.id)).map(cat => (
            <Card key={cat.id} className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  {cat.label}
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {grouped.get(cat.id)!.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 divide-y">
                {grouped.get(cat.id)!.map(doc => (
                  <div
                    key={doc.id}
                    className="py-3 flex items-start gap-3 cursor-pointer hover:bg-muted/40 rounded px-2 -mx-2"
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleView(doc, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleView(doc);
                      }
                    }}
                  >
                    <div className="h-9 w-9 rounded bg-muted flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.title}</p>
                      {doc.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{doc.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(doc.created_at), 'd MMM yyyy')}
                        </span>
                        <span>{formatBytes(doc.file_size)}</span>
                        <span className="truncate">{doc.file_name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={(e) => handleView(doc, e)} title="Preview document">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={(e) => handleDownload(doc, e)} title="Download">
                        <Download className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" title="Delete" onClick={(e) => e.stopPropagation()}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>

                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{doc.title}" will be permanently removed. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(doc)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Inline document viewer */}
      <Dialog
        open={!!viewerDoc}
        onOpenChange={(open) => {
          if (!open) {
            setViewerDoc(null);
            setViewerUrl('');
          }
        }}
      >
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="truncate pr-8">{viewerDoc?.title}</DialogTitle>
            <DialogDescription className="truncate">
              {viewerDoc?.file_name} · {formatBytes(viewerDoc?.file_size ?? null)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-muted/30">
            {viewerLoading || !viewerUrl ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Loading document…
              </div>
            ) : (
              <iframe
                src={viewerUrl}
                title={viewerDoc?.title || 'Document'}
                className="w-full h-full border-0"
              />
            )}
          </div>
          <DialogFooter className="p-3 border-t">
            {viewerDoc && (
              <Button
                variant="outline"
                onClick={(e) => viewerDoc && handleDownload(viewerDoc, e)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
            <Button
              onClick={() => {
                setViewerDoc(null);
                setViewerUrl('');
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
};

export default StaffHubTab;
