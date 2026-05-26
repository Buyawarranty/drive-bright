import React, { useState } from 'react';
import { Check, ListChecks, ShieldCheck, Mail } from 'lucide-react';
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

const BULLETS = [
  'Comprehensive mechanical & electrical cover',
  'Labour costs included',
  'Unlimited claims on most plans',
  'Fast claims & direct garage payments',
  'Nationwide repair network',
  '14-day cooling-off period',
];

const SeeWhatsIncludedCard: React.FC<Props> = ({ variant = 'desktop', vehicleData, selectedPlan }) => {
  const isMobile = variant === 'mobile';
  const [coveredOpen, setCoveredOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
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
      setEmailOpen(false);
      setEmail('');
    } catch (err) {
      console.error('send-quote-email error', err);
      toast.error('Failed to send quote. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={
        // Soft sage-tinted card matching trust/insurance palette
        'rounded-xl border border-[#D8E9DD] bg-[#F6FBF8] ' +
        (isMobile ? 'p-4' : 'p-5')
      }
    >
      <ul
        className={
          'grid gap-x-5 gap-y-2 ' +
          (isMobile ? 'grid-cols-1' : 'grid-cols-2')
        }
      >
        {BULLETS.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <Check
              className={
                (isMobile ? 'w-4 h-4 ' : 'w-4 h-4 ') +
                'text-[#3F8A5C] flex-shrink-0 mt-0.5'
              }
              strokeWidth={2.5}
            />
            <span className={(isMobile ? 'text-sm ' : 'text-sm ') + 'text-foreground leading-snug'}>
              {b}
            </span>
          </li>
        ))}
      </ul>

      <div className={'mt-4 flex flex-wrap items-center gap-2 ' + (isMobile ? '' : 'gap-3')}>
        <button
          type="button"
          onClick={() => setCoveredOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8E9DD] bg-white hover:bg-[#F3FAF5] text-foreground text-sm font-semibold px-3.5 py-2 transition-colors"
        >
          <ShieldCheck className="w-4 h-4 text-[#3F8A5C]" />
          View what's covered
        </button>


        <button
          type="button"
          onClick={() => setEmailOpen(true)}
          className="ml-auto inline-flex items-center gap-1.5 text-primary hover:text-primary/80 font-semibold text-sm underline underline-offset-2"
        >
          <Mail className="w-4 h-4" />
          Email quote
        </button>
      </div>

      {/* "What's covered" overlay — original colourful vehicle-type accordion */}
      <Dialog open={coveredOpen} onOpenChange={setCoveredOpen}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>What's covered</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <PartsListContent />
          </div>
        </DialogContent>
      </Dialog>

      {/* Email quote dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
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
            <Button variant="outline" onClick={() => setEmailOpen(false)} disabled={sending}>
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
