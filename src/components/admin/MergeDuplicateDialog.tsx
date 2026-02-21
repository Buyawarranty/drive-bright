import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { GitMerge, AlertTriangle, Check } from 'lucide-react';
import { format } from 'date-fns';

interface DuplicateCustomer {
  id: string;
  name: string;
  email: string;
  registration_plate: string;
  plan_type: string;
  payment_type?: string;
  final_amount: number;
  signup_date: string;
  status: string;
  warranty_reference_number: string;
  warranty_number: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  policy_id?: string;
  policy_number?: string;
  user_id?: string;
}

interface MergeDuplicateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: DuplicateCustomer[];
  onSuccess: () => void;
}

export const MergeDuplicateDialog: React.FC<MergeDuplicateDialogProps> = ({
  isOpen,
  onClose,
  duplicates,
  onSuccess
}) => {
  const [keepId, setKeepId] = useState<string>(duplicates[0]?.id || '');
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset selection when duplicates change
  React.useEffect(() => {
    if (duplicates.length > 0) {
      setKeepId(duplicates[0].id);
    }
  }, [duplicates]);

  const handleMerge = async () => {
    if (!keepId) {
      toast.error('Please select the record to keep');
      return;
    }

    const toDelete = duplicates.filter(d => d.id !== keepId);
    if (toDelete.length === 0) return;

    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id;

      if (!adminId) {
        toast.error('Unable to identify admin user');
        return;
      }

      let successCount = 0;

      for (const dup of toDelete) {
        try {
          // Soft-delete the duplicate
          const { error } = await supabase.rpc('soft_delete_customer', {
            customer_uuid: dup.id,
            admin_uuid: adminId
          });

          if (error) {
            // Fallback to direct update
            const { error: directError } = await supabase
              .from('customers')
              .update({
                is_deleted: true,
                deleted_at: new Date().toISOString(),
                deleted_by: adminId,
                status: 'Duplicate'
              })
              .eq('id', dup.id);

            if (directError) throw directError;
          } else {
            // Mark status as Duplicate
            await supabase
              .from('customers')
              .update({ status: 'Duplicate' })
              .eq('id', dup.id);
          }

          // Also mark policy as duplicate
          if (dup.policy_id) {
            await supabase
              .from('customer_policies')
              .update({
                is_deleted: true,
                deleted_at: new Date().toISOString(),
                deleted_by: adminId,
                status: 'duplicate'
              })
              .eq('id', dup.policy_id);
          }

          // Log the merge action
          const kept = duplicates.find(d => d.id === keepId);
          await supabase
            .from('admin_notes')
            .insert({
              customer_id: dup.id,
              note: `DUPLICATE MERGED\nKept record: ${kept?.warranty_reference_number || kept?.warranty_number || keepId}\nDuplicate archived: ${dup.warranty_reference_number || dup.warranty_number}\nReg: ${dup.registration_plate}\nProcessed at: ${new Date().toLocaleString()}`
            });

          // Also add a note to the kept record
          await supabase
            .from('admin_notes')
            .insert({
              customer_id: keepId,
              note: `DUPLICATE MERGED\nDuplicate record archived: ${dup.warranty_reference_number || dup.warranty_number}\nReg: ${dup.registration_plate}\nProcessed at: ${new Date().toLocaleString()}`
            });

          successCount++;
        } catch (err: any) {
          console.error(`Error merging ${dup.name}:`, err);
          toast.error(`Failed to merge ${dup.name}: ${err.message}`);
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} duplicate(s) merged successfully. Kept: ${duplicates.find(d => d.id === keepId)?.warranty_reference_number}`);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error processing merge:', error);
      toast.error('Failed to process merge');
    } finally {
      setIsProcessing(false);
    }
  };

  if (duplicates.length < 2) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-600">
            <GitMerge className="h-5 w-5" />
            Merge Duplicate Records
          </DialogTitle>
          <DialogDescription>
            Found {duplicates.length} records for reg <strong>{duplicates[0]?.registration_plate}</strong>. 
            Select which record to <strong>keep</strong> — others will be soft-deleted as duplicates.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">Choose carefully</p>
            <p className="text-xs mt-1">The kept record will be the customer's active warranty. Deleted records go to archive and can be restored.</p>
          </div>
        </div>

        <RadioGroup value={keepId} onValueChange={setKeepId} className="space-y-3 py-2">
          {duplicates.map((dup) => (
            <div
              key={dup.id}
              className={`relative flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                keepId === dup.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
              onClick={() => setKeepId(dup.id)}
            >
              <RadioGroupItem value={dup.id} id={dup.id} className="mt-1" />
              <Label htmlFor={dup.id} className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-sm">{dup.warranty_reference_number || dup.warranty_number}</span>
                  {keepId === dup.id && (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                      <Check className="h-3 w-3 mr-1" />
                      Keep
                    </Badge>
                  )}
                  <Badge variant="outline" className={`text-xs ${
                    dup.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' :
                    dup.status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {dup.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span><strong>Name:</strong> {dup.name}</span>
                  <span><strong>Email:</strong> {dup.email}</span>
                  <span><strong>Plan:</strong> {dup.plan_type}</span>
                  <span><strong>Amount:</strong> £{dup.final_amount?.toFixed(2)}</span>
                  <span><strong>Date:</strong> {format(new Date(dup.signup_date), 'dd/MM/yyyy HH:mm')}</span>
                  <span><strong>Payment:</strong> {dup.payment_type || 'N/A'}</span>
                  <span><strong>Vehicle:</strong> {[dup.vehicle_make, dup.vehicle_model, dup.vehicle_year].filter(Boolean).join(' ') || 'N/A'}</span>
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={isProcessing || !keepId}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isProcessing ? 'Merging...' : `Merge — Keep ${duplicates.find(d => d.id === keepId)?.warranty_reference_number?.split('-').pop() || 'selected'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
