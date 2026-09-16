import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ExternalLink, Send } from 'lucide-react';

interface PageLinkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Friendly name of the page, e.g. "Make a complaint" */
  pageLabel: string;
  /** Public URL of the page the customer should visit */
  pageUrl: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const PageLinkEmailDialog: React.FC<PageLinkEmailDialogProps> = ({
  open,
  onOpenChange,
  pageLabel,
  pageUrl,
}) => {
  const [recipient, setRecipient] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Reset to the default template every time the pop-up is opened, so an agent
  // always starts from approved wording and can edit freely before sending.
  useEffect(() => {
    if (!open) return;
    setSubject(`${pageLabel} — Buy A Warranty`);
    setMessage(
      [
        'Hi there,',
        '',
        `Thank you for getting in touch. You can ${pageLabel.toLowerCase()} using the link below, and one of our team will come back to you.`,
        '',
        pageUrl,
        '',
        'Kind regards,',
        'Claims Team',
        'Buy A Warranty',
      ].join('\n'),
    );
  }, [open, pageLabel, pageUrl]);

  const handleSend = async () => {
    const email = recipient.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter the customer's email address");
      return;
    }
    if (!message.trim()) {
      toast.error('Please write a message before sending');
      return;
    }

    setSending(true);
    try {
      const greeting = customerName.trim() ? `Hi ${customerName.trim()},` : null;
      const bodyLines = message.trim().split('\n');
      const html = `
        <div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #1f2937; line-height: 1.6;">
          ${greeting ? `<p style="margin: 0 0 12px;">${escapeHtml(greeting)}</p>` : ''}
          <p style="margin: 0 0 12px;">${bodyLines
            .map((line) =>
              line.trim() === pageUrl
                ? `<a href="${pageUrl}" style="color: #1a365d; font-weight: bold;">${escapeHtml(pageLabel)}</a>`
                : escapeHtml(line),
            )
            .join('<br/>')}</p>
        </div>
      `;

      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          recipientEmail: email,
          customSubject: subject.trim() || `${pageLabel} — Buy A Warranty`,
          customHtml: html,
        },
      });

      if (error) throw error;

      toast.success(`Email sent to ${email}`);
      setRecipient('');
      setCustomerName('');
      onOpenChange(false);
    } catch (err: any) {
      console.error('[PageLinkEmailDialog] send failed', err);
      toast.error(err?.message || 'Could not send the email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Email the {pageLabel.toLowerCase()} link</DialogTitle>
          <DialogDescription>
            Edit anything you like, then send it to the customer — or just open the page yourself.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border bg-muted/40 p-3 text-sm flex items-center justify-between gap-3">
            <span className="truncate">{pageUrl}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open(pageUrl, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open page
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="page-link-email">Customer email</Label>
              <Input
                id="page-link-email"
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
            <div>
              <Label htmlFor="page-link-name">Customer name (optional)</Label>
              <Input
                id="page-link-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="First name"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="page-link-subject">Subject</Label>
            <Input id="page-link-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="page-link-message">Message</Label>
            <Textarea
              id="page-link-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            <Send className="h-4 w-4 mr-1" /> {sending ? 'Sending…' : 'Send email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
