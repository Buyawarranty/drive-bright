import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowUp, Shield, Wrench, PoundSterling, Sparkles, Send } from 'lucide-react';

interface WarrantyUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerEmail: string;
  customerName: string;
  registrationPlate: string;
  currentClaimLimit?: number;
  currentLabourRate?: number;
  currentExcess?: number;
  onUpgradeComplete: () => void;
}

const CLAIM_LIMIT_OPTIONS = [
  { value: 750, label: '£1,000' },
  { value: 1250, label: '£1,250' },
  { value: 2000, label: '£2,000' },
  { value: 2500, label: '£2,500' },
  { value: 3000, label: '£3,000' },
  { value: 4000, label: '£4,000' },
  { value: 5000, label: '£5,000' },
];

const LABOUR_RATE_OPTIONS = [
  { value: 50, label: '£50/hr - Local Garages' },
  { value: 70, label: '£70/hr - Independent Garages' },
  { value: 100, label: '£100/hr - Approved Garages' },
  { value: 200, label: '£200/hr - Expert Garages' },
];

const EXCESS_OPTIONS = [
  { value: 0, label: '£0' },
  { value: 50, label: '£50' },
  { value: 100, label: '£100' },
  { value: 150, label: '£150' },
  { value: 200, label: '£200' },
];

export function WarrantyUpgradeDialog({
  open,
  onOpenChange,
  customerId,
  customerEmail,
  customerName,
  registrationPlate,
  currentClaimLimit = 1250,
  currentLabourRate = 70,
  currentExcess = 100,
  onUpgradeComplete
}: WarrantyUpgradeDialogProps) {
  const [newClaimLimit, setNewClaimLimit] = useState<number>(currentClaimLimit);
  const [newLabourRate, setNewLabourRate] = useState<number>(currentLabourRate);
  const [newExcess, setNewExcess] = useState<number>(currentExcess);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);

  const hasChanges = 
    newClaimLimit !== currentClaimLimit || 
    newLabourRate !== currentLabourRate || 
    newExcess !== currentExcess;

  const getChangeSummary = () => {
    const changes: string[] = [];
    if (newClaimLimit !== currentClaimLimit) {
      changes.push(`Claim Limit: £${currentClaimLimit.toLocaleString()} → £${newClaimLimit.toLocaleString()}`);
    }
    if (newLabourRate !== currentLabourRate) {
      changes.push(`Labour Rate: £${currentLabourRate}/hr → £${newLabourRate}/hr`);
    }
    if (newExcess !== currentExcess) {
      changes.push(`Excess: £${currentExcess} → £${newExcess}`);
    }
    return changes;
  };

  const handleSubmit = async () => {
    if (!hasChanges) {
      toast.error('No changes to save');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id;

      const changeSummary = getChangeSummary().join(', ');

      // Update customer record
      const { error: customerError } = await supabase
        .from('customers')
        .update({
          claim_limit: newClaimLimit,
          labour_rate: newLabourRate,
          voluntary_excess: newExcess,
          manual_upgrade_at: new Date().toISOString(),
          manual_upgrade_by: adminId,
          manual_upgrade_notes: notes || changeSummary
        })
        .eq('id', customerId);

      if (customerError) throw customerError;

      // Update customer_policies table if exists
      const { error: policyError } = await supabase
        .from('customer_policies')
        .update({
          claim_limit: newClaimLimit,
          voluntary_excess: newExcess,
          manual_upgrade_at: new Date().toISOString(),
          manual_upgrade_by: adminId,
          manual_upgrade_notes: notes || changeSummary
        })
        .eq('customer_id', customerId);

      if (policyError) {
        console.error('Policy update error (non-blocking):', policyError);
      }

      // Add an admin note about the change
      await supabase.from('admin_notes').insert({
        customer_id: customerId,
        note: `⬆️ Manual Warranty Upgrade: ${changeSummary}${notes ? ` | Notes: ${notes}` : ''}`,
        created_by: adminId
      });

      // Send notification email if enabled
      if (sendEmail) {
        try {
          await supabase.functions.invoke('send-warranty-upgrade-notification', {
            body: {
              customerEmail,
              customerName,
              registrationPlate,
              changes: {
                claimLimit: newClaimLimit !== currentClaimLimit ? { from: currentClaimLimit, to: newClaimLimit } : null,
                labourRate: newLabourRate !== currentLabourRate ? { from: currentLabourRate, to: newLabourRate } : null,
                excess: newExcess !== currentExcess ? { from: currentExcess, to: newExcess } : null,
              }
            }
          });
          toast.success('Warranty upgraded and customer notified via email');
        } catch (emailError) {
          console.error('Email notification error:', emailError);
          toast.success('Warranty upgraded (email notification failed)');
        }
      } else {
        toast.success('Warranty upgraded successfully');
      }

      onUpgradeComplete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error upgrading warranty:', error);
      toast.error('Failed to upgrade warranty');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Manual Warranty Upgrade
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <p className="font-medium">{customerName}</p>
            <p className="text-muted-foreground">{registrationPlate} • {customerEmail}</p>
          </div>

          {/* Claim Limit */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              Claim Limit
            </Label>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Current: £{currentClaimLimit.toLocaleString()}</Badge>
              {newClaimLimit !== currentClaimLimit && (
                <ArrowUp className="h-4 w-4 text-green-500" />
              )}
            </div>
            <Select value={newClaimLimit.toString()} onValueChange={(v) => setNewClaimLimit(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLAIM_LIMIT_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Labour Rate */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-orange-500" />
              Labour Rate
            </Label>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Current: £{currentLabourRate}/hr</Badge>
              {newLabourRate !== currentLabourRate && (
                <ArrowUp className="h-4 w-4 text-green-500" />
              )}
            </div>
            <Select value={newLabourRate.toString()} onValueChange={(v) => setNewLabourRate(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LABOUR_RATE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Voluntary Excess */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <PoundSterling className="h-4 w-4 text-green-500" />
              Voluntary Excess
            </Label>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">Current: £{currentExcess}</Badge>
              {newExcess !== currentExcess && (
                <ArrowUp className="h-4 w-4 text-green-500" />
              )}
            </div>
            <Select value={newExcess.toString()} onValueChange={(v) => setNewExcess(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXCESS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Upgrade Notes (Optional)</Label>
            <Textarea 
              placeholder="Reason for upgrade..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Send Email Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="send-email"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="send-email" className="flex items-center gap-1 cursor-pointer">
              <Send className="h-3 w-3" />
              Send email notification to customer
            </Label>
          </div>

          {/* Change Summary */}
          {hasChanges && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-800 mb-1">Changes to apply:</p>
              <ul className="text-sm text-green-700 space-y-0.5">
                {getChangeSummary().map((change, i) => (
                  <li key={i}>• {change}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!hasChanges || isSubmitting}
            className="bg-gradient-to-r from-amber-500 to-orange-500 text-white"
          >
            {isSubmitting ? 'Upgrading...' : 'Apply Upgrade'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
