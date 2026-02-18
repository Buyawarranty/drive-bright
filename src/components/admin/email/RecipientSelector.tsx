import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, X, Search, Loader2, UserPlus, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export const RecipientSelector: React.FC<RecipientSelectorProps> = ({ recipients, onChange }) => {
  const [manualEmail, setManualEmail] = useState('');
  const [importFilter, setImportFilter] = useState('');
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Recipient[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

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
    if (manualEmail && manualEmail.includes('@')) {
      addRecipient({ email: manualEmail, name: '' });
    }
  };

  const importFromAudience = async (filter: string) => {
    setImporting(true);
    try {
      let allContacts: any[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('marketing_audience')
          .select('email, full_name')
          .not('email', 'is', null)
          .range(from, from + PAGE_SIZE - 1);

        if (filter === 'unpaid_visitors') {
          query = query.eq('source_type', 'sales_lead')
            .not('lead_status', 'in', '(converted,cancelled,refunded,fake_lead,lost)')
            .or('lead_status.is.null');
        } else if (filter.startsWith('status_')) {
          query = query.eq('lead_status', filter.replace('status_', ''));
        } else if (filter !== 'all') {
          query = query.eq('source_type', filter);
        }

        const { data, error } = await query;
        if (error) throw error;
        allContacts = allContacts.concat(data || []);
        hasMore = (data?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      // Deduplicate and merge with existing
      const existing = new Set(recipients.map(r => r.email.toLowerCase()));
      const newRecipients: Recipient[] = [];
      allContacts.forEach(c => {
        if (c.email) {
          const email = c.email.toLowerCase().trim();
          if (!existing.has(email)) {
            existing.add(email);
            newRecipients.push({ email, name: c.full_name || '' });
          }
        }
      });

      onChange([...recipients, ...newRecipients]);
      toast.success(`Imported ${newRecipients.length} contacts`);
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
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">Import from Marketing Audience</Label>
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
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          disabled={!importFilter || importing}
          onClick={() => importFromAudience(importFilter)}
        >
          {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="ml-1">Import</span>
        </Button>
      </div>

      {recipients.length > 5 && (
        <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => onChange([])}>
          Clear all recipients
        </Button>
      )}
    </div>
  );
};
