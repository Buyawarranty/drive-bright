/**
 * APPEAL EMAIL — simple invitation.
 * ---------------------------------------------------------------------------
 * Picks the claim, lets the claims agent personalise a short message, shows a
 * live preview of the exact email (with the "Make an appeal" button linking to
 * https://buyawarranty.co.uk/appeals/), then sends it on submit. Sending marks
 * the appeal as open (claim_appeals row, claim status → appeal, audit log).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, Gavel, Eye } from 'lucide-react';
import {
  buildAppealEmailHtml,
  buildAppealEmailSubject,
} from '@/lib/appealEmailTemplate';

const DEFAULT_MESSAGE =
  'Thank you for getting in touch about your claim. We understand you may not agree with the ' +
  'outcome, and you have the right to appeal the decision.';

interface ClaimRow {
  id: string;
  name: string | null;
  email: string | null;
  phone?: string | null;
  status: string | null;
  vehicle_registration?: string | null;
  created_at: string;
}

interface ClaimAppealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claim?: ClaimRow | null;
  onSent?: () => void;
}

export const ClaimAppealDialog: React.FC<ClaimAppealDialogProps> = ({
  open,
  onOpenChange,
  claim = null,
  onSent,
}) => {
  const { toast } = useToast();
  const [selected, setSelected] = useState<ClaimRow | null>(claim);
  const [toEmail, setToEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) setSelected(claim);
  }, [open, claim]);

  useEffect(() => {
    setToEmail(selected?.email || '');
    setSubject(buildAppealEmailSubject(selected?.vehicle_registration));
  }, [selected?.id, selected?.email, selected?.vehicle_registration]);

  useEffect(() => {
    if (!open) setMessage(DEFAULT_MESSAGE);
  }, [open]);

  const emailHtml = useMemo(
    () =>
      buildAppealEmailHtml({
        customerName: selected?.name,
        registration: selected?.vehicle_registration,
        message,
      }),
    [selected, message]
  );

  const emailLooksValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const canSend = !!selected && emailLooksValid(toEmail);

  const handleSend = async () => {
    if (!selected || !canSend) return;
    setSending(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();

      // 1. Send the appeal email.
      const { data, error } = await supabase.functions.invoke('send-appeal-email', {
        body: {
          to: toEmail.trim(),
          subject: subject.trim() || buildAppealEmailSubject(selected.vehicle_registration),
          html: emailHtml,
          claimId: selected.id,
          registration: selected.vehicle_registration,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // 2. Record the appeal as open.
      const { error: appealError } = await supabase.from('claim_appeals').insert({
        claim_id: selected.id,
        reason: 'Appeal invitation sent — customer directed to the appeal form.',
        status: 'invited',
        sent_at: new Date().toISOString(),
        customer_email: toEmail.trim(),
        customer_notified: false,
        created_by: userRes?.user?.id ?? null,
      } as any);
      if (appealError) throw appealError;

      // 3. Move the claim to the appeal stage.
      const { error: statusError } = await supabase
        .from('claims_submissions')
        .update({ status: 'appeal', updated_at: new Date().toISOString() })
        .eq('id', selected.id);
      if (statusError) throw statusError;

      await supabase.from('claim_audit_log').insert({
        claim_id: selected.id,
        action: 'appeal_submitted',
        field: 'status',
        old_value: selected.status || null,
        new_value: 'appeal',
        reason: 'Appeal invitation email sent.',
        actor_id: userRes?.user?.id ?? null,
      } as any);

      toast({
        title: 'Appeal email sent',
        description: 'Claim set to appeal and the customer has been emailed the appeal link.',
      });
      onSent?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Could not send appeal email', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[#F4F6F8] p-0">
        {/* Brand bar */}
        <div className="bg-[#1e3a5f] px-6 py-4 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white text-lg">
              <Gavel className="h-5 w-5" /> Send appeal email
            </DialogTitle>
            <DialogDescription className="text-blue-100 text-sm">
              Emails the customer a link to the appeal form. Preview the email, personalise the
              message, then send when ready.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Recipient */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="appeal-to">Send to</Label>
              <Input
                id="appeal-to"
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="customer@email.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appeal-subject">Subject</Label>
              <Input
                id="appeal-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          </div>

          {/* Personal message */}
          <div className="space-y-1.5">
            <Label htmlFor="appeal-message">Your message (personalise before sending)</Label>
            <Textarea
              id="appeal-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>

          {/* Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Eye className="h-4 w-4" /> Email preview
            </div>
            <div className="rounded-md border border-gray-300 bg-white overflow-hidden">
              <div
                className="max-h-[420px] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: emailHtml }}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-gray-200 bg-white">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend || sending}
            className="bg-[#1e3a5f] hover:bg-[#162c48] text-white"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send appeal email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClaimAppealDialog;
