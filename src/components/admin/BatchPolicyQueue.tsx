import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Search, Printer, Tag, X, Users, Plus, Mail, Car, Trash2, AlertTriangle, FileDown, CheckCircle2, Save, Pencil, Check } from 'lucide-react';
import { format } from 'date-fns';
import { getDisplayClaimLimitValue } from '@/lib/claimLimitTiers';

interface QueuedCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  flat_number?: string;
  building_name?: string;
  building_number?: string;
  street?: string;
  town?: string;
  county?: string;
  postcode?: string;
  registration_plate?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  mileage?: string;
  plan_type: string;
  claim_limit?: number;
  voluntary_excess?: number;
  labour_rate?: number;
  warranty_number?: string;
  warranty_reference_number?: string;
  breakdown_recovery?: boolean;
  wear_tear?: boolean;
  europe_cover?: boolean;
  mot_fee?: boolean;
  mot_repair?: boolean;
  tyre_cover?: boolean;
  lost_key?: boolean;
  vehicle_rental?: boolean;
  transfer_cover?: boolean;
  consequential?: boolean;
  payment_type?: string;
  seasonal_bonus_months?: number;
  // policy data joined
  policy?: {
    id: string;
    policy_number: string;
    policy_start_date: string;
    policy_end_date: string;
    plan_type: string;
    warranty_number?: string;
    claim_limit?: number;
    voluntary_excess?: number;
    payment_type: string;
    additional_notes?: string;
    seasonal_bonus_months?: number | null;
  };
}

const STORAGE_KEY = 'batchPolicyQueue.v1';
const SAVED_AT_KEY = 'batchPolicyQueue.savedAt.v1';

