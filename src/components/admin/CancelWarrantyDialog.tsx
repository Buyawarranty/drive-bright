import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Ban } from 'lucide-react';

interface CancelWarrantyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  policy: {
    id: string;
    email: string;
    policy_number?: string;
    user_id?: string;
    customer_id?: string;
  };
  customerName?: string;
  onSuccess: () => void;
}

export const CancelWarrantyDialog: React.FC<CancelWarrantyDialogProps> = ({
  isOpen,
  onClose,
  policy,
  customerName,
  onSuccess,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [note, setNote] = useState('');
  const [isTest, setIsTest] = useState(false);

  const handleCancel = async () => {
    setIsProcessing(true);
    try {
      const nowIso = new Date().toISOString();
      const trimmedNote = note.trim();

      // 1. Update policy status to cancelled (and archive)
      const { error: policyError } = await supabase
        .from('customer_policies')
        .update({
          status: 'cancelled',
          updated_at: nowIso,
          is_deleted: true,
          deleted_at: nowIso,
        })
        .eq('id', policy.id);

      if (policyError) throw policyError;

      // 2. Update linked customer: mark Cancelled AND archive (remove from main list)
      if (policy.customer_id) {
        const { data: authData } = await supabase.auth.getUser();
        const updaterId = authData?.user?.id ?? null;

        const customerUpdate: Record<string, any> = {
          status: 'Cancelled',
          is_deleted: true,
          deleted_at: nowIso,
          updated_at: nowIso,
          is_test_cancellation: isTest,
        };
        if (trimmedNote || isTest) {
          const noteWithPrefix = isTest
            ? `[TEST CANCELLATION] ${trimmedNote}`.trim()
            : trimmedNote;
          customerUpdate.cancellation_note = noteWithPrefix;
          customerUpdate.cancellation_note_updated_at = nowIso;
          customerUpdate.cancellation_note_updated_by = updaterId;
        }

        const { error: customerError } = await supabase
          .from('customers')
          .update(customerUpdate)
          .eq('id', policy.customer_id);

        if (customerError) {
          console.error('Error updating customer status:', customerError);
        }

        // 3. Log a brief audit note
        await supabase.from('admin_notes').insert({
          customer_id: policy.customer_id,
          note:
            `${isTest ? '[TEST] ' : ''}WARRANTY CANCELLED & ARCHIVED\n` +
            `Policy: ${policy.policy_number || policy.id}\n` +
            `Cancelled at: ${new Date().toLocaleString()}` +
            (isTest ? `\nMarked as: TEST CANCELLATION (excluded from commission/unwinds)` : '') +
            (trimmedNote ? `\nReason: ${trimmedNote}` : ''),
        });
      }

      toast.success(isTest ? 'Test cancellation recorded' : 'Warranty cancelled and removed from list');
      setNote('');
      setIsTest(false);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error cancelling warranty:', error);
      toast.error('Failed to cancel warranty');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Ban className="h-5 w-5" />
            Cancel this warranty?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will cancel the warranty for{' '}
            <strong>{customerName || policy.email}</strong>
            {policy.policy_number && <> (Policy {policy.policy_number})</>}.
            <br />
            It will be removed from Customer Management and moved to the Cancellations tab.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="cancellation-note" className="text-sm font-medium">
            Reason / notes (optional)
          </Label>
          <Textarea
            id="cancellation-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Customer requested cancellation – sold the vehicle"
            rows={3}
            disabled={isProcessing}
          />
          <p className="text-xs text-muted-foreground">
            Saved against the customer and visible in the Cancellations tab. Editable later.
          </p>

          <div className="mt-3 flex items-start gap-2 rounded-md border border-dashed border-amber-300 bg-amber-50 p-3">
            <Checkbox
              id="is-test-cancellation"
              checked={isTest}
              onCheckedChange={(v) => setIsTest(!!v)}
              disabled={isProcessing}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label htmlFor="is-test-cancellation" className="text-sm font-medium cursor-pointer">
                This is a test cancellation
              </Label>
              <p className="text-xs text-muted-foreground">
                Excluded from commission, unwinds and the live cancellations report.
              </p>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>No, keep it</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isProcessing}
          >
            {isProcessing ? 'Cancelling…' : 'Yes, cancel warranty'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
