import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  type: '3mo' | '6mo' | '1mo' | null;
  onOpenChange: (o: boolean) => void;
  adminUserId: string | null;
  yearMonth: string;
}

export function ConcessionAuthRequestDialog({
  open,
  type,
  onOpenChange,
  adminUserId,
  yearMonth,
}: Props) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    if (!adminUserId) {
      toast.error('Not signed in as a sales agent');
      return;
    }
    if (!reason.trim()) {
      toast.error('Please explain why you need the extra concession');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('concession_auth_requests').insert({
      admin_user_id: adminUserId,
      year_month: yearMonth,
      request_type: type,
      reason: reason.trim(),
      status: 'pending',
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || 'Could not send request');
      return;
    }
    toast.success('Request sent to management');
    setReason('');
    onOpenChange(false);
    await queryClient.invalidateQueries({ queryKey: ['concession-allowance', adminUserId, yearMonth] });
  };

  const label =
    type === '3mo'
      ? '+3 months free'
      : type === '6mo'
        ? '+6 months free'
        : type === '1mo'
          ? '+1 month free per year of cover'
          : 'concession';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request extra {label}</DialogTitle>
          <DialogDescription>
            You have already used this month&apos;s allowance for {label}. Ask a manager to authorise
            one more. Your request will be reviewed in the Monthly concession allowance manager.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this concession needed? (e.g. customer is comparing a cheaper competitor, policy is about to lapse, etc.)"
          className="min-h-[100px]"
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !reason.trim()}>
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Send className="w-4 h-4 mr-1" />
            )}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
