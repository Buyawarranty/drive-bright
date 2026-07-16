import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Search, Mail, Phone, Car, CheckCircle2, Clock, Send, Download, Tag, Printer, FileText, RotateCcw, Pencil, Eye, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

interface PostedLetterEntry {
  id: string;
  customer_id: string | null;
  registration_plate: string;
  customer_name: string;
  customer_email: string | null;
  warranty_number: string | null;
  plan_type: string | null;
  sent_at: string;
  marked_sent_by: string | null;
  notes: string | null;
  created_at: string;
  action_type: string | null;
}

interface CustomerMatch {
  id: string;
  name: string;
  email: string;
  phone?: string;
  registration_plate?: string;
  warranty_number?: string;
  plan_type: string;
}

// Print a single C4 envelope label (legacy - kept for single prints)
const printEnvelopeLabel = async (entry: PostedLetterEntry) => {
  if (!entry.customer_id) {
    toast({ title: 'No customer linked', description: 'Cannot print label — no customer ID on this entry.', variant: 'destructive' });
    return;
  }

  const { data: customer, error } = await supabase
    .from('customers')
    .select('name, flat_number, building_name, building_number, street, town, county, postcode')
    .eq('id', entry.customer_id)
    .maybeSingle();

  if (error || !customer) {
    toast({ title: 'Error', description: 'Could not load customer address.', variant: 'destructive' });
    return;
  }

  const addressParts = [
    customer.flat_number && `Flat ${customer.flat_number}`,
    customer.building_name,
    customer.building_number && customer.street
      ? `${customer.building_number} ${customer.street}`
      : customer.street,
    customer.town,
    customer.county,
    customer.postcode,
  ].filter(Boolean);

  const lines = [customer.name, ...addressParts].filter(Boolean);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to print the label');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Envelope Label - ${customer.name}</title>
        <style>
          @page { size: 324mm 229mm; margin: 0; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
            width: 324mm;
            height: 229mm;
            display: flex;
            justify-content: center;
            align-items: center;
            background: white;
          }
          .label {
            padding: 20mm;
            font-size: 22pt;
            line-height: 1.6;
            font-weight: 600;
            color: #000;
            text-align: left;
          }
          .label p { margin: 0; }
        </style>
      </head>
      <body>
        <div class="label">
          ${lines.map(l => `<p>${l}</p>`).join('')}
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); }, 250);
};

// Batch print multiple labels on A4 sheets (2 columns × 4 rows = 8 per page)
const printBatchLabels = async (entries: PostedLetterEntry[]) => {
  const customerIds = entries.map(e => e.customer_id).filter(Boolean) as string[];
  if (customerIds.length === 0) {
    toast({ title: 'No customers', description: 'Selected entries have no linked customers.', variant: 'destructive' });
    return;
  }

  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, name, flat_number, building_name, building_number, street, town, county, postcode')
    .in('id', customerIds);

  if (error || !customers) {
    toast({ title: 'Error', description: 'Could not load customer addresses.', variant: 'destructive' });
    return;
  }

  const customerMap = new Map(customers.map(c => [c.id, c]));

  const labels: string[][] = [];
  for (const entry of entries) {
    const customer = entry.customer_id ? customerMap.get(entry.customer_id) : null;
    if (!customer) continue;

    const addressParts = [
      customer.flat_number && `Flat ${customer.flat_number}`,
      customer.building_name,
      customer.building_number && customer.street
        ? `${customer.building_number} ${customer.street}`
        : customer.street,
      customer.town,
      customer.county,
      customer.postcode,
    ].filter(Boolean);

    labels.push([customer.name, ...addressParts].filter(Boolean) as string[]);
  }

  if (labels.length === 0) {
    toast({ title: 'No addresses', description: 'No valid addresses found for selected entries.', variant: 'destructive' });
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to print labels');
    return;
  }

  const labelsHtml = labels.map(lines =>
    `<div class="label">${lines.map(l => `<p>${l}</p>`).join('')}</div>`
  ).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Address Labels (${labels.length})</title>
        <style>
          @page { size: A4; margin: 10mm 10mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
            background: white;
            color: #000;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-auto-rows: calc((297mm - 20mm) / 4);
            width: 100%;
          }
          .label {
            padding: 6mm 8mm;
            font-size: 11pt;
            line-height: 1.5;
            font-weight: 500;
            border: 0.5px solid #ccc;
            overflow: hidden;
            page-break-inside: avoid;
          }
          .label p { margin: 0; }
          @media print {
            .label { border: 0.5px solid #ddd; }
          }
        </style>
      </head>
      <body>
        <div class="grid">
          ${labelsHtml}
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); }, 250);
};

