import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserRoundCog, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useLeadReassignRequests } from '@/hooks/useLeadReassignRequests';

interface Props {
  leadId: string;
  leadLabel?: string | null;
  leadReg?: string | null;
  currentOwnerId?: string | null;
  currentOwnerName?: string | null;
  userRole?: string | null;
  className?: string;
}

/**
 * "Request handover" — an agent asks for a lead to be moved to a colleague.
 *
 * The lead does not move here. It goes to Lead allocation as a pending request
 * for a manager to authorise, which is what keeps rotation fairness, caps and
 * sale credit honest.
 */
export const RequestReassignDialog: React.FC<Props> = ({
  leadId,
  leadLabel,
  leadReg,
  currentOwnerId,
  currentOwnerName,
  userRole,
  className,
}) => {
  const { agents, currentAdminId, hasPendingForLead, requestHandover } = useLeadReassignRequests(userRole);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const alreadyPending = hasPendingForLead(leadId);

  const submit = async () => {
    if (!target) {
      toast.error('Pick the colleague who should take this lead');
      return;
    }
    if (reason.trim().length < 5) {
      toast.error('Add a short reason so the manager can decide');
      return;
    }
    setBusy(true);
    try {
      await requestHandover({
        leadId,
        requestedTo: target,
        reason: reason.trim(),
        leadLabel,
        leadReg,
        currentOwnerId: currentOwnerId || null,
      });
      toast.success('Handover requested — a manager will authorise it');
      setOpen(false);
      setTarget('');
      setReason('');
    } catch (e: any) {
      toast.error(e?.message || 'Could not send the request');
    } finally {
      setBusy(false);
    }
  };

  if (alreadyPending) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-amber-800 ${className || ''}`}>
        <Clock className="h-3.5 w-3.5" />
        Handover requested — waiting for a manager
      </span>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className={`gap-1.5 ${className || ''}`}>
          <UserRoundCog className="h-3.5 w-3.5" />
          Request handover
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request a lead handover</DialogTitle>
          <DialogDescription>
            A manager authorises this from Lead allocation. The lead stays with
            {currentOwnerName ? ` ${currentOwnerName}` : ' its current owner'} until they approve.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {(leadLabel || leadReg) && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="font-medium">{leadLabel || 'Lead'}</span>
              {leadReg ? <span className="text-muted-foreground"> · {leadReg}</span> : null}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Move it to</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a colleague" />
              </SelectTrigger>
              <SelectContent>
                {agents
                  .filter((a) => a.id !== currentOwnerId)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      {a.id === currentAdminId ? ' (me)' : ''}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Why does it need to move?</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer asked for Thomas — he sold them their last policy"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? 'Sending…' : 'Send request'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RequestReassignDialog;
