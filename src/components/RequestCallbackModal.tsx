import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, Lock, Headphones, X } from 'lucide-react';

interface RequestCallbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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

const RequestCallbackModal: React.FC<RequestCallbackModalProps> = ({ isOpen, onClose }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [touched, setTouched] = useState(false);

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    return digits.slice(0, 11);
  };

  const validatePhone = (phone: string): { isValid: boolean; type: 'mobile' | 'landline' | null } => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('07') && cleaned.length === 11) return { isValid: true, type: 'mobile' };
    if ((cleaned.startsWith('01') || cleaned.startsWith('02')) && cleaned.length >= 10 && cleaned.length <= 11) return { isValid: true, type: 'landline' };
    if (cleaned.startsWith('03') && cleaned.length === 11) return { isValid: true, type: 'landline' };
    return { isValid: false, type: null };
  };

  const phoneValidation = useMemo(() => {
    if (!phoneNumber.trim()) return { isValid: false, type: null };
    return validatePhone(phoneNumber);
  }, [phoneNumber]);

  const isPhoneValid = phoneValidation.isValid;

  const handlePhoneBlur = () => {
    setTouched(true);
    if (phoneNumber.trim() && !isPhoneValid) {
      setPhoneError('Enter a valid UK mobile or landline number');
    } else {
      setPhoneError('');
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = formatPhoneNumber(e.target.value);
    setPhoneNumber(value);
    if (touched && phoneError && validatePhone(value).isValid) {
      setPhoneError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    if (!phoneNumber.trim()) {
      setPhoneError('Enter a valid UK mobile or landline number');
      return;
    }
    if (!isPhoneValid) {
      setPhoneError('Enter a valid UK mobile or landline number');
      return;
    }

    setIsSubmitting(true);
    setPhoneError('');

    try {
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
      toast.success('Callback request submitted!');

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
      <DialogContent
        className="sm:max-w-[420px] p-0 border-0 overflow-hidden bg-white"
        style={{ borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#E5E7EB] transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4 text-[#6B7280]" />
        </button>

        {isSuccess ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center justify-center px-8 py-12 text-center animate-in fade-in-50 zoom-in-95 duration-300">
            {/* Sparkle icon */}
            <svg className="w-7 h-7 mb-5 text-[#FFA94D]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l1.09 3.26L16 6l-2.91.74L12 10l-1.09-3.26L8 6l2.91-.74L12 2zm6 8l.72 2.17L21 13l-2.28.83L18 16l-.72-2.17L15 13l2.28-.83L18 10zM7 14l.72 2.17L10 17l-2.28.83L7 20l-.72-2.17L4 17l2.28-.83L7 14z" />
            </svg>

            {/* Green tick + heading */}
            <h3 className="text-xl font-bold text-[#151515] mb-4 flex items-start justify-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#2BB673] flex-shrink-0 mt-0.5 animate-in zoom-in-50 duration-300">
                <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
              </span>
              <span>Thank you — your call request is confirmed</span>
            </h3>

            <p className="text-sm text-[#6B7280] leading-relaxed max-w-[320px] mb-4">
              We're already preparing your quote. We normally call the same day, and if we're ever busy, it will be within one working day.
            </p>

            <p className="text-sm font-bold text-[#151515] leading-relaxed max-w-[320px]">
              To make the most of your call, have any competitor quotes ready —{' '}
              <br />we'll beat them.
            </p>
          </div>
        ) : (
          /* ── Form state ── */
          <div className="px-7 pt-7 pb-6">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-2">
              <CarIcon className="h-6 w-6 text-[#151515] flex-shrink-0" />
              <h2 className="text-xl font-bold text-[#151515] tracking-tight">
                Request a call back
              </h2>
            </div>
            <p className="text-sm text-[#6B7280] leading-relaxed mb-6 pl-[34px]">
              Share your number and one of our UK‑based specialists will call to help with your warranty options.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Phone field */}
              <div className="space-y-1.5">
                <label htmlFor="callback-phone" className="block text-sm font-medium text-[#151515]">
                  Your phone number
                </label>
                <div className="relative">
                  <input
                    id="callback-phone"
                    type="tel"
                    placeholder="e.g. 07960 123 456"
                    value={phoneNumber}
                    onChange={(e) => {
                      handlePhoneChange(e);
                      const val = formatPhoneNumber(e.target.value);
                      if (validatePhone(val).isValid && !isSubmitting) {
                        setTimeout(() => {
                          const form = e.target.closest('form');
                          if (form) form.requestSubmit();
                        }, 400);
                      }
                    }}
                    onBlur={handlePhoneBlur}
                    autoComplete="tel"
                    disabled={isSubmitting}
                    className={`
                      w-full h-12 px-4 pr-11 text-base text-[#151515] bg-white
                      border-[1.5px] outline-none transition-all duration-200
                      placeholder:text-[#9CA3AF] placeholder:font-normal
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${phoneError
                        ? 'border-[#D92D20] focus:border-[#D92D20] focus:shadow-[0_0_0_3px_rgba(217,45,32,0.12)]'
                        : isPhoneValid
                          ? 'border-[#2BB673] focus:border-[#2BB673] focus:shadow-[0_0_0_3px_rgba(43,182,115,0.15)]'
                          : 'border-[#E5E7EB] focus:border-[#FFA94D] focus:shadow-[0_0_0_3px_#FFE8CC]'
                      }
                    `}
                    style={{ borderRadius: '10px' }}
                  />
                  {isPhoneValid && !isSubmitting && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-in fade-in-50 zoom-in-95 duration-200">
                      <div className="w-6 h-6 rounded-full bg-[#2BB673] flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                      </div>
                    </div>
                  )}
                  {isSubmitting && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      <svg className="animate-spin h-5 w-5 text-[#FFA94D]" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  )}
                </div>
                {phoneError && (
                  <p className="text-xs text-[#D92D20] font-medium animate-in fade-in-50 duration-200">
                    {phoneError}
                  </p>
                )}
              </div>
            </form>

            {/* Divider */}
            <div className="my-5 border-t border-[#E5E7EB]" />

            {/* Reassurance row */}
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-[#6B7280]" strokeWidth={2} />
                <span className="text-xs text-[#6B7280] font-medium">Privacy protected</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Headphones className="h-3.5 w-3.5 text-[#6B7280]" strokeWidth={2} />
                <span className="text-xs text-[#6B7280] font-medium">UK‑based team</span>
              </div>
            </div>
            <p className="text-[11px] text-[#9CA3AF] text-center mt-2">
              We'll call you shortly. Your request will be prioritised.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RequestCallbackModal;
