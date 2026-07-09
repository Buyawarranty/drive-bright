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

  const handleClaim = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase.rpc as any)('claim_recontact_leads_batch', {
        _batch_size: 100,
      });
      if (error) throw error;

      // Function returns a table; supabase-js returns it as an array of rows.
      const row = Array.isArray(data) ? data[0] : data;
      const reason: string | null = row?.blocked_reason ?? null;
      const claimed: number = row?.claimed_count ?? 0;
      const pending: number = row?.pending_count ?? 0;

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
        toast.info('No unassigned leads available right now');
        return;
      }
      toast.success(`Claimed ${claimed} lead${claimed === 1 ? '' : 's'} — oldest first`);
      onClaimed?.();
    } catch (err: any) {
      console.error('claim_recontact_leads_batch failed', err);
      toast.error(err?.message || 'Failed to claim leads');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleClaim}
        disabled={loading}
        size="sm"
        className="bg-purple-600 hover:bg-purple-700 text-white"
        title="Claim the next 100 oldest unassigned recontact leads"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <Users className="h-4 w-4 mr-1" />
        )}
        Claim 100 leads
      </Button>

      <AlertDialog open={blockedOpen} onOpenChange={setBlockedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finish your current batch first</AlertDialogTitle>
            <AlertDialogDescription>
              You still have <strong>{pendingCount}</strong> lead{pendingCount === 1 ? '' : 's'} from
              your previous claim that haven't had a status update yet. Work through those (mark them
              contacted, quoted, lost, etc.) and then you'll be able to claim the next 100.
              <br />
              <br />
              This stops leads sitting unworked while you pile up more.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setBlockedOpen(false);
                onClaimed?.();
              }}
            >
              Show my pending leads
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ClaimRecontactBatchButton;
