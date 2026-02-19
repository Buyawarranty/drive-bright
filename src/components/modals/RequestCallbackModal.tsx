import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, Loader2, CheckCircle, Sparkles, Shield, Clock, HeadphonesIcon, X, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import confetti from 'canvas-confetti';
import pandaMascot from '@/assets/panda-mascot.png';

const CarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 17.5h20" />
    <path d="M5.5 17.5l1.5-6h14l1.5 6" />
    <rect x="3" y="17.5" width="22" height="5" rx="2" />
    <circle cx="8" cy="22.5" r="1.5" />
    <circle cx="20" cy="22.5" r="1.5" />
    <path d="M7 11.5l1-3.5h12l1 3.5" />
  </svg>
);

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
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setShowContent(true), 150);
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

    // Auto-submit on valid number
    if (validateUKPhone(digits).isValid && !isSubmitting) {
      setTimeout(() => {
        const form = e.target.closest('form');
        if (form) form.requestSubmit();
      }, 400);
    }
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="w-[90vw] max-w-md mx-auto bg-white rounded-2xl p-0 overflow-hidden border-0 shadow-2xl"
        hideCloseButton
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X className="h-6 w-6 text-gray-700" />
        </button>

        <div className="px-6 pt-7 pb-6 sm:px-8">
          {isSuccess ? (
            /* ── Success state ── */
            <div className="py-4 text-center space-y-5 animate-in fade-in-50 duration-300">
              <div className="relative inline-block">
                <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: '1.5s' }} />
                <div className="relative w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center animate-in zoom-in-50 duration-500">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <Sparkles className="w-5 h-5 text-amber-400 absolute -top-1 -right-1 animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-bold text-gray-900">You're all set! 🎉</h3>
                <p className="text-gray-600 text-sm">We normally call the same day, or within one working day.</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                  <Clock className="w-6 h-6 text-amber-500 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-amber-700">Same-day callback</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <HeadphonesIcon className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-blue-700">UK-based team</p>
                </div>
              </div>

              <p className="text-brand-orange font-bold text-sm pt-1">
                Have competitor quotes ready — we'll beat them 💪
              </p>
            </div>
          ) : (
            /* ── Form state ── */
            <div className={`transition-all duration-500 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              {/* Header */}
              <div className="flex items-center gap-2.5 mb-2">
                <CarIcon className="h-6 w-6 text-gray-900 flex-shrink-0" />
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                  Request a call back
                </h2>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed mb-6 pl-[34px]">
                One of our UK‑based specialists will call you to help compare your options and find the right cover for your vehicle.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Phone field */}
                <div className="space-y-1.5">
                  <label htmlFor="callback-phone-modal" className="block text-sm font-bold text-gray-900">
                    Your mobile number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-black/40" />
                    <Input
                      id="callback-phone-modal"
                      type="tel"
                      value={phone}
                      onChange={handlePhoneChange}
                      placeholder="07900 000000"
                      className={`h-14 text-base font-semibold pl-11 pr-12 rounded-xl transition-all duration-300 placeholder:text-gray-400 ${
                        error
                          ? 'border-2 border-red-500 bg-white focus:border-red-500 focus:ring-0'
                          : isPhoneValid
                            ? 'border-2 border-emerald-500 bg-white focus:border-emerald-500 focus:ring-0'
                            : 'border-2 border-black/80 bg-[#F5F5F5] focus:bg-white focus:border-brand-orange focus:ring-0'
                      }`}
                      disabled={isSubmitting}
                      autoComplete="tel"
                    />
                    {isPhoneValid && !isSubmitting && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-in zoom-in-50 fade-in-0 duration-300">
                        <div className="w-6 h-6 rounded-full border-2 border-emerald-500 flex items-center justify-center">
                          <Check className="w-4 h-4 text-emerald-500" strokeWidth={3} />
                        </div>
                      </div>
                    )}
                    {isSubmitting && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-5 h-5 text-brand-orange animate-spin" />
                      </div>
                    )}
                  </div>
                  {error && (
                    <p className="text-sm text-red-500 font-medium animate-in slide-in-from-top-1 fade-in-0 duration-200">{error}</p>
                  )}
                </div>

                {/* Trust card with panda */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 relative overflow-hidden">
                  <div className="flex items-start gap-3">
                    <div className="space-y-2.5 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </div>
                        <span className="text-sm font-bold text-gray-900">Privacy protected</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </div>
                        <span className="text-sm font-bold text-gray-900">UK‑based team</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </div>
                        <span className="text-sm font-bold text-gray-900">No pressure</span>
                      </div>
                    </div>
                    {/* Panda mascot */}
                    <img
                      src={pandaMascot}
                      alt="Friendly panda mascot"
                      className="w-24 h-24 object-contain flex-shrink-0 -mr-2 -mb-2"
                    />
                  </div>
                </div>

                {/* CTA Button */}
                <Button
                  type="submit"
                  disabled={isSubmitting || !phone.trim()}
                  className={`w-full h-14 bg-brand-orange hover:bg-brand-orange/90 text-white font-bold text-lg rounded-xl transition-all duration-300 ${
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
                    'Call me back'
                  )}
                </Button>
              </form>

              {/* Footer text */}
              <p className="text-xs text-gray-400 text-center mt-4">
                We'll call you shortly. Your request will be prioritised.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RequestCallbackModal;
