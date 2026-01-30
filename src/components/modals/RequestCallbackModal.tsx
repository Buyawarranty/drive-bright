import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RequestCallbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RequestCallbackModal: React.FC<RequestCallbackModalProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  // UK phone validation - supports various formats
  const validateUKPhone = (phoneNumber: string): boolean => {
    // Remove all spaces and dashes
    const cleaned = phoneNumber.replace(/[\s\-]/g, '');
    
    // UK phone patterns:
    // 07xxx xxxxxx (mobile)
    // 01xxx xxxxxx or 02xxx xxxxxx (landline)
    // +44 7xxx xxxxxx
    const ukMobilePattern = /^(07\d{9}|(\+44|0044)7\d{9})$/;
    const ukLandlinePattern = /^(0[1-9]\d{8,9}|(\+44|0044)[1-9]\d{8,9})$/;
    
    return ukMobilePattern.test(cleaned) || ukLandlinePattern.test(cleaned);
  };

  const formatPhoneForDisplay = (value: string): string => {
    // Just clean and format for display
    const cleaned = value.replace(/[^\d+]/g, '');
    return cleaned;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPhone(formatPhoneForDisplay(value));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }
    
    if (!validateUKPhone(phone)) {
      setError('Please enter a valid UK phone number');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      // Insert into abandoned_carts as "Urgent Callback" lead
      const { error: insertError } = await supabase
        .from('abandoned_carts')
        .insert({
          phone: phone.trim(),
          email: '', // Email left blank as per requirements
          step_abandoned: 0, // Special step for callback requests
          contact_status: 'urgent_callback',
          contact_notes: 'Urgent Callback - Requested from homepage',
          full_name: 'Callback Request',
        });
      
      if (insertError) {
        throw insertError;
      }
      
      setIsSuccess(true);
      toast({
        title: "Request received!",
        description: "We'll call you back as soon as possible.",
      });
      
      // Reset after 3 seconds and close
      setTimeout(() => {
        setIsSuccess(false);
        setPhone('');
        onClose();
      }, 3000);
      
    } catch (err) {
      console.error('Error submitting callback request:', err);
      toast({
        title: "Something went wrong",
        description: "Please try again or call us directly on 0800 494 7477",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setPhone('');
      setError('');
      setIsSuccess(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="w-[90vw] max-w-md mx-auto bg-white rounded-xl p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Phone className="w-6 h-6 text-brand-green" />
            Request a call-back
          </DialogTitle>
          <DialogDescription className="text-gray-600 text-sm sm:text-base mt-2">
            We'll give you a quick call to help with your vehicle or customise your warranty.
            <br />
            <span className="font-medium">Just enter your phone number — we'll do the rest.</span>
          </DialogDescription>
        </DialogHeader>
        
        {isSuccess ? (
          <div className="py-8 text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-brand-green mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">Request received!</h3>
              <p className="text-gray-600">We'll get back to you as soon as possible.</p>
              <p className="text-sm text-brand-orange font-medium">Your request has been marked as urgent.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="callback-phone" className="text-sm font-medium text-gray-700">
                Phone number
              </label>
              <div className="relative">
                <Input
                  id="callback-phone"
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="07xxx xxxxxx"
                  className={`h-12 text-lg pl-4 pr-4 ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'}`}
                  disabled={isSubmitting}
                  autoComplete="tel"
                />
              </div>
              {error && (
                <p className="text-sm text-red-500 font-medium">{error}</p>
              )}
            </div>
            
            <Button
              type="submit"
              disabled={isSubmitting || !phone.trim()}
              className="w-full h-12 bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold text-base rounded-lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Call me back'
              )}
            </Button>
            
            <div className="text-center space-y-2 pt-2">
              <p className="text-sm text-gray-600">
                We'll get back to you as soon as possible.
              </p>
              <p className="text-sm text-brand-orange font-medium">
                Your request will be marked as urgent.
              </p>
            </div>
            
            <p className="text-xs text-gray-500 text-center pt-2 border-t border-gray-100">
              No email required. We only use your number to return your call.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RequestCallbackModal;
