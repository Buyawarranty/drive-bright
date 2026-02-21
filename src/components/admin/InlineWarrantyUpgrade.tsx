import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, X, Sparkles, Pencil } from 'lucide-react';
import { getDisplayClaimLimitValue } from '@/lib/claimLimitTiers';

interface InlineWarrantyUpgradeProps {
  customerId: string;
  customerEmail: string;
  customerName: string;
  registrationPlate: string;
  field: 'excess' | 'claim_limit' | 'labour_rate';
  currentValue: number;
  onUpdate: () => void;
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

export function InlineWarrantyUpgrade({
  customerId,
  customerEmail,
  customerName,
  registrationPlate,
  field,
  currentValue,
  onUpdate
}: InlineWarrantyUpgradeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newValue, setNewValue] = useState<number>(currentValue);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const options = field === 'excess' 
    ? EXCESS_OPTIONS 
    : field === 'claim_limit' 
      ? CLAIM_LIMIT_OPTIONS 
      : LABOUR_RATE_OPTIONS;

  const getDisplayValue = () => {
    if (field === 'labour_rate') {
      return `£${currentValue || 70}/hr`;
    }
    const val = currentValue || (field === 'claim_limit' ? 1250 : 100);
    if (field === 'claim_limit') {
      return `£${getDisplayClaimLimitValue(val).toLocaleString()}`;
    }
    return `£${val}`;
  };

  const getBadgeStyle = () => {
    if (field === 'excess') return 'bg-blue-50 text-blue-700 hover:bg-blue-100';
    if (field === 'claim_limit') return 'bg-green-50 text-green-700 hover:bg-green-100';
    return 'bg-purple-50 text-purple-700 hover:bg-purple-100';
  };

  const getFieldDisplayName = () => {
    if (field === 'excess') return 'Voluntary Excess';
    if (field === 'claim_limit') return 'Claim Limit';
    return 'Labour Rate';
  };

  const handleSubmit = async () => {
    if (newValue === currentValue) {
      setIsOpen(false);
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const adminId = user?.id;

      const fieldMap: Record<string, string> = {
        excess: 'voluntary_excess',
        claim_limit: 'claim_limit',
        labour_rate: 'labour_rate'
      };

      const dbField = fieldMap[field];
      const changeSummary = `${getFieldDisplayName()}: £${currentValue} → £${newValue}${field === 'labour_rate' ? '/hr' : ''}`;

      // Update customer record
      const { error: customerError } = await supabase
        .from('customers')
        .update({
          [dbField]: newValue,
          manual_upgrade_at: new Date().toISOString(),
          manual_upgrade_by: adminId,
          manual_upgrade_notes: changeSummary
        })
        .eq('id', customerId);

      if (customerError) throw customerError;

      // Update customer_policies table if exists
      if (field !== 'labour_rate') {
        const { error: policyError } = await supabase
          .from('customer_policies')
          .update({
            [dbField]: newValue,
            manual_upgrade_at: new Date().toISOString(),
            manual_upgrade_by: adminId,
            manual_upgrade_notes: changeSummary
          })
          .eq('customer_id', customerId);

        if (policyError) {
          console.error('Policy update error (non-blocking):', policyError);
        }
      }

      // Add an admin note
      await supabase.from('admin_notes').insert({
        customer_id: customerId,
        note: `⬆️ Quick Upgrade: ${changeSummary}`,
        created_by: adminId
      });

      toast.success(`${getFieldDisplayName()} updated successfully`);
      onUpdate();
      setIsOpen(false);
    } catch (error) {
      console.error('Error updating warranty:', error);
      toast.error('Failed to update warranty');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Badge 
          variant={field === 'excess' ? 'secondary' : 'outline'} 
          className={`${getBadgeStyle()} cursor-pointer transition-all group`}
        >
          {getDisplayValue()}
          <Pencil className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Update {getFieldDisplayName()}
          </div>
          
          <div className="text-xs text-muted-foreground">
            {registrationPlate} • {customerName}
          </div>

          <Select 
            value={newValue.toString()} 
            onValueChange={(v) => setNewValue(parseInt(v))}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map(opt => (
                <SelectItem key={opt.value} value={opt.value.toString()}>
                  {opt.label}
                  {opt.value === currentValue && (
                    <span className="ml-2 text-xs text-muted-foreground">(current)</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1 h-8"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
            <Button 
              size="sm" 
              className="flex-1 h-8 bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleSubmit}
              disabled={isSubmitting || newValue === currentValue}
            >
              <Check className="h-3 w-3 mr-1" />
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
