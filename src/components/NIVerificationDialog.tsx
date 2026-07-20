import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, ShieldAlert } from 'lucide-react';

interface NIVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regNumber: string;
  mileage?: string;
  defaultEmail?: string;
  defaultPhone?: string;
}

export const NIVerificationDialog: React.FC<NIVerificationDialogProps> = ({
  open,
  onOpenChange,
  regNumber,
  mileage,
  defaultEmail,
  defaultPhone,
}) => {
  const { toast } = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(defaultEmail || '');
  const [phone, setPhone] = useState(defaultPhone || '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !phone) {
      toast({ title: 'Please add your email and phone', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-ni-verification-lead', {
        body: {
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          vehicle_reg: regNumber,
          mileage,
          notes,
        },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || 'Submission failed');
      }
      setDone(true);
    } catch (err: any) {
      toast({
        title: 'Could not submit',
        description: err?.message || 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {done ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
            <DialogTitle>Thanks — we've got your details</DialogTitle>
            <DialogDescription>
              Your Northern Ireland registration <strong>{regNumber}</strong> needs a manual check. 
              A member of our team will call you back shortly with a quote.
            </DialogDescription>
            <Button onClick={() => onOpenChange(false)} className="mt-2">Close</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <DialogTitle>We'll get back to you with a quote</DialogTitle>
                  <DialogDescription className="mt-2">
                    <strong>{regNumber}</strong> looks like a Northern Ireland plate. Our online
                    system can't verify NI vehicles automatically, so leave your details below and
                    a member of our team will get back to you shortly.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="ni-first">First name</Label>
                  <Input id="ni-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={100} />
                </div>
                <div>
                  <Label htmlFor="ni-last">Last name</Label>
                  <Input id="ni-last" value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={100} />
                </div>
              </div>
              <div>
                <Label htmlFor="ni-email">Email *</Label>
                <Input id="ni-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
              </div>
              <div>
                <Label htmlFor="ni-phone">Phone *</Label>
                <Input id="ni-phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
              </div>
              <div>
                <Label htmlFor="ni-notes">Vehicle make / model (if known)</Label>
                <Textarea id="ni-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} placeholder="e.g. 2020 Ford Focus 1.5 diesel" />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Sending…' : 'Request a call back'}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NIVerificationDialog;
