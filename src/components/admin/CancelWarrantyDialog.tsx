import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { AlertTriangle, Ban, UserX, PoundSterling } from 'lucide-react';

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
  'Customer refund processed',
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
  const [markAsRefunded, setMarkAsRefunded] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Auto-check refund option when refund reason is selected
  const handleReasonChange = (reason: string) => {
    setCancellationReason(reason);
    if (reason === 'Customer refund processed' || reason === 'Cooling-off period cancellation (14 days)') {
      setMarkAsRefunded(true);
    }
  };

  const handleCancel = async () => {
    if (!cancellationReason) {
      toast.error('Please select a cancellation reason');
      return;
    }

    setIsProcessing(true);

    try {
      // Determine the new status based on refund option
      const newStatus = markAsRefunded ? 'refunded' : 'cancelled';

      // 1. Update policy status
      const { error: policyError } = await supabase
        .from('customer_policies')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', policy.id);

      if (policyError) throw policyError;

      // 2. Update customer status if customer_id exists (NOT soft delete - keep visible!)
      if (policy.customer_id) {
        const { error: customerError } = await supabase
          .from('customers')
          .update({ 
            status: markAsRefunded ? 'Refunded' : 'Cancelled',
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
        const noteText = `WARRANTY ${markAsRefunded ? 'REFUNDED' : 'CANCELLED'}\n` +
          `Reason: ${cancellationReason}\n` +
          `${markAsRefunded && refundAmount ? `Refund Amount: £${refundAmount}\n` : ''}` +
          `${additionalNotes ? `Notes: ${additionalNotes}\n` : ''}` +
          `Portal Access Revoked: ${revokePortalAccess ? 'Yes' : 'No'}\n` +
          `Processed at: ${new Date().toLocaleString()}`;

        await supabase
          .from('admin_notes')
          .insert({
            customer_id: policy.customer_id,
            note: noteText
          });
      }

      toast.success(
        markAsRefunded 
          ? 'Customer marked as refunded - still visible in dashboard' 
          : 'Warranty cancelled - customer remains visible in dashboard'
      );
      
      onSuccess();
      onClose();
      
      // Reset form
      setCancellationReason('');
      setAdditionalNotes('');
      setRevokePortalAccess(false);
      setMarkAsRefunded(false);
      setRefundAmount('');

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
          {/* Info Alert - Customer remains visible */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Customer will remain visible</p>
              <p className="text-xs mt-1">Cancelled/refunded customers stay in the dashboard with highlighted status. Use "Archive" to hide them.</p>
            </div>
          </div>

          {/* Cancellation Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Cancellation Reason *</Label>
            <Select value={cancellationReason} onValueChange={handleReasonChange}>
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

          {/* Mark as Refunded Option */}
          <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <Checkbox
              id="markRefunded"
              checked={markAsRefunded}
              onCheckedChange={(checked) => setMarkAsRefunded(checked === true)}
              className="mt-0.5"
            />
            <div className="flex-1 space-y-2">
              <Label 
                htmlFor="markRefunded" 
                className="text-sm font-medium text-green-800 cursor-pointer flex items-center gap-2"
              >
                <PoundSterling className="h-4 w-4" />
                Mark as Refunded
              </Label>
              <p className="text-xs text-green-600">
                This will set the status to "Refunded" instead of "Cancelled".
              </p>
              {markAsRefunded && (
                <div className="pt-2">
                  <Label htmlFor="refundAmount" className="text-xs text-green-700">Refund Amount (optional)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-green-600">£</span>
                    <Input
                      id="refundAmount"
                      type="number"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      placeholder="0.00"
                      className="pl-6 h-8 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
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
            {isProcessing ? 'Processing...' : markAsRefunded ? 'Mark as Refunded' : 'Cancel Warranty'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
