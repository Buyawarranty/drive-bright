import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, Loader2, CheckCircle, Sparkles } from 'lucide-react';
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
  const [isFocused, setIsFocused] = useState(false);

  // Comprehensive UK phone validation (mobile + landline)
  const validateUKPhone = (phoneNumber: string): { isValid: boolean; type: 'mobile' | 'landline' | null } => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.startsWith('07') && cleaned.length === 11) {
      return { isValid: true, type: 'mobile' };
    }
    if ((cleaned.startsWith('01') || cleaned.startsWith('02')) && cleaned.length >= 10 && cleaned.length <= 11) {
      return { isValid: true, type: 'landline' };
    }
    if (cleaned.startsWith('03') && cleaned.length === 11) {
      return { isValid: true, type: 'landline' };
    }
    return { isValid: false, type: null };
  };

  const phoneValidation = validateUKPhone(phone);
  const isPhoneValid = phoneValidation.isValid;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
    setPhone(digits);
    if (error && validateUKPhone(digits).isValid) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }
    
    if (!isPhoneValid) {
      setError('Please enter a valid UK phone number (e.g. 07123 456789 or 0121 234 5678)');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const { error: insertError } = await supabase
        .from('abandoned_carts')
        .insert({
          phone: phone.trim(),
          email: `callback_${Date.now()}@callback.temp`,
          step_abandoned: 0,
          contact_status: 'new',
          contact_notes: `[${new Date().toLocaleDateString('en-GB')} - System] Urgent callback requested from homepage`,
          full_name: 'Callback Request',
          cart_metadata: {
            source: 'homepage_callback',
            priority: 'urgent',
            request_type: 'urgent_callback',
            phone_type: phoneValidation.type
          }
        });
      
      if (insertError) {
        throw insertError;
      }
      
      setIsSuccess(true);
      toast({
        title: "Request received!",
        description: "We'll call you back shortly.",
      });
      
      setTimeout(() => {
        setIsSuccess(false);
        setPhone('');
        onClose();
      }, 3000);
      
    } catch (err) {
      console.error('Error submitting callback request:', err);
      toast({
        title: "Something went wrong",
        description: "Please try again or call us directly on 0330 229 5040",
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
      <DialogContent className="w-[90vw] max-w-md mx-auto bg-white rounded-2xl p-6 sm:p-8 overflow-hidden">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-brand-green/10 flex items-center justify-center animate-pulse">
              <Phone className="w-5 h-5 text-brand-green" />
            </div>
            Request a call back
          </DialogTitle>
          <DialogDescription className="text-gray-600 text-sm sm:text-base leading-relaxed">
            Tell us your number and we'll give you a quick call to help with your vehicle or your warranty options.
          </DialogDescription>
        </DialogHeader>
        
        {isSuccess ? (
          <div className="py-10 text-center space-y-4 animate-in fade-in-0 zoom-in-95 duration-300">
            <div className="relative inline-block">
              <CheckCircle className="w-16 h-16 text-brand-green mx-auto" />
              <Sparkles className="w-6 h-6 text-brand-orange absolute -top-1 -right-1 animate-bounce" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-gray-900">We've got your request!</h3>
              <p className="text-gray-600">We'll call you back shortly.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div className="space-y-2">
              <label htmlFor="callback-phone" className="text-sm font-semibold text-gray-700">
                Phone number
              </label>
              <div 
                className={`relative transition-all duration-200 ${isFocused ? 'transform scale-[1.02]' : ''}`}
              >
                <Input
                  id="callback-phone"
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="07xxx xxxxxx"
              className={`h-14 text-lg pl-4 pr-10 rounded-xl transition-all duration-200 ${
                    error 
                      ? 'border-red-500 focus:ring-red-500' 
                      : isPhoneValid
                        ? 'border-green-500 ring-2 ring-green-500/20'
                        : isFocused 
                          ? 'border-brand-green ring-2 ring-brand-green/20' 
                          : 'border-gray-200'
                  }`}
                  disabled={isSubmitting}
                  autoComplete="tel"
                />
                {isPhoneValid && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center animate-in fade-in-50 zoom-in-95 duration-200">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
              </div>
              {error && (
                <p className="text-sm text-red-500 font-medium animate-in slide-in-from-top-1 duration-200">{error}</p>
              )}
            </div>
            
            <Button
              type="submit"
              disabled={isSubmitting || !phone.trim()}
              className="w-full h-14 bg-brand-orange hover:bg-brand-orange/90 text-white font-bold text-base rounded-xl shadow-lg shadow-brand-orange/25 transition-all duration-200 hover:shadow-xl hover:shadow-brand-orange/30 hover:-translate-y-0.5 active:translate-y-0 disabled:shadow-none disabled:translate-y-0"
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
            
            <div className="text-center space-y-1 pt-1">
              <p className="text-sm text-gray-600">
                We'll get back to you shortly.
              </p>
              <p className="text-sm text-brand-green font-semibold">
                Your request will be prioritised.
              </p>
            </div>
            
            <p className="text-xs text-gray-500 text-center pt-3 border-t border-gray-100">
              No email needed. We only use your number to call you back.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RequestCallbackModal;
