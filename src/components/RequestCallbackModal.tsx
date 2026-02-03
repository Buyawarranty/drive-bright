import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, ArrowRight, CheckCircle, Loader2, Check, PartyPopper, Sparkles } from 'lucide-react';
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

  // Comprehensive UK phone validation (mobile + landline)
  const validatePhone = (phone: string): { isValid: boolean; type: 'mobile' | 'landline' | null } => {
    const cleaned = phone.replace(/\D/g, '');
    
    // UK Mobile: starts with 07, exactly 11 digits
    if (cleaned.startsWith('07') && cleaned.length === 11) {
      return { isValid: true, type: 'mobile' };
    }
    
    // UK Landline: starts with 01, 02, or 03
    // 01/02 numbers: typically 10-11 digits
    // 03 numbers (non-geographic): 11 digits
    if (cleaned.startsWith('01') || cleaned.startsWith('02')) {
      if (cleaned.length >= 10 && cleaned.length <= 11) {
        return { isValid: true, type: 'landline' };
      }
    }
    
    if (cleaned.startsWith('03') && cleaned.length === 11) {
      return { isValid: true, type: 'landline' };
    }
    
    return { isValid: false, type: null };
  };

  // Memoized validation state for real-time green tick
  const phoneValidation = useMemo(() => {
    if (!phoneNumber.trim()) return { isValid: false, type: null };
    return validatePhone(phoneNumber);
  }, [phoneNumber]);

  const isPhoneValid = phoneValidation.isValid;

  const handlePhoneBlur = () => {
    setTouched(true);
    if (phoneNumber.trim() && !isPhoneValid) {
      setPhoneError('Please enter a valid UK phone number (e.g., 07123 456789 or 0121 234 5678)');
    } else {
      setPhoneError('');
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = formatPhoneNumber(e.target.value);
    setPhoneNumber(value);
    // Clear error immediately when phone becomes valid
    if (touched && phoneError && validatePhone(value).isValid) {
      setPhoneError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    if (!phoneNumber.trim()) {
      setPhoneError('Please enter your phone number');
      return;
    }

    if (!isPhoneValid) {
      setPhoneError('Please enter a valid UK phone number (e.g., 07123 456789 or 0121 234 5678)');
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
            request_type: 'urgent_callback',
            phone_type: phoneValidation.type
          }
        });

      if (insertError) throw insertError;

      setIsSuccess(true);
      toast.success('Callback request submitted! We\'ll call you shortly.');
      
      // Reset after 3.5 seconds and close (longer to let user read message)
      setTimeout(() => {
        setIsSuccess(false);
        setPhoneNumber('');
        setTouched(false);
        onClose();
      }, 3500);

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
          <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in-50 zoom-in-95 duration-300">
            {/* Celebration icon with animation */}
            <div className="relative mb-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center shadow-lg">
                <PartyPopper className="h-10 w-10 text-green-600 animate-bounce" />
              </div>
              <Sparkles className="absolute -top-1 -right-1 h-6 w-6 text-yellow-500 animate-pulse" />
              <Sparkles className="absolute -bottom-1 -left-1 h-5 w-5 text-yellow-400 animate-pulse delay-150" />
            </div>
            
            <h3 className="text-2xl font-bold text-foreground mb-2">
              Thank You! 🎉
            </h3>
            <p className="text-lg font-medium text-green-600 mb-3">
              Your request has been received!
            </p>
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 max-w-xs">
              <p className="text-sm text-green-800 leading-relaxed">
                <span className="font-semibold">One of our friendly experts</span> will call you back shortly to help you find the perfect warranty for your vehicle.
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              Typically within 15 minutes during business hours
            </p>
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
                  className={`pl-10 pr-10 h-12 text-lg transition-all duration-200 ${
                    phoneError 
                      ? 'border-red-500 focus-visible:ring-red-500' 
                      : isPhoneValid 
                        ? 'border-green-500 focus-visible:ring-green-500 bg-green-50/50' 
                        : ''
                  }`}
                  autoComplete="tel"
                  disabled={isSubmitting}
                />
                {/* Green tick indicator when valid */}
                {isPhoneValid && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-in fade-in-50 zoom-in-95 duration-200">
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" strokeWidth={3} />
                    </div>
                  </div>
                )}
              </div>
              {phoneError && (
                <p className="text-sm text-red-500 animate-in fade-in-50 duration-200">{phoneError}</p>
              )}
              {/* Valid phone type indicator */}
              {isPhoneValid && !phoneError && (
                <p className="text-sm text-green-600 flex items-center gap-1 animate-in fade-in-50 duration-200">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Valid UK {phoneValidation.type === 'mobile' ? 'mobile' : 'landline'} number
                </p>
              )}
            </div>

            {/* Enticing info box */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-900 mb-1">
                    We're here to help! 💪
                  </p>
                  <p className="text-sm text-amber-800">
                    Our warranty experts typically call back within <span className="font-semibold">15 minutes</span> during business hours (Mon-Fri 9am-5:30pm).
                  </p>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || !phoneNumber}
              className="w-full h-12 bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold text-base shadow-lg hover:shadow-xl transition-all duration-200"
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
              <a href="tel:03302295040" className="text-brand-orange font-medium hover:underline">
                0330 229 5040
              </a>
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RequestCallbackModal;
