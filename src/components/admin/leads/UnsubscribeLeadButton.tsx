import { useState } from 'react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useEmailUnsubscribes } from '@/hooks/useEmailUnsubscribes';
import { supabase } from '@/integrations/supabase/client';
import { MailX, MailCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  email: string;
  customerName?: string | null;
  vehicleReg?: string | null;
  /** Sets the lead status to "Not interested" at the same time */
  onMarkNotInterested?: () => void;
  alreadyNotInterested?: boolean;
}

/**
 * One-click manager action: unsubscribes the person from all marketing email
 * and marks the lead as "Not interested" in the same step.
 * If they are already unsubscribed, the same button re-subscribes them.
 */
export function UnsubscribeLeadButton({
  email,
  customerName,
  vehicleReg,
  onMarkNotInterested,
  alreadyNotInterested = false,
}: Props) {
  const { setFrequency, isBlocked } = useEmailUnsubscribes();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const blocked = email ? isBlocked(email) : false;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let adminName: string | null = null;
      let adminId: string | null = null;
      if (user) {
        const { data: adminRow } = await supabase
          .from('admin_users')
          .select('id, first_name, last_name, email')
          .eq('user_id', user.id)
          .maybeSingle();
        adminId = adminRow?.id || null;
        adminName = [adminRow?.first_name, adminRow?.last_name].filter(Boolean).join(' ')
          || adminRow?.email || user.email || null;
      }

      if (blocked) {
        // Toggle back on — puts them back on all marketing emails.
        await setFrequency.mutateAsync({
          email,
          frequency: 'all',
          reason: 'Re-subscribed by staff from Leads',
          source: 'leads_unsubscribe',
          customerName: customerName || undefined,
          vehicleReg: vehicleReg || undefined,
          unsubscribedBy: adminId || undefined,
          unsubscribedByName: adminName || undefined,
        });
        setOpen(false);
        return;
      }

      await setFrequency.mutateAsync({
        email,
        frequency: 'off',
        reason: 'Not interested — unsubscribed by staff from Leads',
        source: 'leads_unsubscribe',
        customerName: customerName || undefined,
        vehicleReg: vehicleReg || undefined,
        unsubscribedBy: adminId || undefined,
        unsubscribedByName: adminName || undefined,
      });

      if (!alreadyNotInterested) onMarkNotInterested?.();
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Could not update email preference');
    } finally {
      setBusy(false);
    }
  };

  if (!email) return null;

  const tooltipText = blocked
    ? `Unsubscribed from marketing emails — click to put ${email} back on the list`
    : `Unsubscribe ${email} from marketing emails and mark as Not interested`;

  return (
    <>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={blocked ? 'Re-subscribe to marketing emails' : 'Unsubscribe from marketing emails'}
              onClick={(e) => { e.stopPropagation(); setOpen(true); }}
              className={
                blocked
                  ? 'h-7 px-1.5 text-emerald-600 hover:bg-emerald-50'
                  : 'h-7 px-1.5 text-rose-600 hover:bg-rose-50'
              }
            >
              {blocked ? <MailCheck className="h-3.5 w-3.5" /> : <MailX className="h-3.5 w-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px] text-xs">
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {blocked ? `Re-subscribe ${email}?` : `Unsubscribe ${email}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blocked ? (
                <>They will start receiving our marketing emails again, including renewal offers and discounts.</>
              ) : (
                <>
                  They will be removed from all marketing emails (including the £25 off reminders)
                  {alreadyNotInterested ? '.' : ', and this lead will be set to "Not interested".'}
                  {' '}You can re-subscribe them later from this same button or the Unsubscribe page.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleConfirm(); }} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : blocked ? 'Re-subscribe' : 'Unsubscribe'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
