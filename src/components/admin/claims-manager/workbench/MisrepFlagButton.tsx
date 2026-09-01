import React, { useCallback, useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const MISREP_TAG = 'Misrepresentation – Do Not Cover';

/**
 * Loads the set of email addresses / registrations already carrying the
 * "Misrepresentation – Do Not Cover" label, so claim rows can show the flag state.
 */
export const useMisrepresentedIdentities = () => {
  const [emails, setEmails] = useState<Set<string>>(new Set());
  const [regs, setRegs] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const { data: tag } = await supabase
        .from('customer_tags')
        .select('id')
        .eq('name', MISREP_TAG)
        .maybeSingle();
      if (!tag?.id) return;

      const { data: assignments } = await supabase
        .from('customer_tag_assignments')
        .select('customer_id')
        .eq('tag_id', tag.id);
      const ids = (assignments || []).map((a: any) => a.customer_id).filter(Boolean);
      if (!ids.length) { setEmails(new Set()); setRegs(new Set()); return; }

      const { data: rows } = await supabase
        .from('customers')
        .select('email, registration_plate')
        .in('id', ids);

      setEmails(new Set((rows || []).map((r: any) => (r.email || '').trim().toLowerCase()).filter(Boolean)));
      setRegs(new Set((rows || []).map((r: any) => (r.registration_plate || '').replace(/\s+/g, '').toUpperCase()).filter(Boolean)));
    } catch (err) {
      console.error('useMisrepresentedIdentities', err);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isFlagged = useCallback((email?: string | null, reg?: string | null) => {
    const e = (email || '').trim().toLowerCase();
    const r = (reg || '').replace(/\s+/g, '').toUpperCase();
    return (!!e && emails.has(e)) || (!!r && regs.has(r));
  }, [emails, regs]);

  return { isFlagged, refetch: load };
};

interface Props {
  claimId: string;
  email?: string | null;
  reg?: string | null;
  flagged: boolean;
  onFlagged?: () => void | Promise<void>;
}

/**
 * Inline claim-row action: label the customer "Misrepresentation – Do Not Cover".
 * Excludes them from renewal leads/campaigns and blocks new cover purchases.
 */
export const MisrepFlagButton: React.FC<Props> = ({ claimId, email, reg, flagged, onFlagged }) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const flag = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('mark_claim_misrepresented', {
        p_claim_id: claimId,
        p_reason: reason.trim() || null,
      });
      if (error) throw error;
      toast({
        title: 'Marked as misrepresented',
        description: `Applied to ${data ?? 0} customer record(s). Excluded from renewals and blocked from buying cover again.`,
      });
      setReason('');
      setOpen(false);
      await onFlagged?.();
    } catch (err) {
      toast({
        title: 'Could not flag this customer',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Mark as misrepresented"
                className={cn(
                  'h-7 w-7 inline-flex items-center justify-center rounded-md border transition',
                  flagged
                    ? 'bg-red-100 border-red-300 text-red-700'
                    : 'bg-card border-border text-muted-foreground hover:bg-red-50 hover:text-red-600',
                )}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" align="center" className="max-w-xs">
            <p className="text-xs leading-relaxed">
              {flagged
                ? 'Customer is labelled Misrepresentation – Do Not Cover. They are excluded from renewals and blocked from buying cover again.'
                : 'Select when the customer misrepresented the vehicle’s condition (for example, a pre-existing fault). This applies Misrepresentation – Do Not Cover across all of their records, excludes them from renewals and blocks new cover.'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-80" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-2">
          <div className="text-sm font-semibold text-red-800">
            {flagged ? 'Already marked as misrepresented' : 'Mark as misrepresented'}
          </div>
          <p className="text-xs text-muted-foreground">
            Labels the customer <strong>Misrepresentation – Do Not Cover</strong> on every matching
            record, removes them from renewal leads and campaigns, and stops them buying cover again.
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Evidence and reason, e.g. fault present before cover started — confirmed by inspection report"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-red-700 hover:bg-red-800 text-white"
              onClick={flag}
              disabled={saving}
            >
              {saving ? 'Saving…' : flagged ? 'Re-apply label' : 'Mark misrepresented'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
