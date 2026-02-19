import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, X, Search, Loader2, UserPlus, Download, ArrowUpDown, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Strict email validation to filter fake/invalid emails
const isValidEmail = (email: string): boolean => {
  const trimmed = email.trim().toLowerCase();
  // Basic format check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) return false;
  // Block disposable/temporary email domains
  const disposableDomains = [
    'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
    'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
    'dispostable.com', 'trashmail.com', 'fakeinbox.com', 'tempail.com',
    'maildrop.cc', 'mailnesia.com', 'mintemail.com', 'temp-mail.org',
    'mohmal.com', 'getnada.com', '10minutemail.com', 'mailcatch.com',
    'mailsac.com', 'burnermail.io', 'inboxbear.com', 'spamgourmet.com',
    'jetable.org', 'trash-mail.com', 'getairmail.com', 'discard.email',
  ];
  const domain = trimmed.split('@')[1];
  if (disposableDomains.includes(domain)) return false;
  // Block obviously fake patterns
  if (/^(test|fake|asdf|qwer|abc|xxx|noreply|no-reply|spam)@/i.test(trimmed)) return false;
  if (/(.)\1{4,}/.test(trimmed.split('@')[0])) return false; // repeated chars like aaaaa@
  return true;
};

interface Recipient {
  email: string;
  name: string;
}

interface RecipientSelectorProps {
  recipients: Recipient[];
  onChange: (recipients: Recipient[]) => void;
}

const AUDIENCE_FILTERS = [
  { value: 'all', label: 'All Contacts' },
  { value: 'unpaid_visitors', label: 'Unpaid Visitors' },
  { value: 'abandoned_cart', label: 'Abandoned Cart' },
  { value: 'status_converted', label: 'Customers (Paid)' },
  { value: 'status_cancelled', label: 'Cancelled' },
  { value: 'status_refunded', label: 'Refunded' },
  { value: 'status_fake_lead', label: 'Fake Lead' },
  { value: 'status_lost', label: 'Lost' },
];

const BATCH_SIZES = [
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: '250', label: '250' },
  { value: '500', label: '500' },
  { value: '1000', label: '1,000' },
  { value: 'all', label: 'All' },
];

