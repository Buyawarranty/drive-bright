import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Ban, MailX, CheckCircle } from 'lucide-react';
import { useEmailUnsubscribes } from '@/hooks/useEmailUnsubscribes';
interface EmailBlockButtonProps {
  email: string;
  customerName?: string;
  vehicleReg?: string;
  source?: string;
  variant?: 'button' | 'icon' | 'badge';
  size?: 'sm' | 'default';
}

export const EmailBlockButton: React.FC<EmailBlockButtonProps> = ({
  email,
  customerName,
  vehicleReg,
  source = 'manual',
  variant = 'button',
  size = 'sm',
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const { blockEmail, unblockEmail, isBlocked } = useEmailUnsubscribes();

  const blocked = isBlocked(email);

  const handleBlock = () => {
    blockEmail.mutate({
      email,
      reason: reason || 'Customer requested to stop receiving emails',
      source,
      customerName,
      vehicleReg,
    });
    setDialogOpen(false);
    setReason('');
  };

  const handleUnblock = () => {
    unblockEmail.mutate(email);
  };

  if (blocked) {
    if (variant === 'badge') {
      return (
        <Badge variant="destructive" className="cursor-pointer text-xs" onClick={handleUnblock}>
          <MailX className="h-3 w-3 mr-1" />
          Blocked
        </Badge>
      );
    }
    return (
      <Button
        variant="outline"
        size={size}
        className="text-green-600 border-green-200 hover:bg-green-50"
        onClick={handleUnblock}
      >
        <CheckCircle className="h-4 w-4 mr-1.5" />
        Re-subscribe
      </Button>
    );
  }

  return (
    <>
      {variant === 'badge' ? (
        <Badge 
          variant="outline" 
          className="cursor-pointer text-xs hover:bg-destructive hover:text-destructive-foreground transition-colors"
          onClick={() => setDialogOpen(true)}
        >
          <Ban className="h-3 w-3 mr-1" />
          Block Emails
        </Badge>
      ) : (
        <Button
          variant="outline"
          size={size}
          className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
          onClick={(e) => { e.stopPropagation(); setDialogOpen(true); }}
        >
          <MailX className="h-4 w-4 mr-1.5" />
          Block Emails
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MailX className="h-5 w-5 text-red-500" />
              Block Marketing Emails
            </DialogTitle>
            <DialogDescription>
              This will stop all marketing emails to this customer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="font-medium">{email}</p>
              {customerName && <p className="text-sm text-muted-foreground">{customerName}</p>}
              {vehicleReg && <p className="text-sm text-muted-foreground">Reg: {vehicleReg}</p>}
            </div>

            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                placeholder="e.g. Customer called and asked to stop receiving emails"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleBlock}
              disabled={blockEmail.isPending}
            >
              <MailX className="h-4 w-4 mr-1.5" />
              Block All Marketing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
