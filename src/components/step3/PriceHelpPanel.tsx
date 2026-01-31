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
  
  // Validation error states
  const [phoneError, setPhoneError] = useState('');
  const [emailError, setEmailError] = useState('');

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
      setEmailError('');
      document.body.style.overflow = 'hidden';
      trackEvent('price_help_panel_opened');
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-]/g, '');
    return /^(07\d{9}|(\+44|0044)7\d{9}|0[1-9]\d{8,9})$/.test(cleaned);
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
  };

  const handleEmailChange = (value: string) => {
    setRequestEmail(value);
    // Clear error when user starts typing
    if (emailError) setEmailError('');
  };

  const handlePhoneBlur = () => {
    if (requestPhone.trim() && !validatePhone(requestPhone)) {
      setPhoneError('Please enter a valid UK phone number (e.g., 07123 456789)');
    } else {
      setPhoneError('');
    }
  };

  const handleEmailBlur = () => {
    if (requestEmail.trim() && !validateEmail(requestEmail)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset errors
    setPhoneError('');
    setEmailError('');
    
    let hasError = false;
    
    if (!requestPhone.trim()) {
      setPhoneError('Phone number is required');
      hasError = true;
    } else if (!validatePhone(requestPhone)) {
      setPhoneError('Please enter a valid UK phone number (e.g., 07123 456789)');
      hasError = true;
    }
    
    // Email is optional - only validate if provided
    if (requestEmail.trim() && !validateEmail(requestEmail)) {
      setEmailError('Please enter a valid email address');
      hasError = true;
    }
    
    if (hasError) {
      toast({
        title: "Please check your details",
        description: "Fix the highlighted errors to continue.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const vehicleData = JSON.parse(localStorage.getItem('vehicleData') || '{}');
      const quoteRef = localStorage.getItem('quoteReference') || `QR-${Date.now()}`;
      const requestedOptions = getRequestedOptionsString();
      
      // Create the lead in abandoned_carts table (shows in New Leads as "Urgent Call-back")
      const { error } = await supabase
        .from('abandoned_carts')
        .insert({
          email: requestEmail.trim() || `callback-${Date.now()}@price-match.temp`,
          phone: requestPhone.trim(),
          step_abandoned: 3,
          contact_status: 'urgent_callback',
          contact_notes: `URGENT CALLBACK - Price Match Request. ${competitorPrice ? `Customer wants us to beat £${competitorPrice}.` : ''} ${requestMessage ? `Quote details: ${requestMessage}` : ''} ${requestedOptions}. Source: Step 3 Price Help Popup. Priority: URGENT. Note: Customer requested customised pricing. Guarantee to beat any like-for-like quote. CALL BACK IMMEDIATELY.`,
          full_name: 'Urgent Callback - Price Match',
          vehicle_reg: vehicleData?.registration || null,
          vehicle_make: vehicleData?.make || null,
          vehicle_model: vehicleData?.model || null,
          vehicle_year: vehicleData?.year || null,
          cart_metadata: {
            requestedOptions,
            competitorPrice: competitorPrice || null,
            quoteDetails: requestMessage || null,
            currentExcess,
            currentClaimLimit,
            currentLabourRate,
            currentMonthlyPrice,
            quoteReference: quoteRef,
            source: 'Step 3 Price Help Popup',
            priority: 'URGENT',
            category: 'Urgent Callback',
            leadType: 'urgent_callback',
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
        description: "Please try again or call us on 0800 494 7477",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen && !isAnimating) return null;

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
            "fixed z-50 bg-white transition-transform duration-300 ease-out",
            "hidden md:flex md:flex-col md:right-0 md:top-0 md:h-full md:w-[440px] md:shadow-2xl md:rounded-l-2xl",
            isOpen ? "md:translate-x-0" : "md:translate-x-full"
          )}
        >
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 bg-brand-green/10 rounded-full flex items-center justify-center">
                <Check className="w-10 h-10 text-brand-green" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Thank you. We are preparing your quote.
            </h3>
            <p className="text-gray-600 mb-8 leading-relaxed">
              We will call you within one working day. If you already have a quote from another provider, have it ready and we will beat it.
            </p>
            <Button
              onClick={onClose}
              className="px-8 h-12 bg-brand-green hover:bg-brand-green/90 text-white font-semibold rounded-xl"
            >
              Done
            </Button>
          </div>
        </div>
        {/* Mobile Success */}
        <div
          className={cn(
            "fixed z-50 md:hidden bg-white transition-transform duration-300 ease-out",
            "left-0 right-0 bottom-0 rounded-t-2xl shadow-2xl",
            isOpen ? "translate-y-0" : "translate-y-full"
          )}
        >
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className="relative mb-5">
              <div className="w-16 h-16 bg-brand-green/10 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-brand-green" />
              </div>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Thank you. We are preparing your quote.
            </h3>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              We will call you within one working day. Have any competitor quotes ready and we will beat them.
            </p>
            <Button
              onClick={onClose}
              className="w-full h-12 bg-brand-green hover:bg-brand-green/90 text-white font-semibold rounded-xl"
            >
              Done
            </Button>
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
          {/* Price Field */}
          <div className="mb-5">
            <Label htmlFor="competitor-price" className="text-sm font-semibold text-gray-800 mb-1.5 block">
              What price were you quoted?
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">£</span>
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
                className="h-12 pl-8 rounded-lg border-gray-200 bg-gray-50 text-lg focus:bg-white"
                disabled={isSubmitting}
              />
            </div>
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
              className="rounded-lg resize-none border-gray-200 bg-gray-50 focus:bg-white"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Info Card */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700 leading-relaxed">
              ✨ We personalise every quote. Request a call back and we'll prepare the best price for you.
            </p>
          </div>

          {/* Contact Form */}
          <div className="space-y-4">
            {/* Phone */}
            <div>
              <Label htmlFor="request-phone" className="text-sm font-semibold text-gray-800 mb-1.5 block">
                Phone number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="request-phone"
                type="tel"
                value={requestPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                onBlur={handlePhoneBlur}
                placeholder="07123 456789"
                className={cn(
                  "h-12 rounded-lg bg-gray-50 focus:bg-white",
                  phoneError ? "border-red-500 focus-visible:ring-red-500" : "border-gray-200"
                )}
                disabled={isSubmitting}
                autoComplete="tel"
              />
              {phoneError && (
                <p className="text-sm text-red-500 mt-1">{phoneError}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="request-email" className="text-sm font-semibold text-gray-800 mb-1.5 block">
                Email <span className="text-gray-500 font-normal">(optional)</span>
              </Label>
              <Input
                id="request-email"
                type="email"
                value={requestEmail}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={handleEmailBlur}
                placeholder="your@email.com"
                className={cn(
                  "h-12 rounded-lg bg-gray-50 focus:bg-white",
                  emailError ? "border-red-500 focus-visible:ring-red-500" : "border-gray-200"
                )}
                disabled={isSubmitting}
                autoComplete="email"
              />
              {emailError && (
                <p className="text-sm text-red-500 mt-1">{emailError}</p>
              )}
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
          {/* Price Field */}
          <div className="mb-4">
            <Label htmlFor="mobile-competitor-price" className="text-sm font-semibold text-gray-800 mb-1.5 block">
              What price were you quoted?
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">£</span>
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
                className="h-11 pl-8 rounded-lg border-gray-200 bg-gray-50 text-base focus:bg-white"
                disabled={isSubmitting}
              />
            </div>
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
              className="rounded-lg resize-none border-gray-200 bg-gray-50 text-sm focus:bg-white"
              rows={2}
              disabled={isSubmitting}
            />
          </div>

          {/* Info Card */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
            <p className="text-xs text-gray-700 leading-relaxed">
              ✨ We personalise every quote. Request a call back and we'll prepare the best price for you.
            </p>
          </div>

          {/* Contact Form */}
          <div className="space-y-3">
            {/* Phone */}
            <div>
              <Label htmlFor="mobile-phone" className="text-sm font-semibold text-gray-800 mb-1.5 block">
                Phone number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="mobile-phone"
                type="tel"
                value={requestPhone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                onBlur={handlePhoneBlur}
                placeholder="07123 456789"
                className={cn(
                  "h-11 rounded-lg bg-gray-50 focus:bg-white",
                  phoneError ? "border-red-500 focus-visible:ring-red-500" : "border-gray-200"
                )}
                disabled={isSubmitting}
                autoComplete="tel"
              />
              {phoneError && (
                <p className="text-xs text-red-500 mt-1">{phoneError}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <Label htmlFor="mobile-email" className="text-sm font-semibold text-gray-800 mb-1.5 block">
                Email <span className="text-gray-500 font-normal">(optional)</span>
              </Label>
              <Input
                id="mobile-email"
                type="email"
                value={requestEmail}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={handleEmailBlur}
                placeholder="your@email.com"
                className={cn(
                  "h-11 rounded-lg bg-gray-50 focus:bg-white",
                  emailError ? "border-red-500 focus-visible:ring-red-500" : "border-gray-200"
                )}
                disabled={isSubmitting}
                autoComplete="email"
              />
              {emailError && (
                <p className="text-xs text-red-500 mt-1">{emailError}</p>
              )}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-5 pb-4">
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
        </form>
      </div>
    </>
  );
};

export default PriceHelpPanel;
