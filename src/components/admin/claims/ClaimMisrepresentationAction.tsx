import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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

interface ClaimMisrepresentationActionProps {
  claimId: string;
  claimEmail?: string | null;
  vehicleRegistration?: string | null;
  alreadyFlagged?: boolean;
  onDone?: () => void;
}

/**
 * Claims-side action for a claim we know was fraudulent or an undisclosed
 * pre-existing fault. Applies the "Misrepresentation – Do Not Cover" label to
 * every record belonging to that customer, which excludes them from renewals
 * and blocks them from buying cover again.
 */
export const ClaimMisrepresentationAction: React.FC<ClaimMisrepresentationActionProps> = ({
  claimId,
  claimEmail,
  vehicleRegistration,
  alreadyFlagged = false,
  onDone,
}) => {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFlag = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('mark_claim_misrepresented', {
        p_claim_id: claimId,
        p_reason: reason.trim() || null,
      });
      if (error) throw error;

      toast({
        title: 'Customer flagged',
        description: `Misrepresentation – Do Not Cover applied to ${data ?? 0} customer record(s). They are now excluded from renewals and cannot buy cover again.`,
      });
      setReason('');
      setConfirmOpen(false);
      onDone?.();
    } catch (err) {
      toast({
        title: 'Could not flag this customer',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border-2 border-red-200 bg-red-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <ShieldAlert className="h-5 w-5 text-red-700 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-base font-semibold text-red-800">Misrepresented claim</h3>
            <p className="text-sm text-red-700/90 mt-1 max-w-prose">
              Use this when the claim is fraudulent or an undisclosed pre-existing fault. It labels
              the customer <strong>Misrepresentation – Do Not Cover</strong> across all of their
              records, removes them from renewals, and stops them buying cover again.
            </p>
          </div>
        </div>
        {alreadyFlagged && (
          <Badge className="bg-red-700 text-white shrink-0">Already flagged</Badge>
        )}
      </div>

      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Evidence and reason, e.g. fault present before cover started — confirmed by inspection report"
        rows={3}
        className="mt-3 bg-white"
      />

      <Button
        variant="destructive"
        className="mt-3"
        disabled={saving}
        onClick={() => setConfirmOpen(true)}
      >
        Flag as misrepresented — do not cover
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Flag this customer as misrepresentation?</AlertDialogTitle>
            <AlertDialogDescription>
              {claimEmail || vehicleRegistration
                ? `This applies to ${[claimEmail, vehicleRegistration].filter(Boolean).join(' / ')} and any other record matching them. `
                : ''}
              They will be excluded from renewal campaigns and blocked from buying cover again until
              a manager removes the label.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleFlag();
              }}
              disabled={saving}
              className="bg-red-700 hover:bg-red-800"
            >
              {saving ? 'Flagging…' : 'Yes, flag customer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
