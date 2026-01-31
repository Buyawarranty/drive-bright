import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RequestCallbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RequestCallbackModal: React.FC<RequestCallbackModalProps> = ({ isOpen, onClose }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [touched, setTouched] = useState(false);

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    // Limit to 11 digits for UK numbers
    return digits.slice(0, 11);
  };

  const validatePhone = (phone: string) => {
    // UK mobile: starts with 07, 11 digits
    // UK landline: starts with 01/02/03, 10-11 digits
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10 || cleaned.length > 11) {
      return false;
    }
    if (cleaned.startsWith('07') && cleaned.length === 11) return true;
    if (cleaned.startsWith('01') || cleaned.startsWith('02') || cleaned.startsWith('03')) return true;
    return false;
  };

  const handlePhoneBlur = () => {
    setTouched(true);
    if (phoneNumber.trim() && !validatePhone(phoneNumber)) {
      setPhoneError('Please enter a valid UK phone number (e.g., 07123 456789)');
    } else {
      setPhoneError('');
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = formatPhoneNumber(e.target.value);
    setPhoneNumber(value);
    if (touched && phoneError) {
      if (validatePhone(value)) {
        setPhoneError('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    if (!phoneNumber.trim()) {
      setPhoneError('Please enter your phone number');
      return;
    }

    if (!validatePhone(phoneNumber)) {
      setPhoneError('Please enter a valid UK phone number (e.g., 07123 456789)');
      return;
    }

    setIsSubmitting(true);
    setPhoneError('');

    try {
      // Create a lead in abandoned_carts as urgent callback
      const { error: insertError } = await supabase
        .from('abandoned_carts')
        .insert({
          email: `callback_${Date.now()}@callback.temp`,
          phone: phoneNumber,
          full_name: 'Callback Request',
          step_abandoned: 0,
          contact_status: 'new',
          contact_notes: `[${new Date().toLocaleDateString('en-GB')} - System] Urgent callback requested via navigation menu`,
          cart_metadata: {
            source: 'navigation_callback',
            priority: 'urgent',
            request_type: 'urgent_callback'
          }
        });

      if (insertError) throw insertError;

      setIsSuccess(true);
      toast.success('Callback request submitted! We\'ll call you shortly.');
      
      // Reset after 2 seconds and close
      setTimeout(() => {
        setIsSuccess(false);
        setPhoneNumber('');
        setTouched(false);
        onClose();
      }, 2000);

    } catch (err) {
      console.error('Error submitting callback request:', err);
      toast.error('Failed to submit request. Please try again or call us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setPhoneNumber('');
      setPhoneError('');
      setTouched(false);
      setIsSuccess(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Phone className="h-5 w-5 text-brand-orange" />
            Request a Call Back
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Enter your number and we'll call you back shortly.
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Request Received!</h3>
            <p className="text-muted-foreground">We'll call you back as soon as possible.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">
                Your Phone Number <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="07123 456789"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  onBlur={handlePhoneBlur}
                  className={`pl-10 h-12 text-lg ${phoneError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  autoComplete="tel"
                  disabled={isSubmitting}
                />
              </div>
              {phoneError && (
                <p className="text-sm text-red-500">{phoneError}</p>
              )}
            </div>

            {/* Info box */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                📞 We typically call back within 15 minutes during business hours (Mon-Fri 9am-5:30pm).
              </p>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !phoneNumber}
              className="w-full h-12 bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold text-base"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Request Call Back
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Or call us now on{' '}
              <a href="tel:08004947477" className="text-brand-orange font-medium hover:underline">
                0800 494 7477
              </a>
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RequestCallbackModal;
