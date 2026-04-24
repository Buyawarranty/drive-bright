import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Mail, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface RecentEmailsDialogProps {
  customerEmail: string;
  customerName: string;
}

interface EmailRecord {
  id: string;
  subject: string;
  status: string;
  delivery_status: string | null;
  sent_at: string | null;
  created_at: string;
  error_message: string | null;
  failed_reason: string | null;
  opened_at: string | null;
  source: 'email_logs' | 'welcome_emails';
}

const statusBadge = (record: EmailRecord) => {
  const status = (record.delivery_status || record.status || '').toLowerCase();
  if (record.opened_at) {
    return <Badge className="bg-blue-100 text-blue-800 border-blue-300"><CheckCircle2 className="h-3 w-3 mr-1" />Opened</Badge>;
  }
  if (['sent', 'delivered', 'success'].includes(status)) {
    return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle2 className="h-3 w-3 mr-1" />Sent</Badge>;
  }
  if (['failed', 'bounced', 'error', 'dlq'].includes(status)) {
    return <Badge className="bg-red-100 text-red-800 border-red-300"><XCircle className="h-3 w-3 mr-1" />{status}</Badge>;
  }
  if (['pending', 'queued'].includes(status)) {
    return <Badge className="bg-amber-100 text-amber-800 border-amber-300"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
  }
  return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />{status || 'unknown'}</Badge>;
};

export const RecentEmailsDialog = ({ customerEmail, customerName }: RecentEmailsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<EmailRecord[]>([]);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const lower = customerEmail.toLowerCase();

      const [logsRes, welcomeRes] = await Promise.all([
        supabase
          .from('email_logs')
          .select('id, subject, status, delivery_status, sent_at, created_at, error_message, failed_reason, opened_at')
          .ilike('recipient_email', lower)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('welcome_emails')
          .select('id, customer_email, email_sent_at, created_at, status, error_message')
          .ilike('customer_email', lower)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      const logs: EmailRecord[] = (logsRes.data || []).map((r: any) => ({
        id: r.id,
        subject: r.subject || '(no subject)',
        status: r.status,
        delivery_status: r.delivery_status,
        sent_at: r.sent_at,
        created_at: r.created_at,
        error_message: r.error_message,
        failed_reason: r.failed_reason,
        opened_at: r.opened_at,
        source: 'email_logs',
      }));

      const welcomes: EmailRecord[] = (welcomeRes.data || []).map((r: any) => ({
        id: r.id,
        subject: 'Welcome email (login credentials)',
        status: r.status || (r.email_sent_at ? 'sent' : 'pending'),
        delivery_status: r.email_sent_at ? 'sent' : null,
        sent_at: r.email_sent_at,
        created_at: r.created_at,
        error_message: r.error_message,
        failed_reason: null,
        opened_at: null,
        source: 'welcome_emails',
      }));

      const combined = [...logs, ...welcomes].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRecords(combined);
    } catch (err: any) {
      console.error('Failed to load recent emails', err);
      toast.error('Failed to load recent emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchEmails();
  }, [open, customerEmail]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Mail className="h-4 w-4 mr-1" />
          Recent Emails
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recent emails to {customerName}</DialogTitle>
          <DialogDescription>
            Confirms which emails (welcome, notifications, marketing) were sent to{' '}
            <span className="font-medium">{customerEmail}</span>. Use this to verify
            whether a welcome email was delivered.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">
            Showing {records.length} record{records.length === 1 ? '' : 's'}
          </p>
          <Button variant="outline" size="sm" onClick={fetchEmails} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
            <Mail className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">No emails found for this address</p>
            <p className="text-xs text-muted-foreground mt-1">
              If a welcome email was expected, try resending it from the customer actions.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <div
                key={`${r.source}-${r.id}`}
                className="border-2 border-border rounded-lg p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="font-medium text-sm">{r.subject}</div>
                  {statusBadge(r)}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span>
                    {r.sent_at
                      ? `Sent ${format(new Date(r.sent_at), 'dd MMM yyyy, HH:mm')}`
                      : `Created ${format(new Date(r.created_at), 'dd MMM yyyy, HH:mm')}`}
                  </span>
                  {r.opened_at && (
                    <span className="text-blue-700">
                      Opened {format(new Date(r.opened_at), 'dd MMM HH:mm')}
                    </span>
                  )}
                  <span className="text-muted-foreground/70">
                    {r.source === 'welcome_emails' ? 'welcome_emails' : 'email_logs'}
                  </span>
                </div>
                {(r.error_message || r.failed_reason) && (
                  <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                    {r.error_message || r.failed_reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
