import React, { useState } from 'react';
import { ChevronDown, Mail } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import PartsListContent from './PartsListContent';

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
  variant?: 'desktop' | 'mobile';
  vehicleData: VehicleData;
  selectedPlan: SelectedPlan;
}

const SeeWhatsIncludedCard: React.FC<Props> = ({ variant = 'desktop', vehicleData, selectedPlan }) => {
  const isMobile = variant === 'mobile';
  const [dialogOpen, setDialogOpen] = useState(false);
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
      setDialogOpen(false);
      setEmail('');
    } catch (err) {
      console.error('send-quote-email error', err);
      toast.error('Failed to send quote. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={isMobile ? 'flex items-center gap-2 flex-wrap' : 'flex items-center gap-3 flex-wrap'}>
      <Collapsible className="group/inc flex-1 min-w-[180px]">
        <CollapsibleTrigger
          className={
            isMobile
              ? 'w-full flex items-center justify-between gap-2 bg-card border border-border rounded-lg px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors'
              : 'w-full flex items-center justify-between gap-2 bg-card border border-border rounded-lg px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted transition-colors'
          }
        >
          <span>See what's included</span>
          <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]/inc:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className={isMobile ? 'mt-3' : 'mt-4'}>
            <PartsListContent />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className={
          isMobile
            ? 'inline-flex items-center gap-1.5 text-primary hover:text-primary/80 font-semibold text-sm underline underline-offset-2'
            : 'inline-flex items-center gap-1.5 text-primary hover:text-primary/80 font-semibold text-sm underline underline-offset-2 whitespace-nowrap'
        }
      >
        <Mail className="w-4 h-4" />
        Email me this quote
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? 'Sending…' : 'Send quote'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SeeWhatsIncludedCard;
