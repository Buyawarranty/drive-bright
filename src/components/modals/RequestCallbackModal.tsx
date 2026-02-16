import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, Loader2, CheckCircle, Sparkles, Shield, Clock, HeadphonesIcon, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';

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

  // Entrance animation + confetti
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setShowContent(true), 150);
      confetti({
        particleCount: 6,
        spread: 45,
        origin: { y: 0.6 },
        shapes: ['square'],
        colors: ['#FF6A00', '#fbbf24', '#10b981']
      });
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [isOpen]);

  const validateUKPhone = (phoneNumber: string): { isValid: boolean; type: 'mobile' | 'landline' | null } => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.startsWith('07') && cleaned.length === 11) return { isValid: true, type: 'mobile' };
    if ((cleaned.startsWith('01') || cleaned.startsWith('02')) && cleaned.length >= 10 && cleaned.length <= 11) return { isValid: true, type: 'landline' };
    if (cleaned.startsWith('03') && cleaned.length === 11) return { isValid: true, type: 'landline' };
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
    if (!phone.trim()) { setError('Please enter your phone number'); return; }
    if (!isPhoneValid) { setError('Please enter a valid UK phone number (e.g. 07123 456789)'); return; }

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

      if (insertError) throw insertError;

      setIsSuccess(true);
      confetti({
        particleCount: 10,
        spread: 60,
        origin: { y: 0.5 },
        colors: ['#FF6A00', '#fbbf24', '#10b981'],
        gravity: 0.8,
        scalar: 1.2
      });

      toast({ title: "Request received!", description: "We'll call you back shortly." });

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

  const inputProgress = Math.min((phone.length / 11) * 100, 100);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="w-[90vw] max-w-md mx-auto bg-white rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-white/80 hover:bg-gray-100 transition-colors"
        >
          <X className="h-4 w-4 text-gray-600" />
        </button>

        {/* Vibrant gradient header */}
        <div className="bg-gradient-to-br from-brand-orange via-orange-500 to-amber-500 px-6 pt-8 pb-6 text-center relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-6 -translate-x-4" />
          
          <div className={`relative z-10 transition-all duration-500 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="flex justify-center space-x-2 mb-3">
              <Phone className="h-8 w-8 text-white animate-bounce" />
              <Sparkles className="h-6 w-6 text-yellow-200 animate-bounce" style={{ animationDelay: '0.15s' }} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">
              We'll call you back!
            </h2>
            <p className="text-white/90 text-sm">
              Free, no-pressure chat about your warranty options
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {isSuccess ? (
            <div className="py-8 text-center space-y-5">
              <div className="relative inline-block">
                <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: '1.5s' }} />
                <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full bg-emerald-500/10 animate-pulse" />
                <div className="relative w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center animate-in zoom-in-50 duration-500">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <Sparkles className="w-5 h-5 text-amber-400 absolute -top-1 -right-1 animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
              <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-500" style={{ animationDelay: '0.2s' }}>
                <h3 className="text-xl font-bold text-gray-900">✔️ You're all set!</h3>
                <p className="text-gray-600">We're already preparing your quote. We normally call the same day.</p>
                <p className="text-brand-orange font-semibold">Have any competitor quotes ready —<br/>we'll beat them. 💪</p>
              </div>
              <div className="w-32 mx-auto h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-orange rounded-full animate-[shrink_3.5s_linear_forwards]" />
              </div>
              <style>{`@keyframes shrink { from { width: 100% } to { width: 0% } }`}</style>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className={`space-y-5 transition-all duration-500 delay-300 ${
                showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              <div className="space-y-2">
                <label htmlFor="callback-phone" className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                  <span>Your phone number</span>
                  {phone.length > 0 && !isPhoneValid && (
                    <span className="text-xs text-gray-400 font-normal">{phone.length}/11 digits</span>
                  )}
                </label>
                <div className="relative">
                  <div className={`relative transition-all duration-300 ${isFocused ? 'transform scale-[1.01]' : ''}`}>
                    <Input
                      id="callback-phone"
                      type="tel"
                      value={phone}
                      onChange={handlePhoneChange}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      placeholder="e.g. 07123 456789"
                      className={`h-14 text-lg pl-4 pr-12 rounded-xl transition-all duration-300 placeholder:text-gray-400 ${
                        error
                          ? 'border-red-400 focus:ring-red-400/30 bg-red-50/30'
                          : isPhoneValid
                            ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/40'
                            : isFocused
                              ? 'border-brand-orange/60 ring-2 ring-brand-orange/10 bg-white'
                              : 'border-gray-200 bg-gray-50/50'
                      }`}
                      disabled={isSubmitting}
                      autoComplete="tel"
                    />
                    {isPhoneValid && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-in zoom-in-50 fade-in-0 duration-300">
                        <div className="w-6 h-6 rounded-full border-2 border-emerald-600 flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        </div>
                      </div>
                    )}
                  </div>
                  {phone.length > 0 && !isPhoneValid && (
                    <div className="absolute -bottom-0.5 left-2 right-2 h-0.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-orange/60 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${inputProgress}%` }}
                      />
                    </div>
                  )}
                </div>
                {error && (
                  <p className="text-sm text-red-500 font-medium animate-in slide-in-from-top-1 fade-in-0 duration-200">{error}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !phone.trim()}
                className={`w-full h-14 bg-brand-orange hover:bg-brand-orange/90 text-white font-bold text-base rounded-xl transition-all duration-300 ${
                  isPhoneValid
                    ? 'shadow-lg shadow-brand-orange/30 hover:shadow-xl hover:shadow-brand-orange/40 hover:-translate-y-0.5 active:translate-y-0'
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
                <p className="text-sm text-gray-600">We'll get back to you shortly.</p>
                <p className="text-sm text-brand-orange font-bold flex items-center justify-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Your request will be prioritised
                </p>
              </div>

              {/* Trust badges */}
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
