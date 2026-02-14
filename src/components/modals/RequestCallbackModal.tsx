import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, Loader2, CheckCircle, Sparkles, Shield, Clock, HeadphonesIcon } from 'lucide-react';
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
  const [showContent, setShowContent] = useState(false);

  // Staggered entrance animation
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setShowContent(true), 150);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [isOpen]);

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
      }, 3500);
      
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

  // Progress indicator based on phone input
  const inputProgress = Math.min((phone.length / 11) * 100, 100);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="w-[90vw] max-w-md mx-auto bg-white rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
        
        {/* Green accent header bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-brand-green via-emerald-400 to-brand-green" />
        
        <div className="p-6 sm:p-8">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div 
                className={`w-12 h-12 rounded-2xl bg-brand-green/10 flex items-center justify-center transition-all duration-500 ${
                  showContent ? 'scale-100 rotate-0' : 'scale-0 rotate-[-30deg]'
                }`}
              >
                <Phone className="w-6 h-6 text-brand-green" />
              </div>
              <span className={`transition-all duration-500 delay-100 ${showContent ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
                Request a call back
              </span>
            </DialogTitle>
            <DialogDescription 
              className={`text-gray-600 text-sm sm:text-base leading-relaxed transition-all duration-500 delay-200 ${
                showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
            >
              Tell us your number and we'll give you a quick call to help with your vehicle or your warranty options.
            </DialogDescription>
          </DialogHeader>
          
          {isSuccess ? (
            <div className="py-10 text-center space-y-5">
              {/* Animated success rings */}
              <div className="relative inline-block">
                <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full bg-brand-green/20 animate-ping" style={{ animationDuration: '1.5s' }} />
                <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full bg-brand-green/10 animate-pulse" />
                <div className="relative w-20 h-20 mx-auto rounded-full bg-brand-green flex items-center justify-center animate-in zoom-in-50 duration-500">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <Sparkles className="w-5 h-5 text-amber-400 absolute -top-1 -right-1 animate-bounce" style={{ animationDelay: '0.3s' }} />
                <Sparkles className="w-4 h-4 text-brand-green absolute -bottom-0 -left-2 animate-bounce" style={{ animationDelay: '0.6s' }} />
              </div>
              <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-500" style={{ animationDelay: '0.2s' }}>
                <h3 className="text-xl font-bold text-gray-900">We've got your request!</h3>
                <p className="text-gray-600">A member of our team will call you back shortly.</p>
              </div>
              {/* Progress bar auto-close */}
              <div className="w-32 mx-auto h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-green rounded-full animate-[shrink_3.5s_linear_forwards]" />
              </div>
              <style>{`@keyframes shrink { from { width: 100% } to { width: 0% } }`}</style>
            </div>
          ) : (
            <form 
              onSubmit={handleSubmit} 
              className={`mt-6 space-y-5 transition-all duration-500 delay-300 ${
                showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              <div className="space-y-2">
                <label htmlFor="callback-phone" className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                  <span>Phone number</span>
                  {phone.length > 0 && !isPhoneValid && (
                    <span className="text-xs text-gray-400 font-normal animate-in fade-in-50 duration-200">
                      {phone.length}/11 digits
                    </span>
                  )}
                </label>
                <div className="relative">
                  <div 
                    className={`relative transition-all duration-300 ${
                      isFocused ? 'transform scale-[1.01]' : ''
                    }`}
                  >
                    <Input
                      id="callback-phone"
                      type="tel"
                      value={phone}
                      onChange={handlePhoneChange}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      placeholder="07xxx xxxxxx"
                      className={`h-14 text-lg pl-4 pr-12 rounded-xl transition-all duration-300 ${
                        error 
                          ? 'border-red-400 focus:ring-red-400/30 bg-red-50/30' 
                          : isPhoneValid
                            ? 'border-brand-green ring-2 ring-brand-green/20 bg-green-50/40'
                            : isFocused 
                              ? 'border-brand-green/60 ring-2 ring-brand-green/10 bg-white' 
                              : 'border-gray-200 bg-gray-50/50'
                      }`}
                      disabled={isSubmitting}
                      autoComplete="tel"
                    />
                    
                    {/* Animated checkmark */}
                    {isPhoneValid && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-in zoom-in-50 fade-in-0 duration-300">
                        <div className="w-8 h-8 rounded-full bg-brand-green flex items-center justify-center shadow-md shadow-brand-green/30">
                          <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Progress bar under input */}
                  {phone.length > 0 && !isPhoneValid && (
                    <div className="absolute -bottom-0.5 left-2 right-2 h-0.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-brand-green/60 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${inputProgress}%` }}
                      />
                    </div>
                  )}
                </div>
                
                {error && (
                  <p className="text-sm text-red-500 font-medium animate-in slide-in-from-top-1 fade-in-0 duration-200">
                    {error}
                  </p>
                )}
                {isPhoneValid && !error && (
                  <p className="text-sm text-brand-green flex items-center gap-1.5 font-medium animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
                    <CheckCircle className="h-4 w-4" />
                    Valid UK {phoneValidation.type === 'mobile' ? 'mobile' : 'landline'} number
                  </p>
                )}
              </div>
              
              <Button
                type="submit"
                disabled={isSubmitting || !phone.trim()}
                className={`w-full h-14 bg-brand-green hover:bg-brand-green/90 text-white font-bold text-base rounded-xl transition-all duration-300 ${
                  isPhoneValid 
                    ? 'shadow-lg shadow-brand-green/30 hover:shadow-xl hover:shadow-brand-green/40 hover:-translate-y-0.5 active:translate-y-0' 
                    : 'shadow-none opacity-80'
                } disabled:shadow-none disabled:translate-y-0 disabled:opacity-60`}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Phone className="w-5 h-5" />
                    Call me back
                  </span>
                )}
              </Button>
              
              {/* Trust indicators */}
              <div className="text-center space-y-2 pt-2">
                <p className="text-sm text-gray-600">
                  We'll get back to you shortly.
                </p>
                <p className="text-sm text-brand-green font-bold flex items-center justify-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Your request will be prioritised.
                </p>
              </div>
              
              {/* Trust badges row */}
              <div className="flex items-center justify-center gap-4 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Privacy protected</span>
                </div>
                <div className="w-px h-3 bg-gray-200" />
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <HeadphonesIcon className="w-3.5 h-3.5" />
                  <span>UK-based team</span>
                </div>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RequestCallbackModal;
