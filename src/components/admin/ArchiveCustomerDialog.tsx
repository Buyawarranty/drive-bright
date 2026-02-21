import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Archive, Ban, PoundSterling, RotateCcw, UserX, AlertTriangle, FlaskConical, UserMinus, Copy } from 'lucide-react';

export type ArchiveAction = 'cancel' | 'refund' | 'archive' | 'test' | 'fake' | 'duplicate';

interface ArchiveCustomerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Array<{
    id: string;
    name: string;
    email: string;
    policy_id?: string;
    policy_number?: string;
    user_id?: string;
    customer_id?: string;
  }>;
  onSuccess: () => void;
}

const ARCHIVE_REASONS = [
  'Customer requested cancellation',
  'Cooling-off period cancellation (14 days)',
  'Customer refund processed',
  'Non-payment / Failed payments',
  'Fraudulent application',
  'Vehicle sold',
  'Duplicate policy',
  'Administrative error',
  'Test record cleanup',
    'Fake/Spam lead',
    'Duplicate record',
    'Other'
];

export const ArchiveCustomerDialog: React.FC<ArchiveCustomerDialogProps> = ({
  isOpen,
  onClose,
  customers,
  onSuccess
}) => {
  const [action, setAction] = useState<ArchiveAction>('cancel');
  const [reason, setReason] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [revokePortalAccess, setRevokePortalAccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const isBulk = customers.length > 1;

  // Auto-select reason when refund, test, or fake is chosen
  const handleActionChange = (newAction: ArchiveAction) => {
    setAction(newAction);
    if (newAction === 'refund' && !reason) {
      setReason('Customer refund processed');
    } else if (newAction === 'test' && !reason) {
      setReason('Test record cleanup');
    } else if (newAction === 'fake' && !reason) {
      setReason('Fake/Spam lead');
    } else if (newAction === 'duplicate' && !reason) {
      setReason('Duplicate record');
    }
  };

  const handleSubmit = async () => {
    if (!reason && action !== 'test' && action !== 'fake' && action !== 'duplicate') {
      toast.error('Please select a reason');
      return;
    }

    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id;

      if (!adminId) {
        toast.error('Unable to identify admin user');
        return;
      }

      let successCount = 0;
      const errors: string[] = [];

      for (const customer of customers) {
        try {
          if (action === 'archive' || action === 'test' || action === 'fake' || action === 'duplicate') {
            // Soft delete - hide from view but keep in database
            const statusUpdate = action === 'test' ? 'Test Purchase' : action === 'fake' ? 'Fake Lead' : action === 'duplicate' ? 'Duplicate' : undefined;
            
            const { error } = await supabase.rpc('soft_delete_customer', {
              customer_uuid: customer.id,
              admin_uuid: adminId
            });

            if (error) {
              // Try direct update as fallback
              const { error: directError } = await supabase
                .from('customers')
                .update({
                  is_deleted: true,
                  deleted_at: new Date().toISOString(),
                  deleted_by: adminId,
                  ...(statusUpdate ? { status: statusUpdate } : {})
                })
                .eq('id', customer.id);
              
              if (directError) throw directError;
            } else if (statusUpdate) {
              // Update status to Test Purchase or Fake Lead
              await supabase
                .from('customers')
                .update({ status: statusUpdate })
                .eq('id', customer.id);
            }
            
            // Also archive related policies
            if (customer.policy_id) {
              const policyStatus = action === 'test' ? 'test' : action === 'fake' ? 'fake_lead' : action === 'duplicate' ? 'duplicate' : undefined;
              await supabase
                .from('customer_policies')
                .update({
                  is_deleted: true,
                  deleted_at: new Date().toISOString(),
                  deleted_by: adminId,
                  ...(policyStatus ? { status: policyStatus } : {})
                })
                .eq('id', customer.policy_id);
            }
          } else {
            // Cancel or Refund - update status but keep visible
            const newStatus = action === 'refund' ? 'Refunded' : 'Cancelled';

            // Update customer status
            const { error: customerError } = await supabase
              .from('customers')
              .update({ 
                status: newStatus,
                updated_at: new Date().toISOString()
              })
              .eq('id', customer.id);

            if (customerError) throw customerError;

            // Update related policy if exists
            if (customer.policy_id) {
              await supabase
                .from('customer_policies')
                .update({ 
                  status: action === 'refund' ? 'refunded' : 'cancelled',
                  updated_at: new Date().toISOString()
                })
                .eq('id', customer.policy_id);
            }

            // Revoke portal access if selected
            if (revokePortalAccess && customer.user_id && customer.policy_id) {
              await supabase
                .from('customer_policies')
                .update({ user_id: null })
                .eq('id', customer.policy_id);
            }
          }

          // Log the action as a note
          const actionLabel = action === 'archive' ? 'ARCHIVED' : action === 'test' ? 'TEST PURCHASE ARCHIVED' : action === 'fake' ? 'FAKE LEAD ARCHIVED' : action === 'duplicate' ? 'DUPLICATE ARCHIVED' : action === 'refund' ? 'REFUNDED' : 'CANCELLED';
          const noteText = `WARRANTY ${actionLabel}\n` +
            `Reason: ${reason}\n` +
            `${action === 'refund' && refundAmount ? `Refund Amount: £${refundAmount}\n` : ''}` +
            `${additionalNotes ? `Notes: ${additionalNotes}\n` : ''}` +
            `Processed at: ${new Date().toLocaleString()}`;

          await supabase
            .from('admin_notes')
            .insert({
              customer_id: customer.id,
              note: noteText
            });

          successCount++;
        } catch (err: any) {
          console.error(`Error processing ${customer.name}:`, err);
          errors.push(`${customer.name}: ${err.message}`);
        }
      }

      if (successCount > 0) {
        const actionText = action === 'archive' ? 'archived' : action === 'test' ? 'marked as test and archived' : action === 'fake' ? 'marked as fake lead and archived' : action === 'duplicate' ? 'marked as duplicate and archived' : action === 'refund' ? 'marked as refunded' : 'cancelled';
        toast.success(
          isBulk 
            ? `${successCount} customer(s) ${actionText} successfully`
            : `${customers[0].name} ${actionText} successfully`
        );
      }

      if (errors.length > 0) {
        toast.error(`Some operations failed: ${errors.join(', ')}`);
      }

      onSuccess();
      onClose();

      // Reset form
      setAction('cancel');
      setReason('');
      setAdditionalNotes('');
      setRefundAmount('');
      setRevokePortalAccess(false);

    } catch (error) {
      console.error('Error processing archive action:', error);
      toast.error('Failed to process archive action');
    } finally {
      setIsProcessing(false);
    }
  };

  const getActionIcon = () => {
    switch (action) {
      case 'refund': return <PoundSterling className="h-5 w-5" />;
      case 'archive': return <Archive className="h-5 w-5" />;
      case 'test': return <FlaskConical className="h-5 w-5" />;
      case 'fake': return <UserMinus className="h-5 w-5" />;
      case 'duplicate': return <Copy className="h-5 w-5" />;
      default: return <Ban className="h-5 w-5" />;
    }
  };

  const getActionColor = () => {
    switch (action) {
      case 'refund': return 'text-amber-600';
      case 'archive': return 'text-gray-600';
      case 'test': return 'text-purple-600';
      case 'fake': return 'text-orange-600';
      case 'duplicate': return 'text-blue-600';
      default: return 'text-red-600';
    }
  };

  const getButtonVariant = () => {
    switch (action) {
      case 'refund': return 'default';
      case 'archive': return 'secondary';
      case 'test': return 'default';
      case 'fake': return 'default';
      case 'duplicate': return 'default';
      default: return 'destructive';
    }
  };

  const getButtonText = () => {
    if (isProcessing) return 'Processing...';
    const count = isBulk ? ` (${customers.length})` : '';
    switch (action) {
      case 'refund': return `Mark as Refunded${count}`;
      case 'archive': return `Archive${count}`;
      case 'test': return `Mark as Test${count}`;
      case 'fake': return `Mark as Fake Lead${count}`;
      case 'duplicate': return `Mark as Duplicate${count}`;
      default: return `Cancel Warranty${count}`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${getActionColor()}`}>
            {getActionIcon()}
            {isBulk ? `Archive ${customers.length} Customers` : 'Archive Customer'}
          </DialogTitle>
          <DialogDescription>
            {isBulk ? (
              <span>Choose how to handle {customers.length} selected customer(s).</span>
            ) : (
              <span>
                Choose how to handle <strong>{customers[0]?.name || customers[0]?.email}</strong>.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Action Type Selector */}
          <div className="space-y-2">
            <Label>Action Type *</Label>
            <Select value={action} onValueChange={(val) => handleActionChange(val as ArchiveAction)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cancel">
                  <div className="flex items-center gap-2">
                    <Ban className="h-4 w-4 text-red-500" />
                    <span>Cancel Warranty</span>
                  </div>
                </SelectItem>
                <SelectItem value="refund">
                  <div className="flex items-center gap-2">
                    <PoundSterling className="h-4 w-4 text-amber-500" />
                    <span>Mark as Refunded</span>
                  </div>
                </SelectItem>
                <SelectItem value="archive">
                  <div className="flex items-center gap-2">
                    <Archive className="h-4 w-4 text-gray-500" />
                    <span>Archive (Hide from view)</span>
                  </div>
                </SelectItem>
                <SelectItem value="test">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-purple-500" />
                    <span>Mark as Test Purchase</span>
                  </div>
                </SelectItem>
                <SelectItem value="fake">
                  <div className="flex items-center gap-2">
                    <UserMinus className="h-4 w-4 text-orange-500" />
                    <span>Mark as Fake Lead</span>
                  </div>
                </SelectItem>
                <SelectItem value="duplicate">
                  <div className="flex items-center gap-2">
                    <Copy className="h-4 w-4 text-blue-500" />
                    <span>Mark as Duplicate</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Info boxes based on action */}
          {action === 'cancel' && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-medium">Customer remains visible</p>
                <p className="text-xs mt-1">Row will be highlighted in red. Status will show as "Cancelled".</p>
              </div>
            </div>
          )}

          {action === 'refund' && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <PoundSterling className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 flex-1">
                <p className="font-medium">Customer remains visible</p>
                <p className="text-xs mt-1">Row will be highlighted in amber. Status will show as "Refunded".</p>
                <div className="mt-2">
                  <Label htmlFor="refundAmount" className="text-xs text-amber-700">Refund Amount (optional)</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-amber-600">£</span>
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
              </div>
            </div>
          )}

          {action === 'archive' && (
            <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <Archive className="h-5 w-5 text-gray-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-800">
                <p className="font-medium">Hidden from active view</p>
                <p className="text-xs mt-1">Customer will be moved to Order Archive. You can restore them anytime.</p>
              </div>
            </div>
          )}

          {action === 'test' && (
            <div className="flex items-start gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <FlaskConical className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-purple-800">
                <p className="font-medium">Test purchase - Hidden from active view</p>
                <p className="text-xs mt-1">Record will be marked as "Test Purchase" and moved to archive. Ideal for test transactions.</p>
              </div>
            </div>
          )}

          {action === 'fake' && (
            <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <UserMinus className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-800">
                <p className="font-medium">Fake/Spam lead - Hidden from active view</p>
                <p className="text-xs mt-1">Record will be marked as "Fake Lead" and moved to archive. Use for spam or fraudulent entries.</p>
              </div>
            </div>
          )}

          {action === 'duplicate' && (
            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Copy className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Duplicate record - Hidden from active view</p>
                <p className="text-xs mt-1">Record will be marked as "Duplicate" and moved to archive. Use for duplicate customer entries.</p>
              </div>
            </div>
          )}

          {/* Reason & Notes - hide for test/fake/duplicate since they just archive immediately */}
          {action !== 'test' && action !== 'fake' && action !== 'duplicate' && (
            <>
              {/* Reason Selector */}
              <div className="space-y-2">
                <Label htmlFor="reason">Reason *</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ARCHIVE_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
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
                  placeholder="Enter any additional details..."
                  rows={2}
                />
              </div>

              {/* Revoke Portal Access - only for cancel/refund */}
              {action !== 'archive' && !isBulk && customers[0]?.user_id && (
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
                      Prevent customer from logging into their dashboard.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button 
            variant={getButtonVariant() as any}
            onClick={handleSubmit}
            disabled={isProcessing || (action !== 'test' && action !== 'fake' && action !== 'duplicate' && !reason)}
            className={action === 'refund' ? 'bg-amber-600 hover:bg-amber-700' : action === 'test' ? 'bg-purple-600 hover:bg-purple-700' : action === 'fake' ? 'bg-orange-600 hover:bg-orange-700' : action === 'duplicate' ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            {getButtonText()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
