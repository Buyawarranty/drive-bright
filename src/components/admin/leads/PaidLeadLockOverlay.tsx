import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Lock, Clock, CheckCircle } from 'lucide-react';

interface PaidLeadLockOverlayProps {
  hasPendingRequest: boolean;
  hasApprovedAccess: boolean;
  onRequestAccess: (reason: string) => void;
  isRequesting?: boolean;
}

export const PaidLeadLockOverlay: React.FC<PaidLeadLockOverlayProps> = ({
  hasPendingRequest,
  hasApprovedAccess,
  onRequestAccess,
  isRequesting = false,
}) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (hasApprovedAccess) return null;

  if (hasPendingRequest) {
    return (
      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300 flex items-center gap-1 whitespace-nowrap">
        <Clock className="h-3 w-3" />
        Awaiting Approval
      </Badge>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[10px] gap-1 border-red-300 text-red-700 hover:bg-red-50"
        >
          <Lock className="h-3 w-3" />
          Locked — Request Access
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-red-500" />
            Request Access to Paid Lead
          </DialogTitle>
          <DialogDescription>
            This customer has already paid. To prevent duplicate contact, admin approval is required before you can interact with this lead.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            placeholder="Explain why you need access to this lead (e.g., customer called back with a query, need to upsell, etc.)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              onRequestAccess(reason || 'No reason provided');
              setOpen(false);
              setReason('');
            }}
            disabled={isRequesting}
            className="bg-primary"
          >
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
