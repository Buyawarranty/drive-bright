import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ClaimStatusEmailPreviewDialog, type PendingClaimStatusChange } from '@/components/admin/claims/ClaimStatusEmailPreviewDialog';
import { SIMPLE_STATUSES } from '@/components/admin/claims-manager/workbench/ClaimsWorkbenchList';

interface ClaimTag {
  id: string;
  name: string;
  color: string;
  description?: string;
}

interface ClaimStatusDropdownProps {
  claimId: string;
  currentTagId?: string;
  currentStatus: string;
  onUpdate: () => void;
  onStatusChanged?: (info: { fromStatus: string; toStatus: string; toLabel: string }) => void;
}

// Normalise legacy/raw DB statuses onto the shared option list used by the
// active claims workbench so both surfaces offer identical choices.
const normaliseStatus = (raw?: string | null): string => {
  const s = (raw || '').toLowerCase().trim();
  if (SIMPLE_STATUSES.some((o) => o.value === s)) return s;
  if (s === 'appeal') return 'appealed';
  if (s === 'awaiting_information' || s === 'evidence_needed' || s === 'evidence') return 'awaiting_info';
  if (s === 'under_review' || s === 'review' || s === 'in_progress' || s === 'new') return 'in_review';
  if (s === 'rejected' || s === 'claim_rejected') return 'declined';
  if (s === 'claim_approved') return 'approved';
  if (s === 'paid') return 'payment_pending';
  if (s === 'partial' || s === 'partial_approved' || s === 'partial_approval') return 'partially_approved';
  if (s === 'canceled') return 'cancelled';
  if (s === 'complaint') return 'complaint_submitted';
  if (s === 'not_customer' || s === 'no_policy') return 'not_a_customer';
  if (s === 'no_response' || s === 'not responded' || s === 'no response' || s === 'unresponsive') return 'not_responded';
  return '';
};

// Optional tag names that pair with a status, so tag colouring stays in sync.
const STATUS_TO_TAG_NAME: Record<string, string> = {
  in_review: 'Under Review',
  awaiting_info: 'Awaiting Info',
  approved: 'Approved',
  payment_pending: 'Paid',
  declined: 'Rejected',
  not_responded: 'Not Responded',
};

export const ClaimStatusDropdown: React.FC<ClaimStatusDropdownProps> = ({
  claimId,
  currentStatus,
  onUpdate,
  onStatusChanged,
}) => {
  const { toast } = useToast();
  const [tags, setTags] = useState<ClaimTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(normaliseStatus(currentStatus));
  const [pendingChange, setPendingChange] = useState<PendingClaimStatusChange | null>(null);

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    setSelected(normaliseStatus(currentStatus));
  }, [currentStatus]);

  const fetchTags = async () => {
    const { data, error } = await supabase
      .from('claim_tags')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching tags:', error);
      return;
    }
    setTags(data || []);
  };

  const applyStatus = async (newStatus: string, label: string) => {
    setLoading(true);
    try {
      const tagName = STATUS_TO_TAG_NAME[newStatus];
      const tag = tagName ? tags.find((t) => t.name === tagName) : undefined;

      const update: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (tag) update.tag_id = tag.id;

      const { error } = await supabase
        .from('claims_submissions')
        .update(update)
        .eq('id', claimId);

      if (error) throw error;

      setSelected(newStatus);
      toast({
        title: 'Status Updated',
        description: `Claim status changed to ${label}`,
      });
      if (onStatusChanged && newStatus !== currentStatus) {
        try { onStatusChanged({ fromStatus: currentStatus, toStatus: newStatus, toLabel: label }); } catch {}
      }
      onUpdate();
    } catch (error) {
      console.error('Error updating claim status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update claim status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (value: string) => {
    const option = SIMPLE_STATUSES.find((o) => o.value === value);
    const label = option?.label || value;

    if (value === normaliseStatus(currentStatus)) {
      applyStatus(value, label);
      return;
    }

    setPendingChange({
      claimId,
      status: value,
      label,
      onSent: async () => {
        await applyStatus(value, label);
      },
    });
  };

  const selectedOption = SIMPLE_STATUSES.find((o) => o.value === selected);

  return (
    <>
      <Select value={selected} onValueChange={handleChange} disabled={loading}>
        <SelectTrigger
          className={`w-full min-w-[200px] h-11 text-sm font-semibold border-2 shadow-sm ${
            selectedOption ? selectedOption.tone : 'bg-muted'
          }`}
        >
          <SelectValue placeholder="Select status">
            {selectedOption ? selectedOption.label : <span className="text-muted-foreground">Select status</span>}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-background border shadow-lg z-50">
          {SIMPLE_STATUSES.map((o) => (
            <SelectItem key={o.value} value={o.value} className="cursor-pointer font-medium">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ClaimStatusEmailPreviewDialog
        pending={pendingChange}
        onClose={() => setPendingChange(null)}
      />
    </>
  );
};
