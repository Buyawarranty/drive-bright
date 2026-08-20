import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { LifeBuoy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface SaveCancellationCustomer {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  registration_plate?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  plan_type?: string | null;
  final_amount?: number | null;
}

interface SaveCancellationDialogProps {
  customer: SaveCancellationCustomer;
  /** Admin/super-admin id raising the request (from admin_users). */
  requestedBy?: string | null;
  onCreated?: () => void;
  buttonClassName?: string;
  buttonLabel?: string;
}

/**
 * Management-only action: push a cancelling customer back into New Leads as a
 * "save the deal" job. The lead is created UNASSIGNED so any agent can take
 * it, is flagged urgent so it sits at the top, and carries a cash reward
 * (default £15) for whoever saves it. It must be phoned, not emailed.
 */
export const SaveCancellationDialog: React.FC<SaveCancellationDialogProps> = ({
  customer,
  requestedBy,
  onCreated,
  buttonClassName,
  buttonLabel = 'Save this deal',
}) => {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reward, setReward] = useState('15');
  const [message, setMessage] = useState('');

  const nameParts = (customer.name || '').trim().split(/\s+/);
  const firstName = nameParts[0] || null;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

  const submit = async () => {
    if (!customer.email && !customer.phone) {
      toast.error('This customer has no phone or email — cannot raise a save lead.');
      return;
    }
    const rewardValue = Number(reward);
    if (!Number.isFinite(rewardValue) || rewardValue < 0) {
      toast.error('Enter a valid reward amount.');
      return;
    }

    setSubmitting(true);
    const reason = message.trim() || 'Customer wants to cancel — call and save the policy.';
    const noteLines = [
      `SAVE CANCELLATION — £${rewardValue} reward for saving this policy.`,
      'Phone the customer (do not email). First contact should be a call.',
      customer.registration_plate ? `Vehicle: ${customer.registration_plate.toUpperCase()}` : null,
      customer.plan_type ? `Plan: ${customer.plan_type}` : null,
      typeof customer.final_amount === 'number' ? `Paid: £${customer.final_amount}` : null,
      `Manager note: ${reason}`,
    ].filter(Boolean).join('\n');

    const { error } = await supabase.from('sales_leads').insert({
      first_name: firstName,
      last_name: lastName,
      email: customer.email || `no-email+${(customer.registration_plate || 'save').replace(/\s+/g, '')}@buyawarranty.co.uk`,
      phone: customer.phone || null,
      vehicle_reg: customer.registration_plate || null,
      vehicle_make: customer.vehicle_make || null,
      vehicle_model: customer.vehicle_model || null,
      lead_source: 'other',
      status: 'urgent_callback',
      priority: 'urgent',
      notes: noteLines,
      manual_entry: true,
      assigned_to: null,
      save_cancellation: true,
      save_reward_amount: rewardValue,
      save_reason: reason,
      save_requested_by: requestedBy || null,
      save_requested_at: new Date().toISOString(),
      save_source_customer_id: customer.id || null,
    } as any);

    setSubmitting(false);

    if (error) {
      toast.error(`Could not raise the save lead: ${error.message}`);
      return;
    }

    toast.success(`Save lead raised — £${rewardValue} reward. Any agent can take it in New Leads.`);
    setOpen(false);
    setMessage('');
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={buttonClassName || 'h-7 gap-1 border-amber-400 bg-amber-50 px-2 text-xs font-semibold text-amber-900 hover:bg-amber-100'}
        >
          <LifeBuoy className="h-3.5 w-3.5" />
          {buttonLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="h-4 w-4 text-amber-600" />
            Send to New Leads to save
          </DialogTitle>
          <DialogDescription>
            Creates an unassigned urgent lead in New Leads. Any agent can take it, and they must
            phone the customer to save the policy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-semibold">{customer.name || customer.email || 'Customer'}</p>
            <p className="text-xs text-muted-foreground">{customer.phone || 'No phone on record'}</p>
            {customer.registration_plate && (
              <p className="mt-1 font-mono text-xs uppercase">{customer.registration_plate}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="save-reward">Reward for saving (£)</Label>
            <Input
              id="save-reward"
              type="number"
              min={0}
              step={1}
              value={reward}
              onChange={(e) => setReward(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="save-message">Message to the sales floor</Label>
            <Textarea
              id="save-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Cancelling over price — offer a better labour rate and keep the cover."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} className="gap-1">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Send to New Leads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
