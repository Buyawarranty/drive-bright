import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Search, Mail, Phone, Car, CheckCircle2, Clock, Send, Download, Tag, Printer, FileText, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';

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

export const PostedLettersLog: React.FC = () => {
  const [logEntries, setLogEntries] = useState<PostedLetterEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchedCustomers, setMatchedCustomers] = useState<CustomerMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
      toast({ title: 'Marked as sent', description: `Letter for ${entry.customer_name} marked as sent today.` });
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

  // Filter log entries
  const filteredEntries = useMemo(() => {
    if (!filterQuery.trim()) return logEntries;
    const q = filterQuery.toLowerCase().replace(/\s/g, '');
    return logEntries.filter(e => {
      const reg = (e.registration_plate || '').toLowerCase().replace(/\s/g, '');
      return (
        reg.includes(q) ||
        e.customer_name.toLowerCase().includes(filterQuery.toLowerCase()) ||
        (e.customer_email || '').toLowerCase().includes(filterQuery.toLowerCase()) ||
        (e.warranty_number || '').toLowerCase().includes(filterQuery.toLowerCase())
      );
    });
  }, [filterQuery, logEntries]);

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
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                onClick={() => printBatchLabels(selectedEntries)}
                className="gap-1 bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Printer className="h-3.5 w-3.5" />
                Print {selectedIds.size} Label{selectedIds.size !== 1 ? 's' : ''}
              </Button>
            )}
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
                    <th className="py-2 px-2 w-10">
                      <Checkbox
                        checked={filteredEntries.length > 0 && selectedIds.size === filteredEntries.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                    <th className="py-2 px-2 font-medium text-muted-foreground w-10">Sent</th>
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
                  {filteredEntries.map(entry => (
                    <tr key={entry.id} className={`border-b hover:bg-muted/30 transition-colors ${entry.marked_sent_by ? 'bg-green-50/50' : ''} ${selectedIds.has(entry.id) ? 'bg-primary/5' : ''}`}>
                      <td className="py-2 px-2">
                        <Checkbox
                          checked={selectedIds.has(entry.id)}
                          onCheckedChange={() => toggleSelect(entry.id)}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Checkbox
                          checked={!!entry.marked_sent_by}
                          onCheckedChange={() => {
                            if (!entry.marked_sent_by) markAsSent(entry);
                          }}
                          disabled={!!entry.marked_sent_by}
                        />
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
                        <span className="font-mono font-semibold bg-muted px-1.5 py-0.5 rounded text-xs">
                          {entry.registration_plate}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-medium">{entry.customer_name}</td>
                      <td className="py-2 px-2 text-muted-foreground text-xs">{entry.customer_email || '—'}</td>
                      <td className="py-2 px-2 text-xs font-mono">{entry.warranty_number || '—'}</td>
                      <td className="py-2 px-2 text-xs">{entry.plan_type || '—'}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
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
                            variant="ghost"
                            className="text-xs text-destructive hover:text-destructive h-7"
                            onClick={() => removeEntry(entry.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
