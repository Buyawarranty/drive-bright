import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserRoundCog, Check, X, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useLeadReassignRequests, type LeadReassignRequest } from '@/hooks/useLeadReassignRequests';

/**
 * Top-of-dashboard pop-up for admins / super admins when an agent asks for a
 * lead to be handed to a colleague. Approving here moves the lead; dismissing
 * leaves it pending in Lead allocation.
 */
export const ReassignRequestPopup: React.FC<{ userRole?: string | null }> = ({ userRole }) => {
  const { pending, agentName, isManagement, decide } = useLeadReassignRequests(userRole);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isManagement) return;
    const fresh = pending.filter((r) => !seen.current.has(r.id));
    if (fresh.length > 0) {
      fresh.forEach((r) => seen.current.add(r.id));
      setOpen(true);
    }
    if (pending.length === 0) setOpen(false);
  }, [pending, isManagement]);

  const handle = async (r: LeadReassignRequest, status: 'approved' | 'declined') => {
    setBusy(r.id);
    try {
      await decide(r, status, notes[r.id]);
      toast[status === 'approved' ? 'success' : 'info'](
        status === 'approved' ? `Lead moved to ${agentName(r.requested_to)}` : 'Request declined — lead unchanged',
      );
    } catch (e: any) {
      toast.error(e?.message || 'Could not save the decision');
    } finally {
      setBusy(null);
    }
  };

  if (!isManagement) return null;

  return (
    <Dialog open={open && pending.length > 0} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl border-2 border-indigo-500">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-900">
            <UserRoundCog className="w-5 h-5" />
            {pending.length} lead handover {pending.length === 1 ? 'request' : 'requests'} waiting
          </DialogTitle>
          <DialogDescription>
            An agent has asked for a lead to be passed to a colleague. The lead stays put until you approve.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {pending.map((r) => (
            <div key={r.id} className="rounded-md border border-border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{r.lead_label || 'Lead'}</span>
                {r.lead_reg && <Badge variant="outline">{r.lead_reg}</Badge>}
                <span className="text-muted-foreground">
                  {agentName(r.current_owner_id)} <ArrowRight className="inline h-3.5 w-3.5" />{' '}
                  {agentName(r.requested_to)}
                </span>
              </div>
              <p className="text-sm italic text-foreground/80">“{r.reason}”</p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={notes[r.id] || ''}
                  onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))}
                  placeholder="Note (optional)"
                  className="max-w-xs h-9"
                />
                <Button size="sm" onClick={() => handle(r, 'approved')} disabled={busy === r.id} className="gap-1">
                  <Check className="h-4 w-4" /> Approve & move
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handle(r, 'declined')}
                  disabled={busy === r.id}
                  className="gap-1"
                >
                  <X className="h-4 w-4" /> Decline
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReassignRequestPopup;
