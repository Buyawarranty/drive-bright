import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Mail } from 'lucide-react';

interface PendingChange {
  claimId: string;
  status: string;
  subjectOverride?: string;
  headingOverride?: string;
  bodyOverride?: string;
  // Optional follow-up after the email is sent successfully
  onSent?: () => void | Promise<void>;
  // Skip sending entirely (e.g. for statuses with no customer copy) – just runs onSent.
  skipEmail?: boolean;
  // Friendly admin-facing label (e.g. "Approve", "Close") for the dialog title.
  label?: string;
}

interface Props {
  pending: PendingChange | null;
  onClose: () => void;
}

interface PreviewData {
  recipient: string;
  subject: string;
  heading: string;
  body: string;
  html: string;
  reference: string;
}

/**
 * Review-before-send dialog for any claim status change that triggers a
 * customer email. Loads a dry-run preview from `send-claim-status-email`,
 * lets the agent edit subject + body, then sends the final version and
 * runs the caller's `onSent` to persist the DB change.
 */
export const ClaimStatusEmailPreviewDialog: React.FC<Props> = ({ pending, onClose }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [skipped, setSkipped] = useState(false);

  const open = !!pending;

  useEffect(() => {
    if (!pending) {
      setPreview(null);
      setSubject('');
      setBody('');
      setSkipped(false);
      return;
    }
    if (pending.skipEmail) {
      setSkipped(true);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('send-claim-status-email', {
          body: {
            claimId: pending.claimId,
            status: pending.status,
            dryRun: true,
            subjectOverride: pending.subjectOverride,
            headingOverride: pending.headingOverride,
            bodyOverride: pending.bodyOverride,
          },
        });
        if (cancelled) return;
        if (error) throw error;
        if (data?.skipped) {
          setSkipped(true);
        } else if (data?.preview) {
          const p: PreviewData = {
            recipient: data.recipient,
            subject: data.subject,
            heading: data.heading,
            body: data.body,
            html: data.html,
            reference: data.reference,
          };
          setPreview(p);
          setSubject(p.subject);
          setBody(p.body);
        }
      } catch (e: any) {
        toast({
          title: 'Could not load email preview',
          description: e?.message || 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pending, toast]);

  const handleSend = async () => {
    if (!pending) return;

    // Status with no customer copy — just apply the change.
    if (skipped) {
      try {
        await pending.onSent?.();
      } finally {
        onClose();
      }
      return;
    }

    if (!preview) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-claim-status-email', {
        body: {
          claimId: pending.claimId,
          status: pending.status,
          subjectOverride: subject,
          headingOverride: pending.headingOverride,
          bodyOverride: body,
        },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || 'Send failed');

      toast({
        title: 'Email sent',
        description: `Sent to ${preview.recipient}`,
      });

      try {
        await pending.onSent?.();
      } catch (e: any) {
        // Email already sent — surface DB error but don't roll back.
        toast({
          title: 'Status update failed after email',
          description: e?.message || 'The email was sent but the status change failed to save.',
          variant: 'destructive',
        });
      }
      onClose();
    } catch (e: any) {
      toast({
        title: 'Email failed',
        description: e?.message || 'Could not send the email.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleSkipSendStill = async () => {
    if (!pending) return;
    try {
      await pending.onSent?.();
    } finally {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !sending) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Review email before sending
          </DialogTitle>
          <DialogDescription>
            {pending?.label
              ? `This will set the claim to "${pending.label}" and send the email below.`
              : 'This will update the claim status and send the email below to the customer.'}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading preview…
          </div>
        )}

        {!loading && skipped && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            This status doesn't send a customer email. You can still apply the status change.
          </div>
        )}

        {!loading && preview && !skipped && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div>
              <Label className="text-xs">To</Label>
              <Input value={preview.recipient} disabled className="bg-muted/40" />
            </div>
            <div>
              <Label className="text-xs">Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={sending}
              />
            </div>
            <div>
              <Label className="text-xs">Message</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                disabled={sending}
                className="font-mono text-xs"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Edit any text above before sending. Paragraph breaks are preserved.
              </p>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Claim reference: <strong>{preview.reference}</strong>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          {!loading && !skipped && preview && (
            <Button
              variant="ghost"
              onClick={() => {
                if (typeof window !== 'undefined' && !window.confirm(
                  'Apply this status change WITHOUT emailing the customer?\n\nThe customer will not be notified. Only use this for internal-only corrections.'
                )) return;
                handleSkipSendStill();
              }}
              disabled={sending}
              className="text-muted-foreground text-[11px] opacity-60 hover:opacity-100"
              title="Internal only — customer will not be notified"
            >
              Skip email (internal only)
            </Button>
          )}
          <Button onClick={handleSend} disabled={sending || loading} className="bg-primary">
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {skipped ? 'Apply status' : sending ? 'Sending…' : 'Send email & apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export type { PendingChange as PendingClaimStatusChange };
