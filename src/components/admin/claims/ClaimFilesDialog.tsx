import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, ChevronsUpDown, Download, Eye, Loader2, Trash2, Upload, FileText } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional pre-selected claim */
  claimId?: string;
}

interface ClaimOption {
  id: string;
  name: string | null;
  email: string | null;
  vehicle_registration: string | null;
}

interface DocRow {
  id: string;
  claim_id: string;
  label: string | null;
  notes: string | null;
  file_url: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

const BUCKET_PUBLIC =
  'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/';

const resolveUrl = (u: string) =>
  !u || u.startsWith('http') ? u : BUCKET_PUBLIC + u.replace(/^\/+/, '');

const fmtSize = (b?: number | null) => {
  if (!b || b <= 0) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

const fmtDate = (d?: string | null) => {
  if (!d) return 'No date';
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return 'No date';
  }
};

export const ClaimFilesDialog: React.FC<Props> = ({ open, onOpenChange, claimId }) => {
  const [claims, setClaims] = useState<ClaimOption[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState<string>(claimId || '');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const selectedClaim = useMemo(
    () => claims.find((c) => c.id === selectedClaimId) || null,
    [claims, selectedClaimId],
  );

  useEffect(() => {
    if (!open) return;
    setSelectedClaimId(claimId || '');
    (async () => {
      const { data, error } = await supabase
        .from('claims_submissions')
        .select('id,name,email,vehicle_registration')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) {
        console.error(error);
        toast.error('Could not load claims');
        return;
      }
      setClaims((data || []) as ClaimOption[]);
    })();
  }, [open, claimId]);

  const loadDocs = useCallback(async () => {
    if (!selectedClaimId) {
      setDocs([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('claim_documents')
      .select('*')
      .eq('claim_id', selectedClaimId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      toast.error('Could not load files');
    }
    setDocs((data || []) as DocRow[]);
    setSelected(new Set());
    setLoading(false);
  }, [selectedClaimId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!selectedClaimId) {
      toast.error('Pick a claim (registration) first');
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let uploaderName: string | null = null;
      let uploaderRole: string | null = null;
      if (user?.id) {
        const { data: admin } = await supabase
          .from('admin_users')
          .select('first_name,last_name,email,role')
          .eq('user_id', user.id)
          .maybeSingle();
        if (admin) {
          uploaderName =
            [admin.first_name, admin.last_name].filter(Boolean).join(' ').trim() || admin.email;
          uploaderRole = (admin as any).role ?? null;
        }
      }

      const rows: any[] = [];
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `claim-files/${selectedClaimId}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from('policy-documents')
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        rows.push({
          claim_id: selectedClaimId,
          label: label.trim() || null,
          notes: notes.trim() || null,
          file_url: BUCKET_PUBLIC + path,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          visibility: 'internal',
          uploaded_by: user?.id ?? null,
          uploaded_by_name: uploaderName,
          uploaded_by_role: uploaderRole,
        });
      }

      const { error: insErr } = await supabase.from('claim_documents').insert(rows);
      if (insErr) throw insErr;

      toast.success(`Uploaded ${rows.length} file${rows.length === 1 ? '' : 's'}`);
      setLabel('');
      setNotes('');
      await loadDocs();
    } catch (e: any) {
      console.error('claim file upload failed', e);
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const deleteIds = async (ids: string[]) => {
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} file${ids.length === 1 ? '' : 's'}?`)) return;
    const { error } = await supabase.from('claim_documents').delete().in('id', ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Deleted');
    await loadDocs();
  };

  const downloadOne = (row: DocRow) => {
    const link = document.createElement('a');
    link.href = resolveUrl(row.file_url);
    link.download = row.file_name || 'claim-file';
    link.target = '_blank';
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const allSelected = docs.length > 0 && selected.size === docs.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(docs.map((d) => d.id)));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const grouped = useMemo(() => {
    const map = new Map<string, DocRow[]>();
    for (const d of docs) {
      const key = (d.created_at || '').slice(0, 10);
      const arr = map.get(key) || [];
      arr.push(d);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [docs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Claim files</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Claim picker by registration */}
          <div>
            <Label className="text-xs">Registration / customer (claim)</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between mt-1 font-normal">
                  {selectedClaim
                    ? `${selectedClaim.vehicle_registration || 'No reg'} — ${selectedClaim.name || selectedClaim.email || 'Unknown'}`
                    : 'Search by registration, name or email'}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50 bg-popover" align="start">
                <Command>
                  <CommandInput placeholder="Type a reg plate, name or email…" />
                  <CommandList>
                    <CommandEmpty>No matching claim.</CommandEmpty>
                    <CommandGroup>
                      {claims.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.vehicle_registration || ''} ${c.name || ''} ${c.email || ''}`}
                          onSelect={() => {
                            setSelectedClaimId(c.id);
                            setPickerOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${c.id === selectedClaimId ? 'opacity-100' : 'opacity-0'}`}
                          />
                          <span className="font-medium mr-2">{c.vehicle_registration || 'No reg'}</span>
                          <span className="text-muted-foreground text-xs truncate">
                            {c.name || c.email || 'Unknown'}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Upload form */}
          <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/20">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">File label (optional)</Label>
                <Input
                  className="mt-1"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Diagnostic report"
                />
              </div>
              <div>
                <Label className="text-xs">Notes (optional)</Label>
                <Input
                  className="mt-1"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything useful for the team"
                />
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Button size="sm" disabled={uploading || !selectedClaimId} onClick={() => fileRef.current?.click()}>
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              {uploading ? 'Uploading…' : 'Upload file'}
            </Button>
          </div>

          {/* List */}
          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} disabled={!docs.length} />
                <span className="text-sm font-medium">Select all</span>
                <Badge variant="secondary" className="text-[11px]">{docs.length}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selected.size}
                  onClick={() =>
                    docs.filter((d) => selected.has(d.id)).forEach((d, idx) =>
                      setTimeout(() => downloadOne(d), idx * 250),
                    )
                  }
                >
                  <Download className="h-4 w-4 mr-1" /> Download
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!selected.size}
                  onClick={() => deleteIds(Array.from(selected))}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="p-6 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !selectedClaimId ? (
              <p className="p-6 text-sm text-center text-muted-foreground">
                Pick a claim above to view its files.
              </p>
            ) : docs.length === 0 ? (
              <p className="p-6 text-sm text-center text-muted-foreground">No files yet.</p>
            ) : (
              <div>
                {grouped.map(([day, rows]) => (
                  <div key={day}>
                    <div className="px-3 py-1.5 bg-muted/40 text-xs font-semibold text-muted-foreground">
                      {fmtDate(day)}
                    </div>
                    <ul className="divide-y divide-border">
                      {rows.map((d) => (
                        <li key={d.id} className="p-3 flex items-center gap-3">
                          <Checkbox checked={selected.has(d.id)} onCheckedChange={() => toggleOne(d.id)} />
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{d.label || d.file_name}</p>
                            <p className="text-[11px] text-muted-foreground flex gap-2 flex-wrap">
                              {d.label && <span className="truncate">{d.file_name}</span>}
                              {fmtSize(d.file_size) && <span>{fmtSize(d.file_size)}</span>}
                              {d.uploaded_by_name && <span>by {d.uploaded_by_name}</span>}
                              {d.notes && <span className="truncate">{d.notes}</span>}
                            </p>
                          </div>
                          <a
                            href={resolveUrl(d.file_url)}
                            target="_blank"
                            rel="noreferrer"
                            className="h-8 px-2 inline-flex items-center gap-1 rounded border border-border text-xs hover:bg-muted"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </a>
                          <button
                            type="button"
                            onClick={() => downloadOne(d)}
                            className="h-8 px-2 inline-flex items-center gap-1 rounded border border-border text-xs hover:bg-muted"
                          >
                            <Download className="h-3.5 w-3.5" /> Download
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteIds([d.id])}
                            className="h-8 w-8 inline-flex items-center justify-center rounded border border-border text-destructive hover:bg-destructive/10"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