// Open the envelope label in a new tab for viewing (no auto-print)
const viewEnvelopeLabel = async (entry: PostedLetterEntry) => {
  if (!entry.customer_id) {
    toast({ title: 'No customer linked', description: 'Cannot view label — no customer ID on this entry.', variant: 'destructive' });
    return;
  }
  const { data: customer } = await supabase
    .from('customers')
    .select('name, flat_number, building_name, building_number, street, town, county, postcode')
    .eq('id', entry.customer_id)
    .maybeSingle();
  if (!customer) {
    toast({ title: 'Error', description: 'Could not load customer address.', variant: 'destructive' });
    return;
  }
  const addressParts = [
    customer.flat_number && `Flat ${customer.flat_number}`,
    customer.building_name,
    customer.building_number && customer.street ? `${customer.building_number} ${customer.street}` : customer.street,
    customer.town, customer.county, customer.postcode,
  ].filter(Boolean);
  const lines = [customer.name, ...addressParts].filter(Boolean);
  const w = window.open('', '_blank');
  if (!w) { alert('Please allow pop-ups to view the label'); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>Envelope Label — ${customer.name}</title>
    <style>body{font-family:'Segoe UI',Tahoma,sans-serif;padding:40px;background:#f4f4f4}
    .label{background:white;padding:40px;max-width:600px;margin:0 auto;box-shadow:0 2px 12px rgba(0,0,0,.1);font-size:20pt;line-height:1.6;font-weight:600}
    .label p{margin:0}.hint{max-width:600px;margin:0 auto 16px;color:#666;font-size:13px}</style></head>
    <body><p class="hint">Envelope label preview. Use your browser's print button to print.</p>
    <div class="label">${lines.map(l => `<p>${l}</p>`).join('')}</div></body></html>`);
  w.document.close();
};

// Open the customer's latest policy document PDF in a new tab
const viewPolicyDocument = async (entry: PostedLetterEntry) => {
  if (!entry.customer_id) {
    toast({ title: 'No customer linked', description: 'Cannot open policy — no customer ID on this entry.', variant: 'destructive' });
    return;
  }
  const { data } = await (supabase as any)
    .from('customer_documents')
    .select('file_url, plan_type, created_at')
    .eq('customer_id', entry.customer_id)
    .order('created_at', { ascending: false })
    .limit(10);
  const doc = (data || []).find(d => d.plan_type === 'platinum') || (data || [])[0];
  if (!doc?.file_url) {
    toast({ title: 'No policy document', description: 'No policy PDF found for this customer.', variant: 'destructive' });
    return;
  }
  window.open(doc.file_url, '_blank');
};

export const PostedLettersLog: React.FC = () => {
  const [logEntries, setLogEntries] = useState<PostedLetterEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchedCustomers, setMatchedCustomers] = useState<CustomerMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingEntry, setEditingEntry] = useState<PostedLetterEntry | null>(null);
  const [editForm, setEditForm] = useState({ customer_name: '', customer_email: '', registration_plate: '', warranty_number: '', plan_type: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [postedUpToDate, setPostedUpToDate] = useState<string>(''); // yyyy-mm-dd
  const [isBulkMarking, setIsBulkMarking] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);


  // Load log entries
  const fetchLog = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('posted_letters_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!error && data) {
      setLogEntries(data as PostedLetterEntry[]);
    } else if (error) {
      console.error('Error fetching posted letters log:', error);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchLog(); }, []);

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

  // Search customers by name, email, or reg plate
  const searchCustomers = async (query: string) => {
    if (!query.trim()) {
      setMatchedCustomers([]);
      return;
    }
    setIsSearching(true);
    const cleanQuery = query.trim();
    const cleanReg = query.replace(/\s/g, '').toUpperCase();

    const { data, error } = await supabase
      .from('customers')
      .select('id, name, email, phone, registration_plate, warranty_number, plan_type')
      .or('is_deleted.is.null,is_deleted.eq.false')
      .or(`name.ilike.%${cleanQuery}%,email.ilike.%${cleanQuery}%,registration_plate.ilike.%${cleanReg}%`)
      .limit(20);

    if (!error && data) {
      setMatchedCustomers(data);
    }
    setIsSearching(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => searchCustomers(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Add customer to the log
  const addToLog = async (customer: CustomerMatch) => {
    const { error } = await supabase
      .from('posted_letters_log')
      .insert({
        customer_id: customer.id,
        registration_plate: customer.registration_plate || 'N/A',
        customer_name: customer.name,
        customer_email: customer.email,
        warranty_number: customer.warranty_number,
        plan_type: customer.plan_type,
        sent_at: new Date().toISOString(),
        marked_sent_by: null,
      });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Added to log', description: `${customer.name} added to posted letters log.` });
      setSearchQuery('');
      setShowDropdown(false);
      fetchLog();
    }
  };

  // Mark as sent
  const markAsSent = async (entry: PostedLetterEntry) => {
    const { error } = await supabase
      .from('posted_letters_log')
      .update({ 
        sent_at: new Date().toISOString(),
        marked_sent_by: 'admin'
      })
      .eq('id', entry.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Marked as posted', description: `Letter for ${entry.customer_name} marked as posted.` });
      fetchLog();
    }
  };

  // Un-mark (Posted → Pending)
  const unmarkAsSent = async (entry: PostedLetterEntry) => {
    const { error } = await supabase
      .from('posted_letters_log')
      .update({ marked_sent_by: null })
      .eq('id', entry.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Reverted to Pending', description: `${entry.customer_name} moved back to still-to-post.` });
      fetchLog();
    }
  };

  // Mark everything up to a chosen date as Posted (the "line in the sand")
  const markUpToDateAsPosted = async () => {
    if (!postedUpToDate) {
      toast({ title: 'Pick a date first', description: 'Choose the date up to which all letters have been posted.', variant: 'destructive' });
      return;
    }
    // Interpret the picked date as "end of that day" in the local timezone
    const cutoff = new Date(postedUpToDate + 'T23:59:59');
    const pendingBefore = logEntries.filter(e => !e.marked_sent_by && new Date(e.created_at) <= cutoff);

    if (pendingBefore.length === 0) {
      toast({ title: 'Nothing to update', description: 'No pending letters on or before that date.' });
      return;
    }

    setIsBulkMarking(true);
    const { error } = await supabase
      .from('posted_letters_log')
      .update({
        sent_at: new Date().toISOString(),
        marked_sent_by: 'admin',
      })
      .in('id', pendingBefore.map(e => e.id));
    setIsBulkMarking(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'Line drawn',
        description: `${pendingBefore.length} letter${pendingBefore.length !== 1 ? 's' : ''} up to ${format(cutoff, 'd MMM yyyy')} marked as posted.`,
      });
      fetchLog();
    }
  };


  // Bulk mark selected as already posted
  const bulkMarkAsPosted = async () => {
    const ids = Array.from(selectedIds);
    const pendingIds = filteredEntries
      .filter(e => selectedIds.has(e.id) && !e.marked_sent_by)
      .map(e => e.id);

    if (pendingIds.length === 0) {
      toast({ title: 'Nothing to update', description: 'Selected entries are already marked as posted.' });
      return;
    }

    const { error } = await supabase
      .from('posted_letters_log')
      .update({
        sent_at: new Date().toISOString(),
        marked_sent_by: 'admin',
      })
      .in('id', pendingIds);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Marked as posted', description: `${pendingIds.length} letter${pendingIds.length !== 1 ? 's' : ''} marked as already posted.` });
      setSelectedIds(new Set());
      fetchLog();
    }
  };

  // Remove entry
  const removeEntry = async (id: string) => {
    const { error } = await supabase
      .from('posted_letters_log')
      .delete()
      .eq('id', id);

    if (!error) {
      toast({ title: 'Removed', description: 'Entry removed from log.' });
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      fetchLog();
    }
  };

  // Open edit dialog
  const openEdit = (entry: PostedLetterEntry) => {
    setEditingEntry(entry);
    setEditForm({
      customer_name: entry.customer_name || '',
      customer_email: entry.customer_email || '',
      registration_plate: entry.registration_plate || '',
      warranty_number: entry.warranty_number || '',
      plan_type: entry.plan_type || '',
    });
  };

  const saveEdit = async () => {
    if (!editingEntry) return;
    setIsSavingEdit(true);
    const { error } = await supabase
      .from('posted_letters_log')
      .update({
        customer_name: editForm.customer_name.trim(),
        customer_email: editForm.customer_email.trim() || null,
        registration_plate: editForm.registration_plate.trim(),
        warranty_number: editForm.warranty_number.trim() || null,
        plan_type: editForm.plan_type.trim() || null,
      })
      .eq('id', editingEntry.id);
    setIsSavingEdit(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Entry updated', description: 'Log entry saved.' });
      setEditingEntry(null);
      fetchLog();
    }
  };

  // Reprint letter for a log entry — navigates to PolicyDocumentsTab with customer pre-selected

  const reprintLetter = useCallback(async (entry: PostedLetterEntry) => {
    if (!entry.customer_id) {
      toast({ title: 'No customer linked', description: 'Cannot reprint — no customer ID on this entry.', variant: 'destructive' });
      return;
    }

    // Log this reprint action
    await supabase.from('posted_letters_log').insert({
      customer_id: entry.customer_id,
      registration_plate: entry.registration_plate,
      customer_name: entry.customer_name,
      customer_email: entry.customer_email,
      warranty_number: entry.warranty_number,
      plan_type: entry.plan_type,
      sent_at: new Date().toISOString(),
      marked_sent_by: null,
      action_type: 'reprint',
      notes: `Reprinted from log entry ${format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm')}`,
    } as any);

    // Print the label directly
    await printEnvelopeLabel(entry);
    toast({ title: 'Reprinting', description: `Label for ${entry.customer_name} sent to printer.` });
    fetchLog();
  }, [fetchLog]);

  // Filter log entries, then sort so Pending (still-to-post) rows appear at the top
  // and Posted rows are grouped below — a divider row is inserted between the two groups.
  const filteredEntries = useMemo(() => {
    const base = !filterQuery.trim() ? logEntries : logEntries.filter(e => {
      const q = filterQuery.toLowerCase();
      const reg = (e.registration_plate || '').toLowerCase().replace(/\s/g, '');
      const qNoSpace = q.replace(/\s/g, '');
      return (
        reg.includes(qNoSpace) ||
        e.customer_name.toLowerCase().includes(q) ||
        (e.customer_email || '').toLowerCase().includes(q) ||
        (e.warranty_number || '').toLowerCase().includes(q)
      );
    });
    // Pending first (newest first), then Posted (most-recently-posted first)
    return [...base].sort((a, b) => {
      const aPending = !a.marked_sent_by;
      const bPending = !b.marked_sent_by;
      if (aPending !== bPending) return aPending ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filterQuery, logEntries]);

  // Index of the first Posted row (i.e. where to draw the "line in the sand")
  const firstPostedIndex = useMemo(
    () => filteredEntries.findIndex(e => !!e.marked_sent_by),
    [filteredEntries],
  );


  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntries.map(e => e.id)));
    }
  };

  const selectedEntries = filteredEntries.filter(e => selectedIds.has(e.id));

  // Export CSV
  const exportCSV = () => {
    const headers = ['Date Sent', 'Reg Plate', 'Customer Name', 'Email', 'Warranty Number', 'Plan Type', 'Status'];
    const rows = filteredEntries.map(e => [
      format(new Date(e.sent_at), 'dd/MM/yyyy'),
      e.registration_plate,
      e.customer_name,
      e.customer_email || '',
      e.warranty_number || '',
      e.plan_type || '',
      e.marked_sent_by ? 'Sent' : 'Pending',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `posted-letters-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sentCount = logEntries.filter(e => e.marked_sent_by).length;
  const pendingCount = logEntries.filter(e => !e.marked_sent_by).length;

  return (
    <div className="space-y-6 mt-8">
      <div>
        <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Send className="h-5 w-5 text-orange-500" />
          Posted Letters Log Register
        </h3>
        <p className="text-muted-foreground text-sm mt-1">
          Search by name, email, or reg plate to add a customer. Select multiple entries and print address labels on A4 sheets.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{logEntries.length}</p>
            <p className="text-xs text-muted-foreground">Total Letters</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{sentCount}</p>
            <p className="text-xs text-muted-foreground">Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Draw the "line in the sand" — mark everything up to a date as posted */}
      <Card className="border-amber-300 bg-amber-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-amber-600" />
            Mark posted up to date
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Pick the date you last posted letters up to. Everything on or before that date will be marked <strong>Posted</strong>. Anything after stays <strong>Pending</strong> above the line.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="posted-up-to" className="text-sm">Posted up to & including:</Label>
            <Input
              id="posted-up-to"
              type="date"
              value={postedUpToDate}
              onChange={(e) => setPostedUpToDate(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="w-[180px]"
            />
            <Button
              onClick={markUpToDateAsPosted}
              disabled={!postedUpToDate || isBulkMarking}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isBulkMarking ? 'Marking…' : 'Draw the line'}
            </Button>
            {postedUpToDate && (
              <span className="text-xs text-muted-foreground">
                Preview: {logEntries.filter(e => !e.marked_sent_by && new Date(e.created_at) <= new Date(postedUpToDate + 'T23:59:59')).length} pending letter(s) will be marked posted.
              </span>
            )}
          </div>
        </CardContent>
      </Card>


      {/* Add by Name / Email / Reg Plate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-5 w-5" />
            Add Customer to Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or reg plate..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="pl-10"
              />
            </div>
            {showDropdown && searchQuery.trim() && (
              <div className="absolute z-50 mt-1 w-full bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {isSearching ? (
                  <div className="px-4 py-4 text-center text-sm text-muted-foreground">Searching...</div>
                ) : matchedCustomers.length === 0 ? (
                  <div className="px-4 py-4 text-center text-sm text-muted-foreground">No customers found</div>
                ) : (
                  matchedCustomers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => addToLog(c)}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center justify-between border-b last:border-b-0"
                    >
                      <div>
                        <p className="font-semibold text-foreground">{c.name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>
                          {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        {c.registration_plate && (
                          <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-xs font-mono font-semibold">
                            <Car className="h-3 w-3" />
                            {c.registration_plate}
                          </span>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">{c.plan_type}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Log Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Letter Log
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Bulk selection removed — use the single "Posted" tick per row */}
            <div className="relative w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter log..."
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
            <Button size="sm" variant="outline" onClick={exportCSV} className="gap-1">
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading log...</p>
          ) : filteredEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No letters logged yet. Search above to add one.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-2 font-medium text-muted-foreground w-40">Posted?</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">Date</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">Type</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">Reg Plate</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">Customer</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">Email</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">Warranty #</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">Plan</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry, idx) => (
                    <React.Fragment key={entry.id}>
                      {idx === firstPostedIndex && idx > 0 && (
                        <tr className="bg-gradient-to-r from-green-100 via-green-50 to-green-100">
                          <td colSpan={9} className="py-2 px-3 text-xs font-bold text-green-800 uppercase tracking-wider text-center border-y-2 border-green-500">
                            ── Already posted below this line ({filteredEntries.length - firstPostedIndex}) ──
                          </td>
                        </tr>
                      )}
                      <tr className={`border-b hover:bg-muted/30 transition-colors ${entry.marked_sent_by ? 'bg-green-50/50' : 'bg-amber-50/60'}`}>
                      <td className="py-2 px-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <Checkbox
                            checked={!!entry.marked_sent_by}
                            onCheckedChange={() => {
                              if (entry.marked_sent_by) unmarkAsSent(entry);
                              else markAsSent(entry);
                            }}
                            title={entry.marked_sent_by ? 'Untick to move back to Pending' : 'Tick to confirm this letter has been posted'}
                            className={!entry.marked_sent_by ? 'border-amber-500 ring-2 ring-amber-300/60' : ''}
                          />
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide whitespace-nowrap ${
                            entry.marked_sent_by
                              ? 'bg-green-100 text-green-800 border border-green-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}>
                            {entry.marked_sent_by ? 'Posted' : 'Mark as posted'}
                          </span>
                        </label>
                      </td>

                      <td className="py-2 px-2">
                        <span className="text-foreground">
                          {format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm')}
                        </span>
                        {entry.marked_sent_by && (
                          <CheckCircle2 className="inline-block ml-1 h-3.5 w-3.5 text-green-600" />
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          entry.action_type === 'search' ? 'bg-blue-100 text-blue-700' :
                          entry.action_type === 'label' || entry.action_type === 'batch_label' ? 'bg-amber-100 text-amber-700' :
                          entry.action_type === 'print' || entry.action_type === 'batch_print' || entry.action_type === 'batch' ? 'bg-green-100 text-green-700' :
                          entry.action_type === 'reprint' ? 'bg-purple-100 text-purple-700' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {entry.action_type === 'search' ? 'Search' :
                           entry.action_type === 'label' ? 'Label' :
                           entry.action_type === 'batch_label' ? 'Batch Label' :
                           entry.action_type === 'print' ? 'Print' :
                           entry.action_type === 'batch_print' || entry.action_type === 'batch' ? 'Batch Print' :
                           entry.action_type === 'reprint' ? 'Reprint' :
                           entry.action_type || 'Manual'}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        {entry.customer_id ? (
                          <button
                            type="button"
                            onClick={() => {
                              sessionStorage.setItem('admin_impersonation', JSON.stringify({
                                customerId: entry.customer_id,
                                customerEmail: entry.customer_email,
                                customerName: entry.customer_name,
                                isImpersonating: true,
                                timestamp: Date.now()
                              }));
                              window.open('/customer-dashboard', '_blank');
                            }}
                            title="Open customer dashboard in new tab"
                            className="font-mono font-semibold bg-muted px-1.5 py-0.5 rounded text-xs hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
                          >
                            {entry.registration_plate}
                          </button>
                        ) : (
                          <span className="font-mono font-semibold bg-muted px-1.5 py-0.5 rounded text-xs">
                            {entry.registration_plate}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 font-medium">{entry.customer_name}</td>
                      <td className="py-2 px-2 text-muted-foreground text-xs">{entry.customer_email || '—'}</td>
                      <td className="py-2 px-2 text-xs font-mono">{entry.warranty_number || '—'}</td>
                      <td className="py-2 px-2 text-xs">{entry.plan_type || '—'}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="outline" className="text-xs h-7 gap-1" title="View documents">
                                <Eye className="h-3 w-3" />
                                View
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 bg-background z-50">
                              <DropdownMenuItem onClick={() => viewEnvelopeLabel(entry)}>
                                <Tag className="h-3.5 w-3.5 mr-2" /> Envelope label
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => viewPolicyDocument(entry)}>
                                <FileText className="h-3.5 w-3.5 mr-2" /> Policy document
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  if (!entry.customer_id) {
                                    toast({ title: 'No customer linked', variant: 'destructive' });
                                    return;
                                  }
                                  sessionStorage.setItem('admin_impersonation', JSON.stringify({
                                    customerId: entry.customer_id,
                                    customerEmail: entry.customer_email,
                                    customerName: entry.customer_name,
                                    isImpersonating: true,
                                    timestamp: Date.now(),
                                  }));
                                  window.open('/customer-dashboard', '_blank');
                                }}
                              >
                                <FileText className="h-3.5 w-3.5 mr-2" /> Warranty letter (portal)
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 gap-1"
                            onClick={() => reprintLetter(entry)}
                            title="Reprint label for this customer"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Reprint
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 gap-1"
                            onClick={() => openEdit(entry)}
                            title="Edit log entry details"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-destructive hover:text-destructive h-7"
                            onClick={() => removeEntry(entry.id)}
                          >
                            Remove
                          </Button>

                        </div>
                      </td>
                    </tr>
                    </React.Fragment>
                  ))}

                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Letter Log Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="edit-name">Customer Name</Label>
              <Input id="edit-name" value={editForm.customer_name} onChange={e => setEditForm(f => ({ ...f, customer_name: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={editForm.customer_email} onChange={e => setEditForm(f => ({ ...f, customer_email: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="edit-reg">Registration Plate</Label>
              <Input id="edit-reg" value={editForm.registration_plate} onChange={e => setEditForm(f => ({ ...f, registration_plate: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <Label htmlFor="edit-warranty">Warranty Number</Label>
              <Input id="edit-warranty" value={editForm.warranty_number} onChange={e => setEditForm(f => ({ ...f, warranty_number: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="edit-plan">Plan</Label>
              <Input id="edit-plan" value={editForm.plan_type} onChange={e => setEditForm(f => ({ ...f, plan_type: e.target.value }))} />
            </div>
            <p className="text-xs text-muted-foreground">
              Note: This edits the log entry only. To update the customer record permanently, edit them in the Customers tab.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEntry(null)} disabled={isSavingEdit}>Cancel</Button>
            <Button onClick={saveEdit} disabled={isSavingEdit || !editForm.customer_name.trim()}>
              {isSavingEdit ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
