import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
 * Lets an agent atomically claim the next 200 oldest unassigned leads on the
 * Recontact Leads tab. Two agents can never receive the same lead (server-side
 * FOR UPDATE SKIP LOCKED). Shows a live counter of how many leads have had no
 * call log / quick note in the last 60 days ("actually available"), and
 * Whether an agent may self-assign, and whether they skip the pending-batch
 * block, is controlled by managers per agent on the Recontact access panel
 * (recontact_agent_caps.can_self_assign / skip_batch_check).
 */
const ClaimRecontactBatchButton: React.FC<ClaimRecontactBatchButtonProps> = ({ onClaimed }) => {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab');
  const [loading, setLoading] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [available, setAvailable] = useState<number | null>(null);
  const [poolTotal, setPoolTotal] = useState<number | null>(null);
  const [canSelfAssign, setCanSelfAssign] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('admin_users')
        .select('id, role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!data?.id) { setCanSelfAssign(false); return; }
      if (['admin', 'super_admin', 'sales_manager'].includes(data.role || '')) {
        setCanSelfAssign(true);
        return;
      }
      const { data: cap } = await (supabase as any)
        .from('recontact_agent_caps')
        .select('can_self_assign, blocked')
        .eq('admin_user_id', data.id)
        .maybeSingle();
      setCanSelfAssign(!!cap?.can_self_assign && !cap?.blocked);
    })();
  }, []);

  const loadCounter = useCallback(async () => {
    const { data, error } = await (supabase.rpc as any)('count_recontact_leads_available');
    if (error) {
      console.error('count_recontact_leads_available failed', error);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    setAvailable(row?.available_count ?? 0);
    setPoolTotal(row?.pool_total ?? 0);
  }, []);

  useEffect(() => {
    if (activeTab !== 'recontact-leads') return;
    loadCounter();
    const t = setInterval(loadCounter, 60_000);
    return () => clearInterval(t);
  }, [activeTab, loadCounter]);

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
      if (reason === 'self_assign_not_allowed') {
        toast.error('Self-assigning recontact leads is switched off for you', {
          description: 'Ask a manager to turn on "Self-assign" for you on the Recontact access panel.',
        });
        return;
      }
      if (reason === 'recontact_off') {
        toast.error('Your recontact access is currently off', {
          description: 'A manager can switch it back on from the Recontact access panel.',
        });
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
      loadCounter();
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
    <div className="flex items-center gap-2">
      {available !== null && (
        <Badge
          variant="secondary"
          className="bg-emerald-50 text-emerald-800 border border-emerald-200"
          title="Unassigned leads with no call log or note in the last 60 days"
        >
          {available.toLocaleString()} available
          {poolTotal !== null && poolTotal !== available && (
            <span className="opacity-70 ml-1">/ {poolTotal.toLocaleString()} pool</span>
          )}
        </Badge>
      )}
      <Button
        onClick={handleClaim}
        disabled={loading || canSelfAssign === false}
        size="sm"
        className="bg-purple-600 hover:bg-purple-700 text-white"
        title={canSelfAssign === false
          ? 'Self-assigning is switched off for you — ask a manager to enable it'
          : 'Claim the next 200 oldest unassigned recontact leads (30+ days old)'}
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
    </div>
  );
};


export default ClaimRecontactBatchButton;
