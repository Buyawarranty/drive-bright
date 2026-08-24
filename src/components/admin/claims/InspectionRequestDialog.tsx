import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search } from 'lucide-react';

interface Props {
  claimId: string;
  defaultEmail?: string;
  customerName?: string;
  registration?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}

const INSPECTION_FEE = 140;

export const InspectionRequestDialog: React.FC<Props> = ({
  claimId,
  defaultEmail,
  customerName,
  registration,
  open,
  onOpenChange,
  onSent,
}) => {
  const { toast } = useToast();
  const [email, setEmail] = useState(defaultEmail || '');
  const [company, setCompany] = useState<'ACE' | 'Scotia'>('ACE');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  React.useEffect(() => {
    if (open) setEmail(defaultEmail || '');
  }, [open, defaultEmail]);

  const send = async () => {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      toast({ title: 'Enter a valid email address', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-inspection-request', {
        body: {
          claimId,
          recipientEmail: clean,
          inspectionCompany: company,
          feeAmount: INSPECTION_FEE,
          note: note.trim(),
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Inspection request sent', description: `Emailed to ${clean} · ${company} · £${INSPECTION_FEE}` });
      setNote('');
      onOpenChange(false);
      onSent?.();
    } catch (err: any) {
      toast({ title: 'Could not send request', description: err?.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" /> Request independent inspection
          </DialogTitle>
          <DialogDescription>
            Sends the customer a secure link to confirm where the vehicle is and pay the £{INSPECTION_FEE} inspection fee.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="font-medium text-foreground">
              {customerName || 'Customer'}
              {registration ? ` · ${registration.toUpperCase()}` : ''}
            </div>
            <div className="text-muted-foreground text-xs mt-1">
              The customer is told the inspection takes 7–14 working days on average and that the engineer's decision is
              full and final.
            </div>
          </div>

          <div>
            <Label htmlFor="insp-email">Send to</Label>
            <Input id="insp-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Inspection company</Label>
              <Select value={company} onValueChange={(v) => setCompany(v as 'ACE' | 'Scotia')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACE">ACE</SelectItem>
                  <SelectItem value="Scotia">Scotia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Inspection fee</Label>
              <Input value={`£${INSPECTION_FEE}.00`} readOnly className="bg-muted" />
            </div>
          </div>

          <div>
            <Label htmlFor="insp-note">Message to the customer (optional)</Label>
            <Textarea
              id="insp-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything specific you want them to know or confirm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={send} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send inspection link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
