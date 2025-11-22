import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DollarSign } from 'lucide-react';

interface ClaimAmountEditDialogProps {
  claim: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export const ClaimAmountEditDialog: React.FC<ClaimAmountEditDialogProps> = ({ 
  claim, 
  open, 
  onOpenChange, 
  onUpdate 
}) => {
  const { toast } = useToast();
  const [paymentAmount, setPaymentAmount] = useState(claim?.payment_amount || 0);
  const [loading, setLoading] = useState(false);

  const handleSaveAmount = async () => {
    if (paymentAmount < 0) {
      toast({
        title: "Error",
        description: "Payment amount cannot be negative",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('claims_submissions')
        .update({
          payment_amount: paymentAmount,
        })
        .eq('id', claim.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Claim amount updated successfully",
      });
      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating claim amount:', error);
      toast({
        title: "Error",
        description: "Failed to update claim amount",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!claim) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Edit Claim Amount
          </DialogTitle>
          <DialogDescription>
            Update the payment amount for {claim.name}'s claim
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="payment-amount">Payment Amount (£)</Label>
            <Input
              id="payment-amount"
              type="number"
              step="0.01"
              min="0"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
            />
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">Current Details:</div>
            <div className="mt-1 space-y-1">
              <div className="text-sm"><span className="font-medium">Customer:</span> {claim.name}</div>
              <div className="text-sm"><span className="font-medium">Vehicle:</span> {claim.vehicle_registration || 'N/A'}</div>
              <div className="text-sm"><span className="font-medium">Status:</span> {claim.status.toUpperCase()}</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSaveAmount} disabled={loading}>
            {loading ? 'Saving...' : 'Save Amount'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
