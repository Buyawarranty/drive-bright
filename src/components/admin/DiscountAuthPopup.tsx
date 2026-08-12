import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BadgePoundSterling, Check, X } from 'lucide-react';
import { useDiscountAuthRequests } from '@/hooks/useDiscountAuthRequests';
import { toast } from 'sonner';

/**
 * Manager pop-up for authorisation requests.
 *
 * Any admin screen that renders the dashboard shell gets this. When an agent
 * raises a below-minimum / over-ceiling price request (or a £5,000 cover
 * request), management see a modal straight away — with a chime from the hook —
 * and can authorise or decline without leaving the page they are on.
 * Dismissing shows the sticky top banner instead; a brand new request re-opens
 * the pop-up.
 */
export const DiscountAuthPopup: React.FC<{ userRole?: string | null }> = ({ userRole }) => {
  const { pending, isManagement, decide } = useDiscountAuthRequests(userRole);
  const [open, setOpen] = useState(false);
  const [noteFor, setNoteFor] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isManagement) return;
    const fresh = pending.filter((r) => !seenIds.current.has(r.id));
    if (fresh.length > 0) {
      fresh.forEach((r) => seenIds.current.add(r.id));
      setOpen(true);
    }
    if (pending.length === 0) setOpen(false);
  }, [pending, isManagement]);

  const handleDecide = async (id: string, status: 'approved' | 'declined') => {
    setBusy(id);
    try {
      await decide(id, status, noteFor[id]);
      toast[status === 'approved' ? 'success' : 'info'](
        status === 'approved' ? 'Authorised — the agent has been told' : 'Request declined',
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
      <DialogContent className="max-w-2xl border-2 border-amber-500">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-900">
            <BadgePoundSterling className="w-5 h-5" />
            {pending.length} authorisation {pending.length === 1 ? 'request' : 'requests'} waiting
          </DialogTitle>
          <DialogDescription>
            An agent needs your approval before they can take this sale. Approve or decline below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {pending.map((r) => (
            <div key={r.id} className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 space-y-2">
              <p className="text-sm font-bold">
                {r.request_type === 'claim_limit_5000' && (
                  <span className="mr-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                    £5,000 cover
                  </span>
                )}
                {r.registration_plate || 'No reg'}
                <span className="font-normal text-muted-foreground">
                  {r.mileage ? ` · ${r.mileage} miles` : ''}
                  {r.vehicle_description ? ` · ${r.vehicle_description}` : ''}
                </span>
              </p>
              {r.request_type === 'claim_limit_5000' ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">Wants to sell</span>{' '}
                  <strong className="text-amber-800">£5,000 per claim</strong>{' '}
                  <span className="text-muted-foreground">— quote</span>{' '}
                  <strong>£{Number(r.requested_price || r.base_price || 0).toFixed(0)}</strong>
                </p>
              ) : (
                <p className="text-sm">
                  <span className="text-muted-foreground">Normal</span>{' '}
                  <strong>£{Number(r.base_price || 0).toFixed(0)}</strong>{' '}
                  <span className="text-muted-foreground">→ wants</span>{' '}
                  <strong className="text-amber-800">£{Number(r.requested_price || 0).toFixed(0)}</strong>{' '}
                  {r.discount_pct != null && (
                    <span className="font-semibold text-amber-800">({Number(r.discount_pct).toFixed(0)}% off)</span>
                  )}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                <strong>{r.requested_by_name || 'Agent'}</strong>: {r.reason}
              </p>
              <Textarea
                rows={1}
                placeholder="Note (optional)"
                value={noteFor[r.id] || ''}
                onChange={(e) => setNoteFor((p) => ({ ...p, [r.id]: e.target.value }))}
                className="text-xs min-h-[38px] bg-background"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={busy === r.id}
                  onClick={() => handleDecide(r.id, 'approved')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold"
                >
                  <Check className="w-3.5 h-3.5 mr-1" /> Authorise
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === r.id}
                  onClick={() => handleDecide(r.id, 'declined')}
                  className="text-xs font-semibold"
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Decline
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button size="sm" variant="ghost" className="text-xs" onClick={() => setOpen(false)}>
            Decide later (stays in the top banner)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
