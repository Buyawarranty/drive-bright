import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertTriangle, Ban, UserX } from 'lucide-react';

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

const CANCELLATION_REASONS = [
  'Customer requested cancellation',
  'Cooling-off period cancellation (14 days)',
  'Non-payment / Failed payments',
  'Fraudulent application',
  'Vehicle sold',
  'Duplicate policy',
  'Administrative error',
  'Other'
];

export const CancelWarrantyDialog: React.FC<CancelWarrantyDialogProps> = ({
  isOpen,
  onClose,
  policy,
  customerName,
  onSuccess
}) => {
  const [cancellationReason, setCancellationReason] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [revokePortalAccess, setRevokePortalAccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCancel = async () => {
    if (!cancellationReason) {
      toast.error('Please select a cancellation reason');
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Update policy status to cancelled
      const { error: policyError } = await supabase
        .from('customer_policies')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', policy.id);

      if (policyError) throw policyError;

      // 2. Update customer status if customer_id exists
      if (policy.customer_id) {
        const { error: customerError } = await supabase
          .from('customers')
          .update({ 
            status: 'Cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', policy.customer_id);

        if (customerError) {
          console.error('Error updating customer status:', customerError);
        }
      }

      // 3. Revoke portal access if selected (unlink user_id)
      if (revokePortalAccess && policy.user_id) {
        const { error: accessError } = await supabase
          .from('customer_policies')
          .update({ user_id: null })
          .eq('id', policy.id);

        if (accessError) {
          console.error('Error revoking portal access:', accessError);
          toast.error('Warranty cancelled but failed to revoke portal access');
        }
      }

      // 4. Log the cancellation as a note if customer_id exists
      if (policy.customer_id) {
        const noteText = `WARRANTY CANCELLED\n` +
          `Reason: ${cancellationReason}\n` +
          `${additionalNotes ? `Notes: ${additionalNotes}\n` : ''}` +
          `Portal Access Revoked: ${revokePortalAccess ? 'Yes' : 'No'}\n` +
          `Cancelled at: ${new Date().toLocaleString()}`;

        await supabase
          .from('admin_notes')
          .insert({
            customer_id: policy.customer_id,
            note: noteText
          });
      }

      toast.success(
        revokePortalAccess 
          ? 'Warranty cancelled and portal access revoked' 
          : 'Warranty cancelled successfully'
      );
      
      onSuccess();
      onClose();
      
      // Reset form
      setCancellationReason('');
      setAdditionalNotes('');
      setRevokePortalAccess(false);

    } catch (error) {
      console.error('Error cancelling warranty:', error);
      toast.error('Failed to cancel warranty');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Ban className="h-5 w-5" />
            Cancel Warranty
          </DialogTitle>
          <DialogDescription>
            This will cancel the warranty for <strong>{customerName || policy.email}</strong>.
            {policy.policy_number && (
              <span className="block mt-1 text-xs">Policy: {policy.policy_number}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning Alert */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">This action cannot be easily undone</p>
              <p className="text-xs mt-1">The customer will no longer have an active warranty. Make sure this is the correct action.</p>
            </div>
          </div>

          {/* Cancellation Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Cancellation Reason *</Label>
            <Select value={cancellationReason} onValueChange={setCancellationReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {CANCELLATION_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Enter any additional details about this cancellation..."
              rows={3}
            />
          </div>

          {/* Revoke Portal Access Option */}
          {policy.user_id && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <Checkbox
                id="revokeAccess"
                checked={revokePortalAccess}
                onCheckedChange={(checked) => setRevokePortalAccess(checked === true)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label 
                  htmlFor="revokeAccess" 
                  className="text-sm font-medium text-red-800 cursor-pointer flex items-center gap-2"
                >
                  <UserX className="h-4 w-4" />
                  Also revoke portal access
                </Label>
                <p className="text-xs text-red-600">
                  This will prevent the customer from logging into their dashboard and viewing this policy.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Keep Warranty
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleCancel}
            disabled={isProcessing || !cancellationReason}
          >
            {isProcessing ? 'Processing...' : 'Cancel Warranty'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
