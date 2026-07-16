import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ClaimRecontactBatchButtonProps {
  onClaimed?: () => void;
}

/**
 * Lets an agent atomically claim the next 100 oldest unassigned leads on the
 * Recontact Leads tab. Two agents can never receive the same lead (server-side
 * FOR UPDATE SKIP LOCKED). Blocks re-claiming until the previous batch has
 * been worked (status moved off "new").
 *
 * Only renders when the current URL tab is `recontact-leads` so the New Leads
 * flow is unaffected.
 */
const ClaimRecontactBatchButton: React.FC<ClaimRecontactBatchButtonProps> = ({ onClaimed }) => {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab');
  const [loading, setLoading] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  if (activeTab !== 'recontact-leads') return null;

  const runClaim = async (force: boolean) => {
    try {
      setLoading(true);
      const { data, error } = await (supabase.rpc as any)('claim_recontact_leads_batch', {
        _batch_size: 200,
        _force: force,
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      const reason: string | null = row?.blocked_reason ?? null;
      const claimed: number = row?.claimed_count ?? 0;
      const pending: number = row?.pending_count ?? 0;
      const remaining: number = row?.pool_remaining ?? 0;
      const oldestDays: number = row?.oldest_age_days ?? 0;

      if (reason === 'not_admin') {
        toast.error("You don't have permission to claim leads");
        return;
      }
      if (reason === 'pending_batch') {
        setPendingCount(pending);
        setBlockedOpen(true);
        return;
      }
      if (claimed === 0) {
        toast.info('No unassigned leads older than 30 days available right now');
        return;
      }
      const remainingBit = remaining > 0
        ? ` · ${remaining} still in pool${oldestDays > 0 ? ` · oldest ${oldestDays}d` : ''}`
        : ' · pool now empty';
      toast.success(`Claimed ${claimed} lead${claimed === 1 ? '' : 's'} (oldest first)${remainingBit}`);
      onClaimed?.();
    } catch (err: any) {
      console.error('claim_recontact_leads_batch failed', err);
      toast.error(err?.message || 'Failed to claim leads');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = () => runClaim(false);

  return (
    <>
      <Button
        onClick={handleClaim}
        disabled={loading}
        size="sm"
        className="bg-purple-600 hover:bg-purple-700 text-white"
        title="Claim the next 200 oldest unassigned recontact leads (30+ days old)"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Users className="h-4 w-4 mr-1" />
        )}
        Claim 200 leads
      </Button>

      <AlertDialog open={blockedOpen} onOpenChange={setBlockedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finish your current batch first</AlertDialogTitle>
            <AlertDialogDescription>
              You still have <strong>{pendingCount}</strong> lead{pendingCount === 1 ? '' : 's'} from
              your previous claim with <em>no note and no call log</em> since it was assigned to you.
              <br />
              <br />
              Please log a quick note or a call attempt on every lead in your current batch, then
              you can claim the next 200 with no restrictions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet — show my pending leads</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setBlockedOpen(false);
                runClaim(true);
              }}
            >
              Yes, all updated — claim next 200
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};


export default ClaimRecontactBatchButton;
