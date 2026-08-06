import React, { useCallback, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * A lead can only be marked "converted" once the payment has actually been
 * confirmed, so the agent has to answer "have you confirmed the payment?"
 * before the status changes. Answering No leaves the status untouched.
 */
export function useConfirmConverted(
  onConfirmed: (leadId: string, status: any) => void | Promise<void>
) {
  const [pending, setPending] = useState<{ leadId: string; status: any } | null>(null);

  const guardStatusChange = useCallback(
    (leadId: string, status: any) => {
      if (status === 'converted') {
        setPending({ leadId, status });
        return;
      }
      void onConfirmed(leadId, status);
    },
    [onConfirmed]
  );

  const dialog = (
    <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Have you confirmed the payment?</AlertDialogTitle>
          <AlertDialogDescription>
            A lead can only be marked as <strong>Converted</strong> once the payment has been
            confirmed. Choose <strong>No</strong> to leave the status unchanged.
            Confirming also emails the sale notification to you and the team.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No, don't change it</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              const p = pending;
              setPending(null);
              if (p) void onConfirmed(p.leadId, p.status);
            }}
          >
            Yes, payment confirmed
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { guardStatusChange, convertedConfirmDialog: dialog };
}
