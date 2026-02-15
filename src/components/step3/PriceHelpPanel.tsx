import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, Trophy, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { trackEvent } from '@/utils/analytics';
import pandaSavingsMascot from "@/assets/panda-savings-mascot.webp";

interface PriceHelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentExcess: number | null;
  currentClaimLimit: number | null;
  currentLabourRate: number;
  onExcessChange: (excess: number) => void;
  onClaimLimitChange: (limit: number) => void;
  onLabourRateChange: (rate: number) => void;
  currentMonthlyPrice: number;
}

const PriceHelpPanel: React.FC<PriceHelpPanelProps> = ({
  isOpen,
  onClose,
  currentExcess,
  currentClaimLimit,
  currentLabourRate,
  currentMonthlyPrice,
}) => {
  const { toast } = useToast();
  const [isAnimating, setIsAnimating] = useState(false);

  // Request form state
  const [requestPhone, setRequestPhone] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [competitorPrice, setCompetitorPrice] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  
  // Validation state
  const [phoneError, setPhoneError] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [isEmailValid, setIsEmailValid] = useState(false);

  // Reset state when panel opens
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setRequestPhone('');
      setRequestEmail('');
      setCompetitorPrice('');
      setRequestMessage('');
      setRequestSuccess(false);
      setPhoneError('');
      setIsPhoneValid(false);
      setIsEmailValid(false);
      document.body.style.overflow = 'hidden';
      trackEvent('price_help_panel_opened');
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const validatePhone = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-]/g, '');
    return /^(07\d{9}|(\+44|0044)7\d{9}|0[1-9]\d{8,9})$/.test(cleaned);
  };

  const validateEmail = (email: string): boolean => {
    if (!email.trim()) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  // Build requested options string
  const getRequestedOptionsString = () => {
    const parts: string[] = [];
    if (competitorPrice) parts.push(`Price to Beat: £${competitorPrice}`);
    if (currentExcess) parts.push(`Current Excess: £${currentExcess}`);
    if (currentClaimLimit) parts.push(`Current Claim Limit: £${currentClaimLimit.toLocaleString()}`);
    if (currentLabourRate) parts.push(`Current Labour Rate: £${currentLabourRate}/hr`);
    return parts.length > 0 ? parts.join(', ') : 'Custom quote request';
  };

  const handlePhoneChange = (value: string) => {
    setRequestPhone(value);
    // Clear error when user starts typing
    if (phoneError) setPhoneError('');
    // Check if phone is valid for green tick
    setIsPhoneValid(validatePhone(value));
  };

  const handleEmailChange = (value: string) => {
    setRequestEmail(value);
    // Check if email is valid for green tick
    setIsEmailValid(validateEmail(value));
  };

  const handlePhoneBlur = () => {
    if (requestPhone.trim() && !validatePhone(requestPhone)) {
      setPhoneError('Please enter a valid UK phone number (e.g., 07123 456789)');
    } else {
      setPhoneError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset error
    setPhoneError('');
    
    // Only validate phone number
    if (!requestPhone.trim()) {
      setPhoneError('Phone number is required');
      return;
    }
    
    if (!validatePhone(requestPhone)) {
      setPhoneError('Please enter a valid UK phone number (e.g., 07123 456789)');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const vehicleData = JSON.parse(localStorage.getItem('vehicleData') || '{}');
      const quoteRef = localStorage.getItem('quoteReference') || `QR-${Date.now()}`;
      const requestedOptions = getRequestedOptionsString();
      
      // Create the lead in abandoned_carts table (shows in New Leads)
      // Phone is required, email is optional
      const { error } = await supabase
        .from('abandoned_carts')
        .insert({
          email: requestEmail.trim() || `callback-${Date.now()}@price-match.temp`,
          phone: requestPhone.trim(),
          step_abandoned: 3,
          contact_status: 'new',
          contact_notes: `PRICE MATCH REQUEST. ${competitorPrice ? `Price to beat: £${competitorPrice}.` : ''} ${requestMessage ? `Details: ${requestMessage}` : ''} Source: Step 3 Price Help Panel.`,
          full_name: 'Price Match Request',
          vehicle_reg: vehicleData?.registration || null,
          vehicle_make: vehicleData?.make || null,
          vehicle_model: vehicleData?.model || null,
          vehicle_year: vehicleData?.year || null,
          cart_metadata: {
            competitorPrice: competitorPrice || null,
            quoteDetails: requestMessage || null,
            currentExcess,
            currentClaimLimit,
            currentLabourRate,
            currentMonthlyPrice,
            quoteReference: quoteRef,
            source: 'step3_price_help',
            priority: 'high',
            request_type: 'urgent_callback',
            leadType: 'price_match',
            timestamp: new Date().toISOString(),
          }
        });

      if (error) throw error;

      trackEvent('price_help_callback_submitted', { requestedOptions, competitorPrice });
      setRequestSuccess(true);
      
    } catch (err) {
      console.error('Request submit error:', err);
      toast({
        title: "Something went wrong",
        description: "Please try again or call us on 0330 229 5040",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen && !isAnimating) return null;

  // Animated SVG Tick component
  const AnimatedTick = ({ size = 64 }: { size?: number }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className="animated-tick"
    >
      <circle
        cx="32"
        cy="32"
        r="28"
        stroke="hsl(var(--brand-orange))"
        strokeWidth="3"
        fill="none"
        className="tick-circle"
      />
      <path
        d="M20 33 L28 41 L44 25"
        stroke="hsl(var(--brand-orange))"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className="tick-path"
      />
      <style>{`
        .tick-circle {
          stroke-dasharray: 176;
          stroke-dashoffset: 176;
          animation: drawCircle 300ms ease-out forwards;
        }
        .tick-path {
          stroke-dasharray: 44;
          stroke-dashoffset: 44;
          animation: drawTick 250ms ease-out 150ms forwards;
        }
        @keyframes drawCircle {
          to { stroke-dashoffset: 0; }
        }
        @keyframes drawTick {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </svg>
  );

  // Success State
  if (requestSuccess) {
    return (
      <>
        <div
          className={cn(
            "fixed inset-0 bg-black/50 z-50 transition-opacity duration-300",
            isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={onClose}
        />
        {/* Desktop Success */}
        <div
          className={cn(
            "fixed z-50 transition-transform duration-300 ease-out overflow-hidden",
            "hidden md:flex md:flex-col md:right-0 md:top-0 md:h-full md:w-[440px] md:shadow-2xl md:rounded-l-2xl",
            isOpen ? "md:translate-x-0" : "md:translate-x-full"
          )}
        >
          {/* Gradient background */}
          <div className="flex-1 flex flex-col bg-gradient-to-b from-green-50 via-white to-orange-50 relative">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/80 hover:bg-white shadow-sm flex items-center justify-center transition-colors z-10"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            {/* Content */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
              {/* Celebration icon */}
              <div className="mb-6 relative">
                <div className="w-20 h-20 flex items-center justify-center animate-in zoom-in-50 duration-500">
                  <Check className="w-16 h-16 text-green-500" strokeWidth={3} />
                </div>
                <span className="absolute -top-2 -right-2 text-2xl animate-bounce">🎉</span>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                You're all set!
              </h3>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-5 max-w-sm">
                <p className="text-gray-700 leading-relaxed">
                  Our team is already working on <span className="font-semibold text-gray-900">your personalised quote</span>. 
                  Expect a call today — or within one working day if we're flat out.
                </p>
              </div>

              <div className="bg-gradient-to-r from-brand-orange/10 to-amber-50 rounded-xl p-4 mb-8 max-w-sm border border-brand-orange/20">
                <p className="text-gray-800 font-medium text-center">
                  <Trophy className="w-5 h-5 text-brand-orange inline-block mr-1.5 align-text-bottom" />
                  Have any other quotes handy?<br />
                  <span className="text-brand-orange font-bold">We'll beat them.</span>
                </p>
              </div>

              <Button
                onClick={onClose}
                className="px-10 h-12 bg-brand-orange hover:bg-brand-orange/90 text-white font-bold rounded-xl shadow-md shadow-orange-200 transition-all hover:shadow-lg hover:scale-[1.02]"
              >
                Got it ✓
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Success */}
        <div
          className={cn(
            "fixed z-50 md:hidden transition-transform duration-300 ease-out overflow-hidden",
            "left-0 right-0 bottom-0 rounded-t-2xl shadow-2xl",
            isOpen ? "translate-y-0" : "translate-y-full"
          )}
        >
          <div className="bg-gradient-to-b from-green-50 via-white to-orange-50 relative">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 hover:bg-white shadow-sm flex items-center justify-center transition-colors z-10"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>

            <div className="flex flex-col items-center justify-center p-6 pt-8 text-center animate-fade-in">
              {/* Celebration icon */}
              <div className="mb-4 relative">
                <div className="w-16 h-16 flex items-center justify-center animate-in zoom-in-50 duration-500">
                  <Check className="w-14 h-14 text-green-500" strokeWidth={3} />
                </div>
                <span className="absolute -top-1 -right-1 text-xl animate-bounce">🎉</span>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-3">
                You're all set!
              </h3>

              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
                <p className="text-sm text-gray-700 leading-relaxed">
                  Our team is already working on <span className="font-semibold text-gray-900">your personalised quote</span>. 
                  Expect a call today — or within one working day if we're flat out.
                </p>
              </div>

              <div className="bg-gradient-to-r from-brand-orange/10 to-amber-50 rounded-xl p-3 mb-6 border border-brand-orange/20">
                <p className="text-sm text-gray-800 font-medium text-center">
                  <Trophy className="w-4 h-4 text-brand-orange inline-block mr-1 align-text-bottom" />
                  Have other quotes?<br />
                  <span className="text-brand-orange font-bold">We'll beat them.</span>
                </p>
              </div>

              <Button
                onClick={onClose}
                className="w-full h-12 bg-brand-orange hover:bg-brand-orange/90 text-white font-bold rounded-xl shadow-md shadow-orange-200"
              >
                Got it ✓
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Main Panel View
  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-50 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        onTransitionEnd={() => !isOpen && setIsAnimating(false)}
      />

      {/* Desktop Panel */}
      <div
        className={cn(
          "fixed z-50 bg-white transition-transform duration-300 ease-out",
          "hidden md:flex md:flex-col md:right-0 md:top-0 md:h-full md:w-[440px] md:shadow-2xl md:rounded-l-2xl",
          isOpen ? "md:translate-x-0" : "md:translate-x-full"
        )}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-brand-orange flex-shrink-0" />
              <h2 className="text-xl font-bold text-gray-900 leading-tight">
                Not the right price? We will beat any quote.
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0"
              aria-label="Close pricing help panel"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            Share the price you were given and we will beat any like-for-like offer.
          </p>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 pb-8">
          {/* Price Field - Highlighted to encourage filling */}
          <div className="mb-5 p-4 bg-gradient-to-r from-brand-orange/5 to-amber-50/50 rounded-xl border border-brand-orange/20">
            <Label htmlFor="competitor-price" className="text-sm font-semibold text-gray-800 mb-1.5 block">
              What price were you quoted?
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 font-semibold">£</span>
              <Input
                id="competitor-price"
                type="text"
                inputMode="numeric"
                value={competitorPrice}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  setCompetitorPrice(value);
                }}
                placeholder="Enter the price you were quoted"
                className={cn(
                  "h-12 pl-8 pr-12 rounded-lg bg-white text-lg focus:border-brand-orange focus:ring-brand-orange",
                  competitorPrice ? "border-2 border-green-600" : "border-gray-300"
                )}
                disabled={isSubmitting}
              />
              {competitorPrice && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-in fade-in-50 zoom-in-95 duration-200">
                  <div className="w-6 h-6 rounded-full border-2 border-green-600 flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600" strokeWidth={3} />
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1.5">We'll beat any like-for-like quote</p>
          </div>

          {/* Details Field */}
          <div className="mb-5">
            <Label htmlFor="quote-details" className="text-sm font-semibold text-gray-800 mb-1.5 block">
              More details about your quote <span className="text-gray-500 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="quote-details"
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="Tell us what the quote includes"
              className="rounded-lg resize-none border-gray-300 bg-gray-50 focus:bg-white focus:border-gray-400"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Contact Form */}

          {/* Contact Form */}
          <div className="space-y-4">
            {/* Phone */}
            <div className={cn(
              "p-4 rounded-xl border-2 transition-all duration-200",
              isPhoneValid && !phoneError 
                ? "bg-green-50/50 border-green-600" 
                : "bg-gray-50/50 border-gray-200"
            )}>
              <Label htmlFor="request-phone" className="text-sm font-semibold text-gray-800 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">📞 Phone number <span className="text-red-500">*</span></span>
                <span className="text-xs font-normal text-gray-500">Required for callback</span>
              </Label>
              <div className="relative">
                <Input
                  id="request-phone"
                  type="tel"
                  value={requestPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onBlur={handlePhoneBlur}
                  placeholder="Enter phone number"
                  className={cn(
                    "h-12 rounded-lg bg-white text-lg pr-12 transition-all duration-200 placeholder:font-normal placeholder:text-gray-400",
                    phoneError 
                      ? "border-2 border-red-500 focus-visible:ring-red-500" 
                      : isPhoneValid 
                        ? "border-2 border-green-600 focus:border-green-600 focus:ring-green-600" 
                        : "border border-gray-300 focus:border-gray-400"
                  )}
                  disabled={isSubmitting}
                  autoComplete="tel"
                />
                {isPhoneValid && !phoneError && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-in fade-in-50 zoom-in-95 duration-200">
                    <div className="w-6 h-6 rounded-full border-2 border-green-600 flex items-center justify-center">
                      <Check className="w-4 h-4 text-green-600" strokeWidth={3} />
                    </div>
                  </div>
                )}
              </div>
              {phoneError && (
                <p className="text-sm text-red-500 mt-1">{phoneError}</p>
              )}
            </div>

            {/* Email */}
            <div className={cn(
              "p-4 rounded-xl border-2 transition-all duration-200",
              isEmailValid 
                ? "bg-green-50/50 border-green-600" 
                : "bg-gray-50/50 border-gray-200"
            )}>
              <Label htmlFor="request-email" className="text-sm font-semibold text-gray-800 mb-1.5 flex items-center justify-between">
                <span>✉️ Email</span>
                <span className="text-xs font-normal text-gray-500">(optional)</span>
              </Label>
              <div className="relative">
                <Input
                  id="request-email"
                  type="email"
                  value={requestEmail}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="your@email.com"
                  className={cn(
                    "h-12 rounded-lg bg-white pr-12 transition-all duration-200 placeholder:font-normal placeholder:text-gray-400",
                    isEmailValid 
                      ? "border-2 border-green-600 focus:border-green-600" 
                      : "border border-gray-300 focus:border-gray-400"
                  )}
                  disabled={isSubmitting}
                  autoComplete="email"
                />
                {isEmailValid && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-in fade-in-50 zoom-in-95 duration-200">
                    <div className="w-6 h-6 rounded-full border-2 border-green-600 flex items-center justify-center">
                      <Check className="w-4 h-4 text-green-600" strokeWidth={3} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-6">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-brand-orange text-white font-bold text-lg rounded-lg shadow-md disabled:opacity-50 animate-breathing"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Request a call back
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </div>

          {/* Panda Savings Mascot */}
          <div className="flex justify-center items-center pt-6 pb-2">
            <img
              src={pandaSavingsMascot}
              alt="Panda mascot putting savings into a jar - UK car warranty with affordable monthly payments"
              title="Save money on your car warranty"
              width={180}
              height={180}
              loading="lazy"
              className="object-contain"
            />
          </div>
        </form>
      </div>

      {/* Mobile Bottom Sheet */}
      <div
        className={cn(
          "fixed z-50 md:hidden bg-white transition-transform duration-300 ease-out",
          "left-0 right-0 bottom-0 rounded-t-2xl shadow-2xl max-h-[92vh] overflow-hidden",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-brand-orange flex-shrink-0" />
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                Not the right price? We will beat any quote.
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Share the price you were given and we will beat any like-for-like offer.
          </p>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 max-h-[calc(92vh-100px)]">
          {/* Price Field - Highlighted to encourage filling */}
          <div className="mb-4 p-3 bg-gradient-to-r from-brand-orange/5 to-amber-50/50 rounded-xl border border-brand-orange/20">
            <Label htmlFor="mobile-competitor-price" className="text-sm font-semibold text-gray-800 mb-1.5 block">
              What price were you quoted?
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 font-semibold">£</span>
              <Input
                id="mobile-competitor-price"
                type="text"
                inputMode="numeric"
                value={competitorPrice}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  setCompetitorPrice(value);
                }}
                placeholder="Enter the price you were quoted"
                className={cn(
                  "h-11 pl-8 pr-12 rounded-lg bg-white text-base focus:border-brand-orange",
                  competitorPrice ? "border-2 border-green-600" : "border-gray-300"
                )}
                disabled={isSubmitting}
              />
              {competitorPrice && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-in fade-in-50 zoom-in-95 duration-200">
                  <div className="w-6 h-6 rounded-full border-2 border-green-600 flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600" strokeWidth={3} />
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">We'll beat any like-for-like quote</p>
          </div>

          {/* Details Field */}
          <div className="mb-4">
            <Label htmlFor="mobile-quote-details" className="text-sm font-semibold text-gray-800 mb-1.5 block">
              More details about your quote <span className="text-gray-500 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="mobile-quote-details"
              value={requestMessage}
              onChange={(e) => setRequestMessage(e.target.value)}
              placeholder="Tell us what the quote includes"
              className="rounded-lg resize-none border-gray-300 bg-gray-50 text-sm focus:bg-white focus:border-gray-400"
              rows={2}
              disabled={isSubmitting}
            />
          </div>

          {/* Contact Form */}
          <div className="space-y-3">
            {/* Phone */}
            <div className={cn(
              "p-3 rounded-xl border-2 transition-all duration-200",
              isPhoneValid && !phoneError 
                ? "bg-green-50/50 border-green-600" 
                : "bg-gray-50/50 border-gray-200"
            )}>
              <Label htmlFor="mobile-phone" className="text-sm font-semibold text-gray-800 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">📞 Phone number <span className="text-red-500">*</span></span>
                <span className="text-xs font-normal text-gray-500">Required for callback</span>
              </Label>
              <div className="relative">
                <Input
                  id="mobile-phone"
                  type="tel"
                  value={requestPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onBlur={handlePhoneBlur}
                  placeholder="Enter phone number"
                  className={cn(
                    "h-12 rounded-lg bg-white text-base pr-12 transition-all duration-200 placeholder:font-normal placeholder:text-gray-400",
                    phoneError 
                      ? "border-2 border-red-500 focus-visible:ring-red-500" 
                      : isPhoneValid 
                        ? "border-2 border-green-600 focus:border-green-600" 
                        : "border border-gray-300 focus:border-gray-400"
                  )}
                  disabled={isSubmitting}
                  autoComplete="tel"
                />
                {isPhoneValid && !phoneError && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-in fade-in-50 zoom-in-95 duration-200">
                    <div className="w-6 h-6 rounded-full border-2 border-green-600 flex items-center justify-center">
                      <Check className="w-4 h-4 text-green-600" strokeWidth={3} />
                    </div>
                  </div>
                )}
              </div>
              {phoneError && (
                <p className="text-xs text-red-500 mt-1">{phoneError}</p>
              )}
            </div>

            {/* Email */}
            <div className={cn(
              "p-3 rounded-xl border-2 transition-all duration-200",
              isEmailValid 
                ? "bg-green-50/50 border-green-600" 
                : "bg-gray-50/50 border-gray-200"
            )}>
              <Label htmlFor="mobile-email" className="text-sm font-semibold text-gray-800 mb-1.5 flex items-center justify-between">
                <span>✉️ Email</span>
                <span className="text-xs font-normal text-gray-500">(optional)</span>
              </Label>
              <div className="relative">
                <Input
                  id="mobile-email"
                  type="email"
                  value={requestEmail}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="your@email.com"
                  className={cn(
                    "h-12 rounded-lg bg-white pr-12 transition-all duration-200 placeholder:font-normal placeholder:text-gray-400",
                    isEmailValid 
                      ? "border-2 border-green-600 focus:border-green-600" 
                      : "border border-gray-300 focus:border-gray-400"
                  )}
                  disabled={isSubmitting}
                  autoComplete="email"
                />
                {isEmailValid && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-in fade-in-50 zoom-in-95 duration-200">
                    <div className="w-6 h-6 rounded-full border-2 border-green-600 flex items-center justify-center">
                      <Check className="w-4 h-4 text-green-600" strokeWidth={3} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-5 pb-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-brand-orange text-white font-bold text-lg rounded-lg shadow-md disabled:opacity-50 animate-breathing"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Request a call back
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </div>

          {/* Panda Savings Mascot */}
          <div className="flex justify-center items-center pt-4 pb-6">
            <img
              src={pandaSavingsMascot}
              alt="Panda mascot putting savings into a jar - UK car warranty with affordable monthly payments"
              title="Save money on your car warranty"
              width={160}
              height={160}
              loading="lazy"
              className="object-contain"
            />
          </div>
        </form>
      </div>
    </>
  );
};

export default PriceHelpPanel;