export const RecipientSelector: React.FC<RecipientSelectorProps> = ({ recipients, onChange }) => {
  const [manualEmail, setManualEmail] = useState('');
  const [importFilter, setImportFilter] = useState('');
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Recipient[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [batchSize, setBatchSize] = useState('100');
  const [excludePreviouslySent, setExcludePreviouslySent] = useState(true);

  // Search marketing_audience for autocomplete
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoadingSuggestions(true);
      const { data } = await supabase
        .from('marketing_audience')
        .select('email, full_name')
        .not('email', 'is', null)
        .or(`email.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .limit(10);
      
      if (data) {
        const existing = new Set(recipients.map(r => r.email.toLowerCase()));
        setSuggestions(
          data
            .filter(d => d.email && !existing.has(d.email.toLowerCase()))
            .map(d => ({ email: d.email!, name: d.full_name || '' }))
        );
      }
      setLoadingSuggestions(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, recipients]);

  // Fetch all previously emailed addresses from email_logs
  const fetchPreviouslySentEmails = async (): Promise<Set<string>> => {
    const sentEmails = new Set<string>();
    const PAGE_SIZE = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('email_logs')
        .select('recipient_email')
        .range(from, from + PAGE_SIZE - 1);

      if (error || !data || data.length === 0) {
        hasMore = false;
        break;
      }

      data.forEach(row => {
        if (row.recipient_email) {
          sentEmails.add(row.recipient_email.toLowerCase().trim());
        }
      });

      hasMore = data.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }

    return sentEmails;
  };

  const addRecipient = (r: Recipient) => {
    const email = r.email.toLowerCase().trim();
    if (!email) return;
    if (recipients.some(e => e.email.toLowerCase() === email)) {
      toast.info('Already added');
      return;
    }
    onChange([...recipients, { email, name: r.name }]);
    setSearchQuery('');
    setManualEmail('');
    setSuggestions([]);
  };

  const removeRecipient = (email: string) => {
    onChange(recipients.filter(r => r.email !== email));
  };

  const handleManualAdd = () => {
    if (!manualEmail) return;
    if (!isValidEmail(manualEmail)) {
      toast.error('Invalid email address. Please enter a valid email.');
      return;
    }
    addRecipient({ email: manualEmail, name: '' });
  };

  const importFromAudience = async (filter: string) => {
    setImporting(true);
    try {
      // If excluding previously sent, fetch all sent emails first
      let previouslySent = new Set<string>();
      if (excludePreviouslySent) {
        previouslySent = await fetchPreviouslySentEmails();
      }

      const limit = batchSize === 'all' ? null : parseInt(batchSize);
      const existing = new Set(recipients.map(r => r.email.toLowerCase()));
      const newRecipients: Recipient[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('marketing_audience')
          .select('email, full_name, created_at')
          .not('email', 'is', null)
          .order('created_at', { ascending: sortOrder === 'oldest' })
          .range(from, from + PAGE_SIZE - 1);

        if (filter === 'unpaid_visitors') {
          query = query.eq('source_type', 'sales_lead')
            .or('lead_status.is.null,lead_status.not.in.(converted,cancelled,refunded,fake_lead,lost)');
        } else if (filter.startsWith('status_')) {
          query = query.eq('lead_status', filter.replace('status_', ''));
        } else if (filter !== 'all') {
          query = query.eq('source_type', filter);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;

        let skippedInvalid = 0;
        for (const c of data) {
          if (!c.email) continue;
          const email = c.email.toLowerCase().trim();
          
          // Skip invalid/fake emails
          if (!isValidEmail(email)) { skippedInvalid++; continue; }
          // Skip if already in current recipients
          if (existing.has(email)) continue;
          // Skip if previously emailed
          if (excludePreviouslySent && previouslySent.has(email)) continue;
          
          existing.add(email);
          newRecipients.push({ email, name: c.full_name || '' });
          
          // Stop if we've reached the batch size
          if (limit && newRecipients.length >= limit) break;
        }

        // Stop if we've reached the batch size or no more data
        if (limit && newRecipients.length >= limit) break;
        hasMore = data.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      onChange([...recipients, ...newRecipients]);
      
      const skippedCount = excludePreviouslySent ? `, ${previouslySent.size} previously emailed skipped` : '';
      toast.success(`Imported ${newRecipients.length} contacts${skippedCount}, invalid emails filtered out`);
    } catch {
      toast.error('Failed to import contacts');
    } finally {
      setImporting(false);
      setImportFilter('');
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-semibold flex items-center gap-2">
        <Users className="w-4 h-4" />
        To: <Badge variant="secondary" className="ml-1">{recipients.length}</Badge>
      </Label>

      {/* Recipients display */}
      {recipients.length > 0 && (
        <ScrollArea className="max-h-32 border rounded-md p-2">
          <div className="flex flex-wrap gap-1">
            {recipients.map(r => (
              <Badge key={r.email} variant="secondary" className="gap-1 text-xs">
                {r.name ? `${r.name.split(' ')[0]} <${r.email}>` : r.email}
                <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => removeRecipient(r.email)} />
              </Badge>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Search / add email */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search contacts or type email..."
              value={searchQuery || manualEmail}
              onChange={(e) => {
                const v = e.target.value;
                setSearchQuery(v);
                setManualEmail(v);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (suggestions.length > 0) {
                    addRecipient(suggestions[0]);
                  } else {
                    handleManualAdd();
                  }
                }
              }}
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleManualAdd} disabled={!manualEmail.includes('@')}>
            <UserPlus className="w-4 h-4" />
          </Button>
        </div>

        {/* Autocomplete dropdown */}
        {(suggestions.length > 0 || loadingSuggestions) && searchQuery.length >= 2 && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
            {loadingSuggestions ? (
              <div className="p-2 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Searching...
              </div>
            ) : (
              suggestions.map(s => (
                <button
                  key={s.email}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex justify-between items-center"
                  onClick={() => addRecipient(s)}
                >
                  <span className="truncate">{s.name ? `${s.name} — ` : ''}{s.email}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Import from audience segment */}
      <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
        <Label className="text-xs font-medium text-muted-foreground">Import from Marketing Audience</Label>
        <div className="flex gap-2">
          <div className="flex-1">
            <Select value={importFilter} onValueChange={setImportFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select segment..." />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCE_FILTERS.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'newest' | 'oldest')}>
              <SelectTrigger className="h-8 text-xs">
                <ArrowUpDown className="w-3 h-3 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={batchSize} onValueChange={setBatchSize}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BATCH_SIZES.map(b => (
                  <SelectItem key={b.value} value={b.value}>{b.label} contacts</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="default"
            size="sm"
            className="h-8"
            disabled={!importFilter || importing}
            onClick={() => importFromAudience(importFilter)}
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span className="ml-1">Import</span>
          </Button>
        </div>

        {/* Exclude previously emailed toggle */}
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="exclude-sent"
            checked={excludePreviouslySent}
            onCheckedChange={(checked) => setExcludePreviouslySent(checked === true)}
          />
          <label htmlFor="exclude-sent" className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0BA360]" />
            Skip contacts already emailed (no duplicates)
          </label>
        </div>
      </div>

      {recipients.length > 5 && (
        <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => onChange([])}>
          Clear all recipients
        </Button>
      )}
    </div>
  );
};
