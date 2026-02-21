import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sparkles, Send, Check, X, ChevronDown } from 'lucide-react';
import { getDisplayClaimLimitValue } from '@/lib/claimLimitTiers';

interface InlineUpgradeCellProps {
  customerId: string;
  customerEmail: string;
  customerName: string;
  registrationPlate: string;
  currentClaimLimit?: number;
  currentLabourRate?: number;
  currentExcess?: number;
  onUpdate: () => void;
  // Add-ons
  tyreCover?: boolean;
  wearTear?: boolean;
  europeCover?: boolean;
  transferCover?: boolean;
  breakdownRecovery?: boolean;
  vehicleRental?: boolean;
  motFee?: boolean;
  motRepair?: boolean;
  lostKey?: boolean;
  consequential?: boolean;
}

const EXCESS_OPTIONS = [
  { value: 0, label: '£0' },
  { value: 50, label: '£50' },
  { value: 100, label: '£100' },
  { value: 150, label: '£150' },
  { value: 200, label: '£200' },
];

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
  { value: 50, label: '£50/hr' },
  { value: 70, label: '£70/hr' },
  { value: 100, label: '£100/hr' },
  { value: 200, label: '£200/hr' },
];

export function InlineUpgradeCell({
  customerId,
  customerEmail,
  customerName,
  registrationPlate,
  currentClaimLimit = 1250,
  currentLabourRate = 70,
  currentExcess = 100,
  onUpdate,
  tyreCover,
  wearTear,
  europeCover,
  transferCover,
  breakdownRecovery,
  vehicleRental,
  motFee,
  motRepair,
  lostKey,
  consequential,
}: InlineUpgradeCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Form state
  const [newClaimLimit, setNewClaimLimit] = useState(currentClaimLimit);
  const [newLabourRate, setNewLabourRate] = useState(currentLabourRate);
  const [newExcess, setNewExcess] = useState(currentExcess);
  
  // Add-on state
  const [addOns, setAddOns] = useState({
    tyre_cover: tyreCover || false,
    wear_tear: wearTear || false,
    europe_cover: europeCover || false,
    transfer_cover: transferCover || false,
    breakdown_recovery: breakdownRecovery || false,
    vehicle_rental: vehicleRental || false,
    mot_fee: motFee || false,
    mot_repair: motRepair || false,
    lost_key: lostKey || false,
    consequential: consequential || false,
  });

  const hasChanges = 
    newClaimLimit !== currentClaimLimit || 
    newLabourRate !== currentLabourRate || 
    newExcess !== currentExcess ||
    addOns.tyre_cover !== (tyreCover || false) ||
    addOns.wear_tear !== (wearTear || false) ||
    addOns.europe_cover !== (europeCover || false) ||
    addOns.transfer_cover !== (transferCover || false) ||
    addOns.breakdown_recovery !== (breakdownRecovery || false) ||
    addOns.vehicle_rental !== (vehicleRental || false) ||
    addOns.mot_fee !== (motFee || false) ||
    addOns.mot_repair !== (motRepair || false) ||
    addOns.lost_key !== (lostKey || false) ||
    addOns.consequential !== (consequential || false);

  const getChangeSummary = () => {
    const changes: string[] = [];
    if (newClaimLimit !== currentClaimLimit) {
      changes.push(`Claim Limit: £${getDisplayClaimLimitValue(currentClaimLimit).toLocaleString()} → £${getDisplayClaimLimitValue(newClaimLimit).toLocaleString()}`);
    }
    if (newLabourRate !== currentLabourRate) {
      changes.push(`Labour Rate: £${currentLabourRate}/hr → £${newLabourRate}/hr`);
    }
    if (newExcess !== currentExcess) {
      changes.push(`Excess: £${currentExcess} → £${newExcess}`);
    }
    // Add-on changes
    const addOnLabels: Record<string, string> = {
      tyre_cover: 'Tyre Cover',
      wear_tear: 'Wear & Tear',
      europe_cover: 'Europe Cover',
      transfer_cover: 'Transfer Cover',
      breakdown_recovery: 'Breakdown Recovery',
      vehicle_rental: 'Vehicle Rental',
      mot_fee: 'MOT Fee',
      mot_repair: 'MOT Repair',
      lost_key: 'Lost Key',
      consequential: 'Consequential Loss',
    };
    
    Object.entries(addOns).forEach(([key, value]) => {
      const originalValue = key === 'tyre_cover' ? tyreCover :
        key === 'wear_tear' ? wearTear :
        key === 'europe_cover' ? europeCover :
        key === 'transfer_cover' ? transferCover :
        key === 'breakdown_recovery' ? breakdownRecovery :
        key === 'vehicle_rental' ? vehicleRental :
        key === 'mot_fee' ? motFee :
        key === 'mot_repair' ? motRepair :
        key === 'lost_key' ? lostKey :
        consequential;
      
      if (value !== (originalValue || false)) {
        changes.push(`${addOnLabels[key]}: ${value ? 'Added' : 'Removed'}`);
      }
    });
    
    return changes;
  };

  const handleSubmit = async () => {
    if (!hasChanges) {
      setIsOpen(false);
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
          tyre_cover: addOns.tyre_cover,
          wear_tear: addOns.wear_tear,
          europe_cover: addOns.europe_cover,
          transfer_cover: addOns.transfer_cover,
          breakdown_recovery: addOns.breakdown_recovery,
          vehicle_rental: addOns.vehicle_rental,
          mot_fee: addOns.mot_fee,
          mot_repair: addOns.mot_repair,
          lost_key: addOns.lost_key,
          consequential: addOns.consequential,
          manual_upgrade_at: new Date().toISOString(),
          manual_upgrade_by: adminId,
          manual_upgrade_notes: changeSummary
        })
        .eq('id', customerId);

      if (customerError) throw customerError;

      // Update customer_policies table if exists
      const { error: policyError } = await supabase
        .from('customer_policies')
        .update({
          claim_limit: newClaimLimit,
          voluntary_excess: newExcess,
          tyre_cover: addOns.tyre_cover,
          wear_tear: addOns.wear_tear,
          europe_cover: addOns.europe_cover,
          transfer_cover: addOns.transfer_cover,
          breakdown_recovery: addOns.breakdown_recovery,
          vehicle_rental: addOns.vehicle_rental,
          mot_fee: addOns.mot_fee,
          mot_repair: addOns.mot_repair,
          lost_key: addOns.lost_key,
          consequential: addOns.consequential,
          manual_upgrade_at: new Date().toISOString(),
          manual_upgrade_by: adminId,
          manual_upgrade_notes: changeSummary
        })
        .eq('customer_id', customerId);

      if (policyError) {
        console.error('Policy update error (non-blocking):', policyError);
      }

      // Add an admin note
      await supabase.from('admin_notes').insert({
        customer_id: customerId,
        note: `⬆️ Warranty Upgrade: ${changeSummary}`,
        created_by: adminId
      });

      toast.success('Warranty updated successfully');
      onUpdate();
      setIsOpen(false);
    } catch (error) {
      console.error('Error updating warranty:', error);
      toast.error('Failed to update warranty');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!hasChanges) {
      toast.error('No changes to send');
      return;
    }

    // First save changes
    await handleSubmit();

    setIsSending(true);

    try {
      const changes = {
        claimLimit: newClaimLimit !== currentClaimLimit ? { from: currentClaimLimit, to: newClaimLimit } : null,
        labourRate: newLabourRate !== currentLabourRate ? { from: currentLabourRate, to: newLabourRate } : null,
        excess: newExcess !== currentExcess ? { from: currentExcess, to: newExcess } : null,
      };

      await supabase.functions.invoke('send-warranty-upgrade-notification', {
        body: {
          customerEmail,
          customerName,
          registrationPlate,
          changes
        }
      });

      toast.success('Upgrade notification sent to customer');
    } catch (error) {
      console.error('Email notification error:', error);
      toast.error('Failed to send notification email');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 hover:bg-amber-100"
          >
            <Sparkles className="h-3 w-3 mr-1 text-amber-600" />
            Upgrade
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium border-b pb-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Upgrade Warranty
            </div>
            
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              {registrationPlate} • {customerName}
            </div>

            {/* Claim Limit */}
            <div className="space-y-1">
              <Label className="text-xs">Claim Limit</Label>
              <Select value={newClaimLimit.toString()} onValueChange={(v) => setNewClaimLimit(parseInt(v))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLAIM_LIMIT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                      {opt.label}
                      {opt.value === currentClaimLimit && <span className="ml-1 text-muted-foreground">(current)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Labour Rate */}
            <div className="space-y-1">
              <Label className="text-xs">Labour Rate</Label>
              <Select value={newLabourRate.toString()} onValueChange={(v) => setNewLabourRate(parseInt(v))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LABOUR_RATE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                      {opt.label}
                      {opt.value === currentLabourRate && <span className="ml-1 text-muted-foreground">(current)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Excess */}
            <div className="space-y-1">
              <Label className="text-xs">Voluntary Excess</Label>
              <Select value={newExcess.toString()} onValueChange={(v) => setNewExcess(parseInt(v))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXCESS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                      {opt.label}
                      {opt.value === currentExcess && <span className="ml-1 text-muted-foreground">(current)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Add-ons */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-medium">Add-ons</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'mot_fee', label: 'MOT Fee' },
                  { key: 'breakdown_recovery', label: 'Breakdown' },
                  { key: 'tyre_cover', label: 'Tyre Cover' },
                  { key: 'wear_tear', label: 'Wear & Tear' },
                  { key: 'europe_cover', label: 'Europe' },
                  { key: 'vehicle_rental', label: 'Rental' },
                  { key: 'transfer_cover', label: 'Transfer' },
                  { key: 'mot_repair', label: 'MOT Repair' },
                  { key: 'lost_key', label: 'Lost Key' },
                  { key: 'consequential', label: 'Consequential' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`addon-${key}`}
                      checked={addOns[key as keyof typeof addOns]}
                      onCheckedChange={(checked) => setAddOns({ ...addOns, [key]: !!checked })}
                      className="h-3 w-3"
                    />
                    <Label htmlFor={`addon-${key}`} className="text-xs cursor-pointer">{label}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Change summary */}
            {hasChanges && (
              <div className="p-2 bg-green-50 border border-green-200 rounded text-xs">
                <p className="font-medium text-green-800 mb-1">Changes:</p>
                <ul className="text-green-700 space-y-0.5">
                  {getChangeSummary().slice(0, 4).map((change, i) => (
                    <li key={i}>• {change}</li>
                  ))}
                  {getChangeSummary().length > 4 && (
                    <li>• +{getChangeSummary().length - 4} more...</li>
                  )}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1 h-8 text-xs"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
              <Button 
                size="sm" 
                className="flex-1 h-8 text-xs bg-amber-500 hover:bg-amber-600"
                onClick={handleSubmit}
                disabled={isSubmitting || !hasChanges}
              >
                <Check className="h-3 w-3 mr-1" />
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Send button - always visible */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
        onClick={handleSendEmail}
        disabled={isSending || !hasChanges}
        title="Send upgrade notification to customer"
      >
        {isSending ? (
          <div className="animate-spin rounded-full h-3 w-3 border border-blue-600 border-t-transparent" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
