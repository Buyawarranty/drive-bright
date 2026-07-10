import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ClaimStatusEmailPreviewDialog, type PendingClaimStatusChange } from '@/components/admin/claims/ClaimStatusEmailPreviewDialog';

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

export const ClaimStatusDropdown: React.FC<ClaimStatusDropdownProps> = ({
  claimId,
  currentTagId,
  currentStatus,
  onUpdate,
  onStatusChanged,
}) => {
  const { toast } = useToast();
  const [tags, setTags] = useState<ClaimTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState(currentTagId || '');
  const [pendingChange, setPendingChange] = useState<PendingClaimStatusChange | null>(null);

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    setSelectedTagId(currentTagId || '');
  }, [currentTagId]);

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

  const applyTag = async (tagId: string, newStatus: string, tagName?: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('claims_submissions')
        .update({
          tag_id: tagId,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', claimId);

      if (error) throw error;

      setSelectedTagId(tagId);
      toast({
        title: 'Status Updated',
        description: `Claim status changed to ${tagName || newStatus}`,
      });
      if (onStatusChanged && newStatus !== currentStatus) {
        try { onStatusChanged({ fromStatus: currentStatus, toStatus: newStatus, toLabel: tagName || newStatus }); } catch {}
      }
      onUpdate();
    } catch (error) {
      console.error('Error updating tag:', error);
      toast({
        title: 'Error',
        description: 'Failed to update claim status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTagChange = (tagId: string) => {
    const tag = tags.find((t) => t.id === tagId);
    const statusMap: Record<string, string> = {
      New: 'new',
      'In Progress': 'in_progress',
      'Awaiting Info': 'awaiting_info',
      'Under Review': 'in_progress',
      Approved: 'approved',
      Paid: 'paid',
      Rejected: 'rejected',
      'On Hold': 'in_progress',
      Escalated: 'in_progress',
      'Fake/Test': 'fake_test',
    };

    const newStatus = tag ? statusMap[tag.name] || 'in_progress' : currentStatus;

    // If the underlying status didn't change, just persist the tag without an email.
    if (newStatus === currentStatus) {
      applyTag(tagId, newStatus, tag?.name);
      return;
    }

    // Otherwise open the review-before-send dialog.
    setPendingChange({
      claimId,
      status: newStatus,
      label: tag?.name,
      onSent: async () => {
        await applyTag(tagId, newStatus, tag?.name);
      },
    });
  };

  const selectedTag = tags.find(t => t.id === selectedTagId);

  return (
    <>
      <Select
        value={selectedTagId}
        onValueChange={handleTagChange}
        disabled={loading}
      >
        <SelectTrigger
          className="w-full min-w-[200px] h-11 text-sm font-semibold border-2 shadow-sm"
          style={{
            backgroundColor: selectedTag?.color ? `${selectedTag.color}18` : '#FEF9C3',
            borderColor: selectedTag?.color || undefined,
            color: selectedTag?.color || undefined,
          }}
        >
          <SelectValue placeholder="Select status">
            {selectedTag ? (
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: selectedTag.color }}
                />
                <span>{selectedTag.name}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Select status</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-background border shadow-lg z-50">
          {tags.map((tag) => (
            <SelectItem
              key={tag.id}
              value={tag.id}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span style={{ color: tag.color }} className="font-medium">
                  {tag.name}
                </span>
              </div>
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
