import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AudienceBulkSendProps {
  selectedTemplate: { id: string; name: string; template_type: string } | null;
  onClose: () => void;
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

export const AudienceBulkSend: React.FC<AudienceBulkSendProps> = ({ selectedTemplate, onClose }) => {
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [sentCount, setSentCount] = useState(0);

  const loadCount = async (filterValue: string) => {
    setLoading(true);
    try {
      let query = supabase.from('marketing_audience').select('lead_id', { count: 'exact', head: true });
      
      if (filterValue === 'unpaid_visitors') {
        query = query.eq('source_type', 'sales_lead')
          .or('lead_status.is.null,lead_status.not.in.(converted,cancelled,refunded,fake_lead,lost)');
      } else if (filterValue.startsWith('status_')) {
        query = query.eq('lead_status', filterValue.replace('status_', ''));
      } else if (filterValue !== 'all') {
        query = query.eq('source_type', filterValue);
      }
      
      // Only count those with emails
      query = query.not('email', 'is', null);
      
      const { count, error } = await query;
      if (error) throw error;
      setContactCount(count || 0);
    } catch (err) {
      toast.error('Failed to load contact count');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (value: string) => {
    setFilter(value);
    setContactCount(null);
    loadCount(value);
  };

  const handleBulkSend = async () => {
    if (!selectedTemplate || contactCount === 0) return;
    
    setSending(true);
    setSentCount(0);
    
    try {
      // Fetch all matching contacts with pagination
      let allContacts: any[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase.from('marketing_audience').select('email, full_name').not('email', 'is', null).range(from, from + PAGE_SIZE - 1);
        
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
        allContacts = allContacts.concat(data || []);
        hasMore = (data?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }

      // Deduplicate by email
      const uniqueEmails = new Map<string, string>();
      allContacts.forEach(c => {
        if (c.email) {
          const email = c.email.toLowerCase().trim();
          if (!uniqueEmails.has(email)) {
            uniqueEmails.set(email, c.full_name || '');
          }
        }
      });

      let sent = 0;
      let failed = 0;

      // Send in batches
      const entries = Array.from(uniqueEmails.entries());
      for (const [email, name] of entries) {
        try {
          const { error } = await supabase.functions.invoke('send-email', {
            body: {
              templateId: selectedTemplate.template_type,
              recipientEmail: email,
              variables: {
                firstName: name.split(' ')[0] || 'Customer',
                customerName: name || 'Customer',
                policyNumber: '',
                planType: '',
                vehicleReg: ''
              }
            }
          });
          if (error) {
            failed++;
          } else {
            sent++;
          }
        } catch {
          failed++;
        }
        setSentCount(sent + failed);
      }

      toast.success(`Sent ${sent} emails successfully${failed > 0 ? `, ${failed} failed` : ''}`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send bulk emails');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Audience Filter</Label>
        <Select value={filter} onValueChange={handleFilterChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUDIENCE_FILTERS.map(f => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50">
        <Users className="w-4 h-4 text-muted-foreground" />
        {loading ? (
          <span className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading count...
          </span>
        ) : contactCount !== null ? (
          <span className="text-sm">
            <strong>{contactCount.toLocaleString()}</strong> contacts with email addresses
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Select a filter to see contact count</span>
        )}
      </div>

      {sending && (
        <div className="p-3 rounded-lg border bg-muted/50">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Sending... {sentCount} / {contactCount} processed
          </div>
          <div className="w-full bg-muted rounded-full h-2 mt-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all" 
              style={{ width: `${contactCount ? (sentCount / contactCount) * 100 : 0}%` }} 
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleBulkSend} 
          disabled={sending || !contactCount || contactCount === 0}
        >
          <Send className="w-4 h-4 mr-2" />
          {sending ? `Sending (${sentCount}/${contactCount})...` : `Send to ${contactCount?.toLocaleString() || 0} Contacts`}
        </Button>
      </div>
    </div>
  );
};