export const BatchPolicyQueue: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [queue, setQueue] = useState<QueuedCustomer[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [savedAt, setSavedAt] = useState<string | null>(() => {
    try { return localStorage.getItem(SAVED_AT_KEY); } catch { return null; }
  });
  const [printMode, setPrintMode] = useState<'bw' | 'colour'>('bw');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<QueuedCustomer>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Autosave queue to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
      const now = new Date().toISOString();
      localStorage.setItem(SAVED_AT_KEY, now);
      setSavedAt(now);
    } catch (e) { /* ignore quota */ }
  }, [queue]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Search customers
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      const q = searchQuery.trim();
      const cleanReg = q.replace(/\s/g, '').toUpperCase();

      const { data } = await supabase
        .from('customers')
        .select('id, name, email, phone, registration_plate, warranty_number, warranty_reference_number, plan_type, vehicle_make, vehicle_model')
        .or('is_deleted.is.null,is_deleted.eq.false')
        .or(`name.ilike.%${q}%,email.ilike.%${q}%,registration_plate.ilike.%${cleanReg}%`)
        .limit(20);

      setSearchResults(data || []);
      setIsSearching(false);
      setShowDropdown(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const addToQueue = async (customer: any) => {
    // Check if already in queue
    if (queue.find(q => q.id === customer.id)) {
      toast({ title: 'Already in queue', description: `${customer.name} is already in the batch queue.` });
      setShowDropdown(false);
      setSearchQuery('');
      return;
    }

    // Fetch full customer data + policy
    const [{ data: fullCustomer }, { data: policies }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', customer.id).single(),
      supabase.from('customer_policies').select('*').ilike('email', customer.email).or('is_deleted.is.null,is_deleted.eq.false').order('created_at', { ascending: false }).limit(1),
    ]);

    if (fullCustomer) {
      const entry: QueuedCustomer = {
        ...fullCustomer,
        policy: policies?.[0] || undefined,
      };
      setQueue(prev => [...prev, entry]);
      toast({ title: 'Added to batch', description: `${customer.name} added to queue.` });

      // Log to posted letters log
      try {
        await supabase.from('posted_letters_log').insert({
          customer_id: customer.id,
          registration_plate: customer.registration_plate || 'N/A',
          customer_name: customer.name,
          customer_email: customer.email,
          warranty_number: customer.warranty_number || customer.warranty_reference_number || null,
          plan_type: customer.plan_type,
          action_type: 'batch',
          notes: 'Added to batch queue',
        } as any);
      } catch (e) { /* silent */ }
    }

    setShowDropdown(false);
    setSearchQuery('');
  };

  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  const openEdit = (c: QueuedCustomer) => {
    setEditingId(c.id);
    const cAny = c as any;
    const existingFirst = (cAny.first_name || '').trim();
    const existingLast = (cAny.last_name || '').trim();
    let first = existingFirst;
    let last = existingLast;
    if (!first && !last) {
      const parts = (c.name || '').trim().split(/\s+/);
      first = parts[0] || '';
      last = parts.slice(1).join(' ');
    }
    setEditForm({
      ...(({ first_name: first, last_name: last } as any)),
      name: c.name || '',
      flat_number: c.flat_number || '',
      building_name: c.building_name || '',
      building_number: c.building_number || '',
      street: c.street || '',
      town: c.town || '',
      county: c.county || '',
      postcode: c.postcode || '',
    } as any);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setIsSavingEdit(true);
    const f = editForm as any;
    const first = (f.first_name || '').trim();
    const last = (f.last_name || '').trim();
    const fullName = `${first} ${last}`.trim();
    const updates: any = {
      first_name: first || null,
      last_name: last || null,
      name: fullName || null,
      flat_number: editForm.flat_number?.trim() || null,
      building_name: editForm.building_name?.trim() || null,
      building_number: editForm.building_number?.trim() || null,
      street: editForm.street?.trim() || null,
      town: editForm.town?.trim() || null,
      county: editForm.county?.trim() || null,
      postcode: editForm.postcode?.trim() || null,
    };
    const { error } = await supabase.from('customers').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', editingId);
    if (error) {
      setIsSavingEdit(false);
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }

    // Mirror to customer_policies so the customer dashboard / portal show the same details
    const composedAddress = [
      updates.flat_number,
      updates.building_name,
      [updates.building_number, updates.street].filter(Boolean).join(' '),
      updates.town,
      updates.county,
      updates.postcode,
    ].filter(Boolean).join(', ');
    const { error: polError } = await supabase
      .from('customer_policies')
      .update({
        customer_full_name: fullName || null,
        address: composedAddress || null,
        updated_at: new Date().toISOString(),
      })
      .eq('customer_id', editingId);
    if (polError) {
      console.error('customer_policies sync failed:', polError);
    }
    setIsSavingEdit(false);

    setQueue(prev => prev.map(q => (q.id === editingId ? { ...q, ...updates } as QueuedCustomer : q)));
    toast({ title: 'Saved', description: 'Customer details updated.' });
    setEditingId(null);
    setEditForm({});
  };


  const clearQueue = () => {
    if (queue.length === 0) return;
    if (!window.confirm(`Clear all ${queue.length} entries from the batch without marking as posted?`)) return;
    setQueue([]);
  };

  const saveBatchNow = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
      const now = new Date().toISOString();
      localStorage.setItem(SAVED_AT_KEY, now);
      setSavedAt(now);
      toast({ title: 'Batch saved', description: `${queue.length} customer${queue.length === 1 ? '' : 's'} saved. You can keep adding more.` });
    } catch (e) {
      toast({ title: 'Save failed', description: 'Browser storage is full.', variant: 'destructive' });
    }
  };

  const confirmAllPosted = async () => {
    if (queue.length === 0) return;
    if (!window.confirm(`Mark all ${queue.length} pack(s) as posted? They will be archived in the Letter Log and removed from this batch.`)) return;
    try {
      const inserts = queue.map(c => ({
        customer_id: c.id,
        registration_plate: c.registration_plate || 'N/A',
        customer_name: c.name,
        customer_email: c.email,
        warranty_number: c.policy?.warranty_number || c.warranty_number || c.warranty_reference_number || null,
        plan_type: c.policy?.plan_type || c.plan_type || null,
        sent_at: new Date().toISOString(),
        action_type: 'batch_posted',
        notes: `Confirmed posted — batch of ${queue.length}`,
      }));
      await supabase.from('posted_letters_log').insert(inserts as any);
    } catch (e) { /* silent */ }
    const count = queue.length;
    setQueue([]);
    toast({ title: 'Batch archived to Letter Log', description: `${count} entr${count === 1 ? 'y' : 'ies'} cleared and logged as sent.` });
  };

  const formatAddress = (c: QueuedCustomer) => {
    return [
      c.flat_number && `Flat ${c.flat_number}`,
      c.building_name,
      c.building_number && c.street ? `${c.building_number} ${c.street}` : c.street,
      c.town,
      c.county,
      c.postcode,
    ].filter(Boolean) as string[];
  };

  // Validate address/name completeness for posting
  const getIssues = (c: QueuedCustomer): string[] => {
    const issues: string[] = [];
    if (!c.name || !c.name.trim()) issues.push('Missing name');
    const hasStreet = !!(c.street || c.building_number || c.building_name || c.flat_number);
    if (!hasStreet) issues.push('Missing street/building');
    if (!c.town || !c.town.trim()) issues.push('Missing town');
    if (!c.postcode || !c.postcode.trim()) issues.push('Missing postcode');
    return issues;
  };

  const incompleteCount = queue.filter(c => getIssues(c).length > 0).length;

  // Download all addresses as a single Word document (.doc) for printing in one go
  const handleDownloadAddressesWord = () => {
    if (queue.length === 0) return;

    const rows = queue.map((c, i) => {
      const issues = getIssues(c);
      const lines = [c.name, ...formatAddress(c)].filter(Boolean) as string[];
      const issueLine = issues.length
        ? `<p style="color:#c00;font-size:10pt;margin:6pt 0 0"><b>⚠ Incomplete:</b> ${issues.join(', ')}</p>`
        : '';
      const regLine = c.registration_plate
        ? `<p style="color:#555;font-size:9pt;margin:6pt 0 0"><b>Reg:</b> ${c.registration_plate}</p>`
        : '';
      return `
        <div style="border:1px solid #999;padding:14pt 16pt;margin-bottom:10pt;page-break-inside:avoid;${issues.length ? 'background:#fff5f5;border-color:#c00;' : ''}">
          <p style="color:#888;font-size:9pt;margin:0 0 8pt"><b>#${i + 1}</b></p>
          ${lines.map(l => `<p style="margin:2pt 0;font-size:13pt;font-weight:600">${l}</p>`).join('')}
          ${regLine}
          ${issueLine}
        </div>
      `;
    }).join('');

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Addresses to Post</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>@page { size: A4; margin: 18mm; } body { font-family: 'Segoe UI', Arial, sans-serif; color: #000; }</style>
</head><body>
<h1 style="font-size:18pt;margin:0 0 12pt">Addresses to Post — ${new Date().toLocaleDateString('en-GB')}</h1>
<p style="font-size:11pt;color:#444;margin:0 0 16pt">${queue.length} item${queue.length === 1 ? '' : 's'}${incompleteCount > 0 ? ` &nbsp;•&nbsp; <span style="color:#c00"><b>${incompleteCount} incomplete</b></span>` : ''}</p>
${rows}
</body></html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `addresses-to-post-${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    logBatchAction('word_addresses');
  };


  // Batch print labels (2x4 grid per page)
  const handleBatchPrintLabels = () => {
    if (queue.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Allow pop-ups'); return; }

    const labels = queue.map(c => {
      const lines = [c.name, ...formatAddress(c)].filter(Boolean);
      return `<div class="label">${lines.map(l => `<p>${l}</p>`).join('')}</div>`;
    });

    // Pad to fill last page (8 per page)
    while (labels.length % 8 !== 0) {
      labels.push('<div class="label"></div>');
    }

    const pages: string[] = [];
    for (let i = 0; i < labels.length; i += 8) {
      pages.push(`<div class="page">${labels.slice(i, i + 8).join('')}</div>`);
    }

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Batch Labels</title><style>
      @page { size: A4; margin: 10mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; }
      .page { width: 190mm; height: 277mm; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(4, 1fr); gap: 4mm; page-break-after: always; }
      .page:last-child { page-break-after: auto; }
      .label { border: 1px dashed #ccc; padding: 8mm; display: flex; flex-direction: column; justify-content: center; font-size: 13pt; line-height: 1.5; font-weight: 500; }
      .label p { margin: 0; }
      @media print { .label { border: none; } }
    </style></head><body>${pages.join('')}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);

    // Log all
    logBatchAction('label');
  };

  // Batch print Brother QL labels (29mm x 90mm, one per page)
  const handleBatchPrintBrotherLabels = () => {
    if (queue.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Allow pop-ups'); return; }

    const labels = queue.map(c => {
      const lines = [c.name, ...formatAddress(c)].filter(Boolean);
      return `<div class="label">${lines.map(l => `<p>${l}</p>`).join('')}</div>`;
    });

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Brother QL Labels</title><style>
      @page { size: 90mm 29mm; margin: 0; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; }
      .label { width: 90mm; height: 29mm; padding: 1.5mm 3mm; display: flex; flex-direction: column; justify-content: center; font-size: 7pt; line-height: 1.35; font-weight: 600; page-break-after: always; overflow: hidden; }
      .label:last-child { page-break-after: auto; }
      .label p { margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    </style></head><body>${labels.join('')}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);

    logBatchAction('label');
  };

  // Batch print letters
  const handleBatchPrintLetters = () => {
    if (queue.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Allow pop-ups'); return; }

    const isBW = printMode === 'bw';
    const letterPages = queue.map(c => buildLetterHTML(c, isBW)).join('');

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Batch Letters</title><style>
      @page { size: A4; margin: 15mm 18mm; margin-top: 0; margin-bottom: 0; }
      @media print { @page { margin-top: 0; margin-bottom: 0; } body { margin-top: 0; } .letter-page { page-break-after: always; padding-top: 15mm; } .letter-page:last-child { page-break-after: auto; } }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.5; background: white; font-size: 11px; }
      .letter-page { max-width: 210mm; margin: 0 auto; page-break-after: always; padding: 15mm 0; }
      .letter-page:last-child { page-break-after: auto; }
      ${isBW ? '' : '@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }'}
    </style></head><body>${letterPages}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);

    logBatchAction('print');
  };

  const handleBatchPrintBoth = () => {
    handleBatchPrintLabels();
    setTimeout(() => handleBatchPrintLetters(), 1000);
  };

  const logBatchAction = async (type: string) => {
    try {
      const inserts = queue.map(c => ({
        customer_id: c.id,
        registration_plate: c.registration_plate || 'N/A',
        customer_name: c.name,
        customer_email: c.email,
        warranty_number: c.policy?.warranty_number || c.warranty_number || c.warranty_reference_number || null,
        plan_type: c.policy?.plan_type || c.plan_type || null,
        sent_at: new Date().toISOString(),
        action_type: `batch_${type}`,
        notes: `Batch ${type} — ${queue.length} customers`,
      }));
      await supabase.from('posted_letters_log').insert(inserts as any);
    } catch (e) { /* silent */ }
  };

  return (
    <Card className="border-2 border-dashed border-primary/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            To Post
            {queue.length > 0 && (
              <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-bold">{queue.length}</span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border rounded-lg overflow-hidden">
              <button
                onClick={() => setPrintMode('bw')}
                className={`px-2 py-1 text-xs font-medium transition-colors ${printMode === 'bw' ? 'bg-foreground text-background' : 'bg-background text-foreground hover:bg-muted'}`}
              >
                B&W
              </button>
              <button
                onClick={() => setPrintMode('colour')}
                className={`px-2 py-1 text-xs font-medium transition-colors ${printMode === 'colour' ? 'bg-foreground text-background' : 'bg-background text-foreground hover:bg-muted'}`}
              >
                Colour
              </button>
            </div>
            {queue.length > 0 && (
              <>
                <Button size="sm" onClick={confirmAllPosted} className="text-xs gap-1 bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark All Posted
                </Button>
                <Button size="sm" variant="ghost" onClick={clearQueue} className="text-destructive hover:text-destructive text-xs gap-1">
                  <Trash2 className="h-3.5 w-3.5" /> Clear All
                </Button>
              </>
            )}
          </div>
        </div>
        <p className="text-muted-foreground text-sm">
          This batch is auto-saved — you can keep adding customers across sessions. Printing labels, letters or the Word
          address sheet does <strong>not</strong> clear the batch. Click <em>Mark All Posted</em> when every pack is in the
          post — the batch will then be archived to the <strong>Letter Log</strong> tab and cleared so you can start a new batch.
        </p>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          {queue.length > 0 && savedAt && (
            <span className="flex items-center gap-1.5">
              <Save className="h-3 w-3" />
              Autosaved {format(new Date(savedAt), 'd MMM yyyy, HH:mm')} • {queue.length} pending
            </span>
          )}
          {queue.length > 0 && (
            <Button size="sm" variant="outline" onClick={saveBatchNow} className="h-7 text-xs gap-1">
              <Save className="h-3 w-3" /> Save batch
            </Button>
          )}
        </div>
        {incompleteCount > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <strong>{incompleteCount}</strong> {incompleteCount === 1 ? 'entry has' : 'entries have'} incomplete name or address details — please fix on the customer record before posting.
            </div>
          </div>
        )}

      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search to add */}
        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search to add customer to batch..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value) setShowDropdown(true); }}
              onFocus={() => { if (searchQuery) setShowDropdown(true); }}
              className="pl-10"
            />
          </div>
          {showDropdown && searchQuery.trim() && (
            <div className="absolute z-50 mt-1 w-full bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {isSearching ? (
                <div className="px-4 py-4 text-center text-sm text-muted-foreground">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-4 text-center text-sm text-muted-foreground">No customers found</div>
              ) : (
                searchResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => addToQueue(c)}
                    className={`w-full text-left px-4 py-2.5 hover:bg-muted/50 transition-colors flex items-center justify-between border-b last:border-b-0 ${queue.find(q => q.id === c.id) ? 'opacity-40' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {c.registration_plate && (
                        <span className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono font-semibold">{c.registration_plate}</span>
                      )}
                      {queue.find(q => q.id === c.id) ? (
                        <span className="text-xs text-muted-foreground">Added</span>
                      ) : (
                        <Plus className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Queue list */}
        {queue.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="py-2 px-3 text-left font-medium text-muted-foreground">#</th>
                  <th className="py-2 px-3 text-left font-medium text-muted-foreground">Customer</th>
                  <th className="py-2 px-3 text-left font-medium text-muted-foreground">Reg</th>
                  <th className="py-2 px-3 text-left font-medium text-muted-foreground">Plan</th>
                  <th className="py-2 px-3 text-left font-medium text-muted-foreground">Warranty #</th>
                  <th className="py-2 px-3 text-left font-medium text-muted-foreground">Address</th>
                  <th className="py-2 px-3 text-right font-medium text-muted-foreground w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((c, i) => {
                  const issues = getIssues(c);
                  const hasIssue = issues.length > 0;
                  return (
                    <tr
                      key={c.id}
                      className={`border-b ${hasIssue ? 'bg-destructive/5 hover:bg-destructive/10' : 'hover:bg-muted/20'}`}
                    >
                      <td className="py-2 px-3 text-muted-foreground align-top">{i + 1}</td>
                      <td className="py-2 px-3 align-top">
                        <p className="font-medium flex items-center gap-1.5">
                          {hasIssue && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                          {c.name || <span className="text-destructive italic">No name</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </td>
                      <td className="py-2 px-3 align-top">
                        <span className="font-mono font-semibold bg-muted px-1.5 py-0.5 rounded text-xs">{c.registration_plate || '—'}</span>
                      </td>
                      <td className="py-2 px-3 text-xs align-top">{c.policy?.plan_type || c.plan_type || '—'}</td>
                      <td className="py-2 px-3 text-xs font-mono align-top">{c.policy?.warranty_number || c.warranty_number || c.warranty_reference_number || '—'}</td>
                      <td className="py-2 px-3 text-xs align-top max-w-[240px]">
                        <div className="text-muted-foreground truncate">{formatAddress(c).join(', ') || 'No address'}</div>
                        {hasIssue && (
                          <div className="mt-1 text-[11px] font-medium text-destructive flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> {issues.join(' • ')}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 align-top text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="outline" className="h-7 px-2 gap-1" onClick={() => openEdit(c)} title="Edit name & address">
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => removeFromQueue(c.id)} title="Remove from batch">
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        )}

        {/* Batch action buttons */}
        {queue.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button onClick={handleBatchPrintLabels} variant="secondary" className="gap-2 bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300">
              <Tag className="h-4 w-4" />
              🏷️ Envelope Labels ({queue.length})
            </Button>
            <Button onClick={handleBatchPrintBoth} className="gap-2">
              <Printer className="h-4 w-4" />
              Print Letters and Address Print Labels ({queue.length})
            </Button>
            <Button onClick={handleDownloadAddressesWord} variant="secondary" className="gap-2 bg-blue-100 text-blue-900 hover:bg-blue-200 border border-blue-300">
              <FileDown className="h-4 w-4" />
              Addresses only (Word)
            </Button>
            <Button onClick={() => { saveBatchNow(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} variant="outline" className="gap-2 bg-green-50 text-green-700 hover:bg-green-100 border-green-200">
              <Check className="h-4 w-4" />
              Done
            </Button>
          </div>
        )}

        {queue.length === 0 && (
          <p className="text-center text-muted-foreground py-4 text-sm">
            Search above to add customers to the batch queue. You can then print all their labels and/or letters in one go.
          </p>
        )}
      </CardContent>

      <Dialog open={!!editingId} onOpenChange={(o) => { if (!o) { setEditingId(null); setEditForm({}); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit customer details</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First name</Label>
                <Input value={(editForm as any).first_name || ''} onChange={(e) => setEditForm(f => ({ ...f, first_name: e.target.value } as any))} placeholder="John" />
              </div>
              <div>
                <Label>Surname</Label>
                <Input value={(editForm as any).last_name || ''} onChange={(e) => setEditForm(f => ({ ...f, last_name: e.target.value } as any))} placeholder="Smith" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Flat / Apt</Label>
                <Input value={editForm.flat_number || ''} onChange={(e) => setEditForm(f => ({ ...f, flat_number: e.target.value }))} />
              </div>
              <div>
                <Label>Building name</Label>
                <Input value={editForm.building_name || ''} onChange={(e) => setEditForm(f => ({ ...f, building_name: e.target.value }))} />
              </div>
              <div>
                <Label>Building number</Label>
                <Input value={editForm.building_number || ''} onChange={(e) => setEditForm(f => ({ ...f, building_number: e.target.value }))} />
              </div>
              <div>
                <Label>Street</Label>
                <Input value={editForm.street || ''} onChange={(e) => setEditForm(f => ({ ...f, street: e.target.value }))} />
              </div>
              <div>
                <Label>Town / City</Label>
                <Input value={editForm.town || ''} onChange={(e) => setEditForm(f => ({ ...f, town: e.target.value }))} />
              </div>
              <div>
                <Label>County</Label>
                <Input value={editForm.county || ''} onChange={(e) => setEditForm(f => ({ ...f, county: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>Postcode</Label>
                <Input value={editForm.postcode || ''} onChange={(e) => setEditForm(f => ({ ...f, postcode: e.target.value.toUpperCase() }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditingId(null); setEditForm({}); }}>Cancel</Button>
            <Button onClick={saveEdit} disabled={isSavingEdit}>{isSavingEdit ? 'Saving...' : 'Save changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

// Build a single letter page HTML for batch printing
function buildLetterHTML(c: QueuedCustomer, isBW: boolean): string {
  const col = {
    accent: isBW ? '#333' : '#eb4b00',
    accentGrad: isBW ? '#333' : 'linear-gradient(135deg, #eb4b00 0%, #ff6b2b 100%)',
    heading: isBW ? '#000' : '#1e3a5f',
    border: isBW ? '#999' : '#e2e8f0',
    borderAccent: isBW ? '#333' : '#eb4b00',
    glanceBg: isBW ? '#f5f5f5' : '#f8fafc',
    glanceBorder: isBW ? '#ccc' : '#e2e8f0',
    benefitsBg: isBW ? '#f5f5f5' : '#f0fdf4',
    benefitsBorder: isBW ? '#aaa' : '#86efac',
    benefitsHeading: isBW ? '#000' : '#166534',
    benefitsText: isBW ? '#333' : '#15803d',
    claimsBg: isBW ? '#f5f5f5' : '#fef3c7',
    claimsBorder: isBW ? '#aaa' : '#fbbf24',
    claimsHeading: isBW ? '#000' : '#92400e',
    claimsText: isBW ? '#333' : '#78350f',
    accountBg: isBW ? '#f5f5f5' : '#f8fafc',
    accountBorder: isBW ? '#ccc' : '#e2e8f0',
    accountHeading: isBW ? '#000' : '#1e3a5f',
    contactValue: isBW ? '#000' : '#eb4b00',
    muted: isBW ? '#555' : '#64748b',
    legal: isBW ? '#777' : '#94a3b8',
    divider: isBW ? '#ccc' : '#f0f0f0',
  };

  const policy = c.policy;
  const address = [
    c.flat_number && `Flat ${c.flat_number}`,
    c.building_name,
    c.building_number && c.street ? `${c.building_number} ${c.street}` : c.street,
    c.town,
    c.county,
    c.postcode,
  ].filter(Boolean);

  const warrantyRef = policy?.warranty_number || c.warranty_number || c.warranty_reference_number || 'N/A';
  const planType = policy?.plan_type || c.plan_type || 'N/A';
  const claimLimit = policy?.claim_limit || c.claim_limit;
  const excess = policy?.voluntary_excess ?? c.voluntary_excess;
  const labourRate = c.labour_rate;
  const todayDate = format(new Date(), 'd MMMM yyyy');

  const addons: string[] = [];
  if (c.wear_tear) addons.push('Wear & Tear Cover');
  if (c.europe_cover) addons.push('European Cover');
  if (c.mot_repair) addons.push('MOT Repair Cover');
  if (c.tyre_cover) addons.push('Tyre Cover');
  if (c.lost_key) addons.push('Lost Key Cover');
  if (c.vehicle_rental) addons.push('Vehicle Rental Cover');
  if (c.transfer_cover) addons.push('Transfer Cover');
  if (c.consequential) addons.push('Consequential Loss Cover');

  const bonusMonths = Number(policy?.seasonal_bonus_months ?? c.seasonal_bonus_months ?? 0);

  const getDuration = () => {
    if (!policy) return 'N/A';
    const start = new Date(policy.policy_start_date);
    const end = new Date(policy.policy_end_date);
    if (bonusMonths > 0) end.setMonth(end.getMonth() + bonusMonths);
    const months = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (bonusMonths > 0) return `${months} Months`;
    if (months >= 36) return '3 Years';
    if (months >= 24) return '2 Years';
    if (months >= 12) return '1 Year';
    return `${months} Months`;
  };

  const endDate = (() => {
    if (!policy) return 'N/A';
    const d = new Date(policy.policy_end_date);
    if (bonusMonths > 0) d.setMonth(d.getMonth() + bonusMonths);
    return format(d, 'd MMM yyyy');
  })();

  const claimLimitDisplay = claimLimit ? `£${getDisplayClaimLimitValue(claimLimit).toLocaleString()}` : '';

  return `<div class="letter-page">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:3px solid ${col.borderAccent};margin-bottom:14px">
      <img src="https://buyawarranty.co.uk/lovable-uploads/baw-logo-new-2025.png" alt="BAW" style="height:40px;${isBW ? 'filter:grayscale(100%)' : ''}" />
      <div style="text-align:right;font-size:9px;color:#666;line-height:1.4">
        <p style="font-weight:600">Buy A Warranty Ltd</p><p>Warranty House, 62 Berkhamsted Ave</p><p>Wembley, HA9 6DT</p><p>Company No: 10314863</p>
      </div>
    </div>
    <div style="text-align:right;font-size:10px;color:#666;margin-bottom:12px">${todayDate}</div>
    <div style="margin-bottom:14px;font-size:11px">
      <p style="font-weight:700;font-size:11px;margin:1px 0">${c.name}</p>
      ${address.map(l => `<p style="margin:1px 0">${l}</p>`).join('')}
      <p style="margin:4px 0 0;color:#666">${c.email}</p>
    </div>
    <h1 style="font-size:18px;font-weight:700;color:${col.heading};margin-bottom:10px">Your Warranty Cover Document</h1>
    <div style="background:${isBW ? '#333' : col.accentGrad};color:white;padding:8px 16px;border-radius:6px;display:inline-block;margin-bottom:14px">
      <div style="font-size:8px;text-transform:uppercase;letter-spacing:1px;opacity:0.9">Warranty Reference</div>
      <div style="font-size:15px;font-weight:700;margin-top:2px">${warrantyRef}</div>
    </div>
    <p style="margin-bottom:8px;font-size:11px">Dear ${c.name.split(' ')[0]},</p>
    <p style="margin-bottom:12px;color:#333;font-size:11px">Thank you for choosing Buyawarranty to protect your vehicle. Please find below a summary of your warranty cover.</p>
    ${policy ? `<div style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:${col.heading};margin-bottom:8px;border-bottom:2px solid ${col.border};padding-bottom:4px">Your Cover at a Glance</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;background:${col.glanceBg};border:1px solid ${col.glanceBorder};border-radius:6px;padding:12px 14px">
        ${[
          ['Vehicle', c.registration_plate || '-'],
          ['Plan Type', planType],
          ['Duration', getDuration()],
          ['Mileage', c.mileage ? `${parseInt(c.mileage).toLocaleString()} miles` : 'N/A'],
          ['Start Date', format(new Date(policy.policy_start_date), 'd MMM yyyy')],
          ['End Date', endDate],
          ['Warranty Ref', warrantyRef],
          ['Policy No.', policy.policy_number],
        ].map(([label, value]) => `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid ${col.divider}"><span style="color:${col.muted};font-weight:500">${label}</span><span style="font-weight:600">${value}</span></div>`).join('')}
      </div>
    </div>` : ''}
    <div style="margin-bottom:14px">
      <div style="font-size:13px;font-weight:700;color:${col.heading};margin-bottom:8px;border-bottom:2px solid ${col.border};padding-bottom:4px">What Your Warranty Includes</div>
      <div style="background:${col.benefitsBg};border:1px solid ${col.benefitsBorder};border-radius:6px;padding:10px 14px;margin-bottom:8px">
        <h4 style="color:${col.benefitsHeading};font-size:12px;margin-bottom:6px;font-weight:700">Key Benefits</h4>
        <ul style="margin:0;padding-left:16px;color:${col.benefitsText};font-size:10.5px">
          <li style="margin-bottom:3px">Protection for major mechanical and electrical components</li>
          ${claimLimitDisplay ? `<li style="margin-bottom:3px">Claims limit of ${claimLimitDisplay} per claim</li>` : ''}
          ${labourRate ? `<li style="margin-bottom:3px">Labour rate covered up to £${labourRate}/hour</li>` : ''}
          ${excess !== undefined && excess !== null ? `<li style="margin-bottom:3px">Voluntary excess of £${excess} per claim</li>` : ''}
          <li style="margin-bottom:3px">Access to trusted UK-wide VAT registered repair garages</li>
          <li style="margin-bottom:3px">Fast, simple claims process via our dedicated claims team</li>
          ${c.breakdown_recovery ? '<li style="margin-bottom:3px">Breakdown recovery claimback</li>' : ''}
        </ul>
      </div>
      ${addons.length > 0 || bonusMonths > 0 ? `<div style="background:${isBW ? '#f5f5f5' : '#eff6ff'};border:1px solid ${isBW ? '#aaa' : '#93c5fd'};border-radius:6px;padding:10px 14px">
        <h4 style="color:${isBW ? '#000' : '#1e40af'};font-size:12px;margin-bottom:6px;font-weight:700">Additional Included Services</h4>
        <ul style="margin:0;padding-left:16px;color:${isBW ? '#333' : '#1d4ed8'};font-size:10.5px">
          ${addons.map(a => `<li style="margin-bottom:3px">✓ ${a}</li>`).join('')}
          ${bonusMonths > 0 ? `<li style="margin-bottom:3px">✓ Free extended cover: ${bonusMonths} bonus month${bonusMonths > 1 ? 's' : ''}</li>` : ''}
        </ul>
      </div>` : ''}
    </div>
    ${(policy as any)?.additional_notes?.trim() ? `<div style="background:${isBW ? '#f5f5f5' : '#fef9ee'};border:2px solid ${isBW ? '#666' : '#f59e0b'};border-radius:6px;padding:12px 14px;margin-bottom:14px">
      <h4 style="color:${isBW ? '#000' : '#92400e'};font-size:13px;margin-bottom:6px;font-weight:700">⭐ Important Notes About Your Cover</h4>
      <p style="color:${isBW ? '#333' : '#78350f'};font-size:11px;margin:0;white-space:pre-wrap;line-height:1.5">${(policy as any).additional_notes}</p>
    </div>` : ''}
    <div style="background:${col.claimsBg};border:1px solid ${col.claimsBorder};border-radius:6px;padding:10px 14px;margin-bottom:14px">
      <h4 style="color:${col.claimsHeading};font-size:12px;margin-bottom:4px;font-weight:700">How to Make a Claim</h4>
      <p style="color:${col.claimsText};font-size:10.5px;margin:2px 0">Contact our Claims Team <strong>before</strong> any repairs are carried out.</p>
      <p style="color:${col.claimsText};font-size:10.5px;margin:4px 0;font-weight:700">Claims Hotline: 0330 229 5045</p>
      <p style="color:${col.claimsText};font-size:10.5px;margin:2px 0">Mon–Fri, 9am–5pm</p>
    </div>
    <div style="background:${col.accountBg};border:1px solid ${col.accountBorder};border-radius:6px;padding:10px 14px;margin-bottom:14px">
      <h4 style="color:${col.accountHeading};font-size:12px;margin-bottom:4px;font-weight:700">Your Account &amp; Policy Documents</h4>
      <p style="font-size:10.5px;color:#333;margin:2px 0">Access your documents online:</p>
      <p style="font-size:11px;color:${col.contactValue};margin:6px 0;font-weight:700">https://buyawarranty.co.uk/customer-dashboard/</p>
      <p style="font-size:10.5px;color:#333;margin:4px 0"><strong>Email:</strong> ${c.email}</p>
    </div>
    <div style="margin-top:16px;font-size:11px"><p style="margin:1px 0">Warm regards,</p><p style="margin:10px 0 1px;font-weight:600">The Buyawarranty Team</p></div>
    <div style="margin-top:18px;padding-top:10px;border-top:2px solid ${col.border};display:grid;grid-template-columns:repeat(3,1fr);gap:10px;font-size:10px">
      <div style="text-align:center"><div style="color:${col.muted};font-size:8px;text-transform:uppercase;letter-spacing:0.5px">Sales</div><div style="color:${col.contactValue};font-weight:600;font-size:12px;margin-top:2px">0330 229 5040</div></div>
      <div style="text-align:center"><div style="color:${col.muted};font-size:8px;text-transform:uppercase;letter-spacing:0.5px">Claims</div><div style="color:${col.contactValue};font-weight:600;font-size:12px;margin-top:2px">0330 229 5045</div></div>
      <div style="text-align:center"><div style="color:${col.muted};font-size:8px;text-transform:uppercase;letter-spacing:0.5px">Support</div><div style="color:${col.contactValue};font-weight:600;font-size:12px;margin-top:2px">support@buyawarranty.co.uk</div></div>
    </div>
    <div style="margin-top:12px;padding-top:8px;border-top:1px solid ${col.border};font-size:8px;color:${col.legal};text-align:center">Buy A Warranty Ltd — Company No: 10314863 — Warranty House, 62 Berkhamsted Ave, Wembley, HA9 6DT</div>
  </div>`;
}
