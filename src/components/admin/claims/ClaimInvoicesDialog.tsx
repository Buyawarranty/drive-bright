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

interface InvoiceRow {
  id: string;
  claim_id: string;
  vehicle_registration: string | null;
  invoice_name: string | null;
  amount: number | null;
  invoice_date: string | null;
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

export const ClaimInvoicesDialog: React.FC<Props> = ({ open, onOpenChange, claimId }) => {
  const [claims, setClaims] = useState<ClaimOption[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState<string>(claimId || '');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [invoiceName, setInvoiceName] = useState('');
  const [amount, setAmount] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
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

  const loadInvoices = useCallback(async () => {
    if (!selectedClaimId) {
      setInvoices([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('claim_invoices')
      .select('*')
      .eq('claim_id', selectedClaimId)
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      toast.error('Could not load invoices');
    }
    setInvoices((data || []) as InvoiceRow[]);
    setSelected(new Set());
    setLoading(false);
  }, [selectedClaimId]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

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
      if (user?.id) {
        const { data: admin } = await supabase
          .from('admin_users')
          .select('first_name,last_name,email')
          .eq('user_id', user.id)
          .maybeSingle();
        if (admin) {
          uploaderName =
            [admin.first_name, admin.last_name].filter(Boolean).join(' ').trim() || admin.email;
        }
      }

      const rows: any[] = [];
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `claim-invoices/${selectedClaimId}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from('policy-documents')
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        rows.push({
          claim_id: selectedClaimId,
          vehicle_registration: selectedClaim?.vehicle_registration || null,
          invoice_name: invoiceName.trim() || null,
          amount: amount.trim() === '' ? null : Number(amount),
          invoice_date: invoiceDate || null,
          file_url: BUCKET_PUBLIC + path,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: user?.id ?? null,
          uploaded_by_name: uploaderName,
        });
      }

      const { error: insErr } = await supabase.from('claim_invoices').insert(rows);
      if (insErr) throw insErr;

      toast.success(`Uploaded ${rows.length} invoice${rows.length === 1 ? '' : 's'}`);
      setInvoiceName('');
      setAmount('');
      setInvoiceDate('');
      await loadInvoices();
    } catch (e: any) {
      console.error('invoice upload failed', e);
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const deleteIds = async (ids: string[]) => {
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} invoice${ids.length === 1 ? '' : 's'}?`)) return;
    const { error } = await supabase.from('claim_invoices').delete().in('id', ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Deleted');
    await loadInvoices();
  };

  const downloadOne = (row: InvoiceRow) => {
    const link = document.createElement('a');
    link.href = resolveUrl(row.file_url);
    link.download = row.file_name || 'invoice';
    link.target = '_blank';
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const allSelected = invoices.length > 0 && selected.size === invoices.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(invoices.map((i) => i.id)));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Group date-wise (newest day first)
  const grouped = useMemo(() => {
    const map = new Map<string, InvoiceRow[]>();
    for (const inv of invoices) {
      const key = inv.invoice_date || (inv.created_at || '').slice(0, 10);
      const arr = map.get(key) || [];
      arr.push(inv);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [invoices]);

  const totalAmount = invoices.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Claim invoices</DialogTitle>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Invoice name (optional)</Label>
                <Input
                  className="mt-1"
                  value={invoiceName}
                  onChange={(e) => setInvoiceName(e.target.value)}
                  placeholder="e.g. Garage repair invoice"
                />
              </div>
              <div>
                <Label className="text-xs">Amount (optional)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label className="text-xs">Invoice date (optional)</Label>
                <Input
                  className="mt-1"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
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
            <Button
              size="sm"
              disabled={uploading || !selectedClaimId}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              {uploading ? 'Uploading…' : 'Upload invoice'}
            </Button>
          </div>

          {/* List */}
          <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} disabled={!invoices.length} />
                <span className="text-sm font-medium">Select all</span>
                <Badge variant="secondary" className="text-[11px]">{invoices.length}</Badge>
                {totalAmount > 0 && (
                  <span className="text-xs text-muted-foreground">Total £{totalAmount.toFixed(2)}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selected.size}
                  onClick={() =>
                    invoices.filter((i) => selected.has(i.id)).forEach((i, idx) =>
                      setTimeout(() => downloadOne(i), idx * 250),
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
                Pick a claim above to view its invoices.
              </p>
            ) : invoices.length === 0 ? (
              <p className="p-6 text-sm text-center text-muted-foreground">No invoices yet.</p>
            ) : (
              <div>
                {grouped.map(([day, rows]) => (
                  <div key={day}>
                    <div className="px-3 py-1.5 bg-muted/40 text-xs font-semibold text-muted-foreground">
                      {fmtDate(day)}
                    </div>
                    <ul className="divide-y divide-border">
                      {rows.map((inv) => (
                        <li key={inv.id} className="p-3 flex items-center gap-3">
                          <Checkbox
                            checked={selected.has(inv.id)}
                            onCheckedChange={() => toggleOne(inv.id)}
                          />
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {inv.invoice_name || inv.file_name}
                            </p>
                            <p className="text-[11px] text-muted-foreground flex gap-2 flex-wrap">
                              {inv.vehicle_registration && <span>{inv.vehicle_registration}</span>}
                              {inv.amount != null && <span>£{Number(inv.amount).toFixed(2)}</span>}
                              {fmtSize(inv.file_size) && <span>{fmtSize(inv.file_size)}</span>}
                              {inv.uploaded_by_name && <span>by {inv.uploaded_by_name}</span>}
                            </p>
                          </div>
                          <a
                            href={resolveUrl(inv.file_url)}
                            target="_blank"
                            rel="noreferrer"
                            className="h-8 px-2 inline-flex items-center gap-1 rounded border border-border text-xs hover:bg-muted"
                          >
                            <Eye className="h-3.5 w-3.5" /> View
                          </a>
                          <button
                            type="button"
                            onClick={() => downloadOne(inv)}
                            className="h-8 px-2 inline-flex items-center gap-1 rounded border border-border text-xs hover:bg-muted"
                          >
                            <Download className="h-3.5 w-3.5" /> Download
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteIds([inv.id])}
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
