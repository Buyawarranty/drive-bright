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
import { useEmailUnsubscribes } from '@/hooks/useEmailUnsubscribes';
import { supabase } from '@/integrations/supabase/client';
import { MailX, Loader2 } from 'lucide-react';
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
      toast.error(e?.message || 'Could not unsubscribe');
    } finally {
      setBusy(false);
    }
  };

  if (!email) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        disabled={blocked}
        title={blocked
          ? 'Already unsubscribed from marketing emails'
          : 'Unsubscribe from marketing emails and mark as Not interested'}
        className="h-7 px-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
      >
        <MailX className="h-3.5 w-3.5" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsubscribe {email}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be removed from all marketing emails (including the £25 off reminders)
              {alreadyNotInterested ? '.' : ', and this lead will be set to "Not interested".'}
              {' '}You can re-subscribe them later from the Email preferences page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleConfirm(); }} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unsubscribe'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
