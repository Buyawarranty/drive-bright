import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { Search, Mail, Phone, Car, CheckCircle2, Clock, Send, Download, Tag } from 'lucide-react';
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

// Print a C4 envelope label (229mm × 324mm) with name + address
const printEnvelopeLabel = async (entry: PostedLetterEntry) => {
  if (!entry.customer_id) {
    toast({ title: 'No customer linked', description: 'Cannot print label — no customer ID on this entry.', variant: 'destructive' });
    return;
  }

  // Fetch customer address
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

export const PostedLettersLog: React.FC = () => {
  const [logEntries, setLogEntries] = useState<PostedLetterEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [regSearch, setRegSearch] = useState('');
  const [matchedCustomers, setMatchedCustomers] = useState<CustomerMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load log entries
  const fetchLog = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('posted_letters_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!error && data) {
      setLogEntries(data as PostedLetterEntry[]);
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

  // Search customers by reg plate
  const searchByReg = async (query: string) => {
    if (!query.trim()) {
      setMatchedCustomers([]);
      return;
    }
    setIsSearching(true);
    const cleanReg = query.replace(/\s/g, '').toUpperCase();

    const { data, error } = await supabase
      .from('customers')
      .select('id, name, email, phone, registration_plate, warranty_number, plan_type')
      .or('is_deleted.is.null,is_deleted.eq.false')
      .ilike('registration_plate', `%${cleanReg}%`)
      .limit(20);

    if (!error && data) {
      setMatchedCustomers(data);
    }
    setIsSearching(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => searchByReg(regSearch), 300);
    return () => clearTimeout(timer);
  }, [regSearch]);

  // Add customer to the log (mark as ready to send)
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
      toast({ title: 'Added to log', description: `${customer.name} (${customer.registration_plate}) added to posted letters log.` });
      setRegSearch('');
      setShowDropdown(false);
      fetchLog();
    }
  };

  // Mark as sent (tick it off - date becomes now)
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
      fetchLog();
    }
  };

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
          Search by reg plate to add a customer, then tick them off when the letter is posted. The tick date = the date sent.
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

      {/* Add by Reg Plate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Car className="h-5 w-5" />
            Add Letter by Reg Plate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Type reg plate to search (e.g. AB12 CDE)..."
                value={regSearch}
                onChange={(e) => {
                  setRegSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="pl-10 font-mono uppercase"
              />
            </div>
            {showDropdown && regSearch.trim() && (
              <div className="absolute z-50 mt-1 w-full bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {isSearching ? (
                  <div className="px-4 py-4 text-center text-sm text-muted-foreground">Searching...</div>
                ) : matchedCustomers.length === 0 ? (
                  <div className="px-4 py-4 text-center text-sm text-muted-foreground">No customers found for this reg</div>
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
                        <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-xs font-mono font-semibold">
                          <Car className="h-3 w-3" />
                          {c.registration_plate}
                        </span>
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
            <p className="text-center text-muted-foreground py-8">No letters logged yet. Search by reg plate above to add one.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 px-2 font-medium text-muted-foreground w-10">Sent</th>
                    <th className="py-2 px-2 font-medium text-muted-foreground">Date Sent</th>
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
                    <tr key={entry.id} className={`border-b hover:bg-muted/30 transition-colors ${entry.marked_sent_by ? 'bg-green-50/50' : ''}`}>
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
                          {format(new Date(entry.sent_at), 'dd/MM/yyyy')}
                        </span>
                        {entry.marked_sent_by && (
                          <CheckCircle2 className="inline-block ml-1 h-3.5 w-3.5 text-green-600" />
                        )}
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
                            className="text-xs h-7 gap-1 bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200"
                            onClick={() => printEnvelopeLabel(entry)}
                            title="Print envelope label"
                          >
                            <Tag className="h-3 w-3" />
                            Label
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
