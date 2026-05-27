import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface VehicleData {
  regNumber: string;
  make?: string;
  model?: string;
  year?: string;
  mileage?: string;
  fuelType?: string;
  vehicleType?: string;
  transmission?: string;
  firstName?: string;
  lastName?: string;
}

interface SelectedPlan {
  monthlyPrice: number;
  paymentType: '12months' | '24months' | '36months' | null;
  claimLimit: number | null;
  labourRate: number;
  voluntaryExcess: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleData: VehicleData;
  selectedPlan: SelectedPlan;
}

const EmailQuoteDialog: React.FC<Props> = ({ open, onOpenChange, vehicleData, selectedPlan }) => {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (!selectedPlan.paymentType) {
      toast.error('Please choose a cover length first');
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-quote-email', {
        body: {
          email,
          firstName: vehicleData.firstName,
          lastName: vehicleData.lastName,
          vehicleData: {
            regNumber: vehicleData.regNumber,
            make: vehicleData.make,
            model: vehicleData.model,
            year: vehicleData.year,
            mileage: vehicleData.mileage,
            fuelType: vehicleData.fuelType,
            transmission: vehicleData.transmission,
            vehicleType: vehicleData.vehicleType,
          },
          selectedPlan: {
            name: 'Platinum Complete Plan',
            price: selectedPlan.monthlyPrice,
            paymentType: selectedPlan.paymentType,
            claimLimit: selectedPlan.claimLimit,
            labourRate: selectedPlan.labourRate,
            voluntaryExcess: selectedPlan.voluntaryExcess,
          },
        },
      });
      if (error) throw error;
      toast.success('Quote emailed — check your inbox.');
      onOpenChange(false);
      setEmail('');
    } catch (err) {
      console.error('send-quote-email error', err);
      toast.error('Failed to send quote. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Email me this quote</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label htmlFor="quote-email">Email address</Label>
          <Input
            id="quote-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            We'll send a copy of your quote so you can come back to it anytime.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? 'Sending…' : 'Send quote'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmailQuoteDialog;
