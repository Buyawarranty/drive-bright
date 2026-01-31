import React, { useState, useEffect, useCallback } from 'react';
import { X, Check, Loader2, Sliders, RotateCcw, Phone, ArrowRight, Sparkles, AlertCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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

// Pricing chip definitions
interface ChipOption {
  value: number;
  label: string;
  available: boolean;
}

const EXCESS_OPTIONS: ChipOption[] = [
  { value: 50, label: '£50', available: true },
  { value: 200, label: '£200', available: true },
  { value: 350, label: '£350', available: true },
  { value: 500, label: '£500', available: true },
];

const CLAIM_LIMIT_OPTIONS: ChipOption[] = [
  { value: 2000, label: '£2,000', available: true },
  { value: 3000, label: '£3,000', available: true },
  { value: 4000, label: '£4,000', available: true },
  { value: 5000, label: '£5,000', available: true },
  { value: 7000, label: '£7,000', available: false },
  { value: 10000, label: '£10,000', available: false },
];

const LABOUR_RATE_OPTIONS: ChipOption[] = [
  { value: 50, label: '£50/hr', available: true },
  { value: 100, label: '£100/hr', available: true },
  { value: 150, label: '£150/hr', available: true },
  { value: 175, label: '£175/hr', available: true },
  { value: 200, label: '£200/hr', available: true },
  { value: 250, label: '£250/hr', available: false },
];

const PriceHelpPanel: React.FC<PriceHelpPanelProps> = ({
  isOpen,
  onClose,
  currentExcess,
  currentClaimLimit,
  currentLabourRate,
  onExcessChange,
  onClaimLimitChange,
  onLabourRateChange,
  currentMonthlyPrice,
}) => {
  const { toast } = useToast();
  const [isAnimating, setIsAnimating] = useState(false);

  // Local preview state
  const [previewExcess, setPreviewExcess] = useState(currentExcess || 100);
  const [previewClaimLimit, setPreviewClaimLimit] = useState(currentClaimLimit || 2000);
  const [previewLabourRate, setPreviewLabourRate] = useState(currentLabourRate);
  const [customExcess, setCustomExcess] = useState('');
  const [showCustomExcess, setShowCustomExcess] = useState(false);
  const [customExcessError, setCustomExcessError] = useState('');

  // Request callback state
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestedOption, setRequestedOption] = useState('');
  const [requestPhone, setRequestPhone] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [requestConsent, setRequestConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);

  // Track original values for comparison
  const originalExcess = currentExcess || 100;
  const originalClaimLimit = currentClaimLimit || 2000;
  const originalLabourRate = currentLabourRate;

  // Reset state when panel opens
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setPreviewExcess(currentExcess || 100);
      setPreviewClaimLimit(currentClaimLimit || 2000);
      setPreviewLabourRate(currentLabourRate);
      setShowRequestForm(false);
      setRequestSuccess(false);
      setShowCustomExcess(false);
      setCustomExcess('');
      setCustomExcessError('');
      document.body.style.overflow = 'hidden';
      
      // Analytics: panel opened
      trackEvent('price_help_panel_opened');
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, currentExcess, currentClaimLimit, currentLabourRate]);

  // Calculate simple price preview (estimate based on typical adjustments)
  const estimatePriceChange = useCallback(() => {
    let change = 0;
    
    // Excess changes (higher excess = lower price)
    if (previewExcess !== originalExcess) {
      const excessDiff = previewExcess - originalExcess;
      change -= Math.floor(excessDiff / 50) * 2; // Rough estimate: £2/month per £50 excess
    }
    
    // Claim limit changes (lower limit = lower price)
    if (previewClaimLimit !== originalClaimLimit) {
      const limitDiff = previewClaimLimit - originalClaimLimit;
      change += Math.floor(limitDiff / 1000) * 3; // Rough estimate: £3/month per £1000 limit
    }
    
    // Labour rate changes (lower rate = lower price)
    if (previewLabourRate !== originalLabourRate) {
      const rateDiff = previewLabourRate - originalLabourRate;
      change += Math.floor(rateDiff / 25) * 2; // Rough estimate: £2/month per £25 rate
    }
    
    return change;
  }, [previewExcess, previewClaimLimit, previewLabourRate, originalExcess, originalClaimLimit, originalLabourRate]);

  const priceChange = estimatePriceChange();
  const hasChanges = previewExcess !== originalExcess || 
                     previewClaimLimit !== originalClaimLimit || 
                     previewLabourRate !== originalLabourRate;

  const handleExcessChange = (value: number) => {
    setPreviewExcess(value);
    setShowCustomExcess(false);
    setCustomExcess('');
    setCustomExcessError('');
    trackEvent('price_help_excess_changed', { value });
  };

  const handleCustomExcessSubmit = () => {
    const value = parseInt(customExcess, 10);
    if (isNaN(value) || value < 0 || value > 1000) {
      setCustomExcessError('Please enter a whole number between 0 and 1,000.');
      return;
    }
    setPreviewExcess(value);
    setCustomExcessError('');
    trackEvent('price_help_custom_excess', { value });
  };

  const handleClaimLimitChange = (option: ChipOption) => {
    if (!option.available) {
      setRequestedOption(`Claim Limit: ${option.label}`);
      setShowRequestForm(true);
      trackEvent('price_help_unavailable_option_clicked', { type: 'claim_limit', value: option.value });
      return;
    }
    setPreviewClaimLimit(option.value);
    trackEvent('price_help_claim_limit_changed', { value: option.value });
  };

  const handleLabourRateChange = (option: ChipOption) => {
    if (!option.available) {
      setRequestedOption(`Labour Rate: ${option.label}`);
      setShowRequestForm(true);
      trackEvent('price_help_unavailable_option_clicked', { type: 'labour_rate', value: option.value });
      return;
    }
    setPreviewLabourRate(option.value);
    trackEvent('price_help_labour_rate_changed', { value: option.value });
  };

  const handleApplyChanges = () => {
    onExcessChange(previewExcess);
    onClaimLimitChange(previewClaimLimit);
    onLabourRateChange(previewLabourRate);
    
    trackEvent('price_help_changes_applied', {
      excess: previewExcess,
      claimLimit: previewClaimLimit,
      labourRate: previewLabourRate,
    });
    
    toast({
      title: "Cover updated",
      description: "Your selections have been applied to your quote.",
    });
    onClose();
  };

  const handleReset = () => {
    setPreviewExcess(originalExcess);
    setPreviewClaimLimit(originalClaimLimit);
    setPreviewLabourRate(originalLabourRate);
    setShowCustomExcess(false);
    setCustomExcess('');
    setCustomExcessError('');
    trackEvent('price_help_reset');
  };

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-]/g, '');
    return /^(07\d{9}|(\+44|0044)7\d{9}|0[1-9]\d{8,9})$/.test(cleaned);
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!requestPhone.trim()) {
      toast({
        title: "Phone number required",
        description: "Please enter your mobile number.",
        variant: "destructive",
      });
      return;
    }
    
    if (!validatePhone(requestPhone)) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid UK phone number.",
        variant: "destructive",
      });
      return;
    }
    
    if (!requestEmail.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }
    
    if (!validateEmail(requestEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    
    if (!requestConsent) {
      toast({
        title: "Consent required",
        description: "Please confirm you agree to be contacted.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Get vehicle info from localStorage if available
      const vehicleData = JSON.parse(localStorage.getItem('vehicleData') || '{}');
      const quoteRef = localStorage.getItem('quoteReference') || `QR-${Date.now()}`;
      
      const { error } = await supabase
        .from('abandoned_carts')
        .insert({
          email: requestEmail.trim(),
          phone: requestPhone.trim(),
          step_abandoned: 3,
          contact_status: 'special_pricing_request',
          contact_notes: `Special Pricing Request - ${requestedOption}. ${requestMessage ? `Additional info: ${requestMessage}` : ''} Source: Price Pop Up Callback Request. Priority: High. Note: Customer requested a non-standard pricing option. Follow-up required.`,
          full_name: 'Special Pricing Request',
          vehicle_reg: vehicleData?.registration || null,
          vehicle_make: vehicleData?.make || null,
          vehicle_model: vehicleData?.model || null,
          vehicle_year: vehicleData?.year || null,
          cart_metadata: {
            requestedOption,
            quoteReference: quoteRef,
            source: 'Price Pop Up Callback Request',
            priority: 'High',
            category: 'Special Pricing Request',
            timestamp: new Date().toISOString(),
          }
        });

      if (error) throw error;

      trackEvent('price_help_callback_submitted', { requestedOption });
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

  const handleBackToAdjust = () => {
    setShowRequestForm(false);
    setRequestedOption('');
    setRequestPhone('');
    setRequestEmail('');
    setRequestMessage('');
    setRequestConsent(false);
    setRequestSuccess(false);
  };

  if (!isOpen && !isAnimating) return null;

  // Request Success State
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
        <div
          className={cn(
            "fixed z-50 bg-white transition-transform duration-300 ease-out",
            "hidden md:flex md:flex-col md:right-0 md:top-0 md:h-full md:w-[400px] md:shadow-2xl md:rounded-l-2xl",
            isOpen ? "md:translate-x-0" : "md:translate-x-full"
          )}
        >
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 bg-brand-green/10 rounded-full flex items-center justify-center">
                <Check className="w-10 h-10 text-brand-green" />
              </div>
              <Sparkles className="w-6 h-6 text-brand-orange absolute -top-1 -right-1 animate-bounce" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">All done, we're on it.</h3>
            <p className="text-gray-600 mb-8">We'll call you within one working day.<br />A confirmation has been sent to your email.</p>
            <Button
              onClick={onClose}
              className="px-8 h-12 bg-brand-green hover:bg-brand-green/90 text-white font-semibold rounded-xl"
            >
              Done
            </Button>
          </div>
        </div>
        {/* Mobile */}
        <div
          className={cn(
            "fixed z-50 md:hidden bg-white transition-transform duration-300 ease-out",
            "left-0 right-0 bottom-0 rounded-t-2xl shadow-2xl",
            isOpen ? "translate-y-0" : "translate-y-full"
          )}
        >
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 bg-brand-green/10 rounded-full flex items-center justify-center">
                <Check className="w-10 h-10 text-brand-green" />
              </div>
              <Sparkles className="w-6 h-6 text-brand-orange absolute -top-1 -right-1 animate-bounce" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">All done, we're on it.</h3>
            <p className="text-gray-600 mb-8">We'll call you within one working day.</p>
            <Button
              onClick={onClose}
              className="w-full px-8 h-12 bg-brand-green hover:bg-brand-green/90 text-white font-semibold rounded-xl"
            >
              Done
            </Button>
          </div>
        </div>
      </>
    );
  }

  // Request Form View
  if (showRequestForm) {
    return (
      <>
        <div
          className={cn(
            "fixed inset-0 bg-black/50 z-50 transition-opacity duration-300",
            isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={onClose}
        />
        
        {/* Desktop Panel */}
        <div
          className={cn(
            "fixed z-50 bg-white transition-transform duration-300 ease-out",
            "hidden md:flex md:flex-col md:right-0 md:top-0 md:h-full md:w-[400px] md:shadow-2xl md:rounded-l-2xl",
            isOpen ? "md:translate-x-0" : "md:translate-x-full"
          )}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <button
              onClick={handleBackToAdjust}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              Back
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              aria-label="Close pricing help panel"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            <RequestCallbackForm
              requestedOption={requestedOption}
              phone={requestPhone}
              setPhone={setRequestPhone}
              email={requestEmail}
              setEmail={setRequestEmail}
              message={requestMessage}
              setMessage={setRequestMessage}
              consent={requestConsent}
              setConsent={setRequestConsent}
              onSubmit={handleRequestSubmit}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>

        {/* Mobile Bottom Sheet */}
        <div
          className={cn(
            "fixed z-50 md:hidden bg-white transition-transform duration-300 ease-out",
            "left-0 right-0 bottom-0 rounded-t-2xl shadow-2xl max-h-[90vh] overflow-hidden",
            isOpen ? "translate-y-0" : "translate-y-full"
          )}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <button
              onClick={handleBackToAdjust}
              className="flex items-center gap-2 text-sm text-gray-600"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              Back
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          <div className="overflow-y-auto p-5 max-h-[calc(90vh-100px)]">
            <RequestCallbackForm
              requestedOption={requestedOption}
              phone={requestPhone}
              setPhone={setRequestPhone}
              email={requestEmail}
              setEmail={setRequestEmail}
              message={requestMessage}
              setMessage={setRequestMessage}
              consent={requestConsent}
              setConsent={setRequestConsent}
              onSubmit={handleRequestSubmit}
              isSubmitting={isSubmitting}
              isMobile
            />
          </div>
        </div>
      </>
    );
  }

  // Main Adjust Cover View
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
          "hidden md:flex md:flex-col md:right-0 md:top-0 md:h-full md:w-[400px] md:shadow-2xl md:rounded-l-2xl",
          isOpen ? "md:translate-x-0" : "md:translate-x-full"
        )}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 pr-4">
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                Want a lower price? Adjust your cover in seconds.
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
          <p className="text-sm text-gray-500">
            Choose from the available options or request something different.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 pb-32">
          <AdjustCoverContent
            previewExcess={previewExcess}
            previewClaimLimit={previewClaimLimit}
            previewLabourRate={previewLabourRate}
            showCustomExcess={showCustomExcess}
            customExcess={customExcess}
            customExcessError={customExcessError}
            onExcessChange={handleExcessChange}
            onClaimLimitChange={handleClaimLimitChange}
            onLabourRateChange={handleLabourRateChange}
            onShowCustomExcess={() => setShowCustomExcess(true)}
            onCustomExcessChange={setCustomExcess}
            onCustomExcessSubmit={handleCustomExcessSubmit}
          />
        </div>

        {/* Sticky Footer */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
          <LivePriceSummary
            currentPrice={currentMonthlyPrice}
            priceChange={priceChange}
            hasChanges={hasChanges}
            onReset={handleReset}
            onApply={handleApplyChanges}
          />
        </div>
      </div>

      {/* Mobile Bottom Sheet */}
      <div
        className={cn(
          "fixed z-50 md:hidden bg-white transition-transform duration-300 ease-out",
          "left-0 right-0 bottom-0 rounded-t-2xl shadow-2xl max-h-[90vh] overflow-hidden",
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
            <h2 className="text-base font-bold text-gray-900 pr-4 leading-tight">
              Want a lower price? Adjust your cover.
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Choose available options or request something different.
          </p>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 pb-40 max-h-[calc(90vh-180px)]">
          <AdjustCoverContent
            previewExcess={previewExcess}
            previewClaimLimit={previewClaimLimit}
            previewLabourRate={previewLabourRate}
            showCustomExcess={showCustomExcess}
            customExcess={customExcess}
            customExcessError={customExcessError}
            onExcessChange={handleExcessChange}
            onClaimLimitChange={handleClaimLimitChange}
            onLabourRateChange={handleLabourRateChange}
            onShowCustomExcess={() => setShowCustomExcess(true)}
            onCustomExcessChange={setCustomExcess}
            onCustomExcessSubmit={handleCustomExcessSubmit}
            isMobile
          />
        </div>

        {/* Sticky Footer */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
          <LivePriceSummary
            currentPrice={currentMonthlyPrice}
            priceChange={priceChange}
            hasChanges={hasChanges}
            onReset={handleReset}
            onApply={handleApplyChanges}
            isMobile
          />
        </div>
      </div>
    </>
  );
};

// ============ SUBCOMPONENTS ============

interface AdjustCoverContentProps {
  previewExcess: number;
  previewClaimLimit: number;
  previewLabourRate: number;
  showCustomExcess: boolean;
  customExcess: string;
  customExcessError: string;
  onExcessChange: (value: number) => void;
  onClaimLimitChange: (option: ChipOption) => void;
  onLabourRateChange: (option: ChipOption) => void;
  onShowCustomExcess: () => void;
  onCustomExcessChange: (value: string) => void;
  onCustomExcessSubmit: () => void;
  isMobile?: boolean;
}

const AdjustCoverContent: React.FC<AdjustCoverContentProps> = ({
  previewExcess,
  previewClaimLimit,
  previewLabourRate,
  showCustomExcess,
  customExcess,
  customExcessError,
  onExcessChange,
  onClaimLimitChange,
  onLabourRateChange,
  onShowCustomExcess,
  onCustomExcessChange,
  onCustomExcessSubmit,
  isMobile,
}) => {
  return (
    <div className="space-y-6">
      {/* Voluntary Excess Section */}
      <section className="space-y-3">
        <div>
          <Label className="text-sm font-semibold text-gray-900">Voluntary excess</Label>
          <p className="text-xs text-gray-500 mt-0.5">
            A higher excess reduces your monthly price but increases what you pay if you make a claim.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXCESS_OPTIONS.map((option) => (
            <ChipButton
              key={option.value}
              selected={previewExcess === option.value && !showCustomExcess}
              onClick={() => onExcessChange(option.value)}
              label={option.label}
            />
          ))}
          <ChipButton
            selected={showCustomExcess || !EXCESS_OPTIONS.some(o => o.value === previewExcess)}
            onClick={onShowCustomExcess}
            label="Other"
            variant="outline"
          />
        </div>
        {showCustomExcess && (
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <Input
                type="number"
                value={customExcess}
                onChange={(e) => onCustomExcessChange(e.target.value)}
                placeholder="Enter amount (£0-£1,000)"
                className={cn(
                  "h-11 rounded-lg",
                  customExcessError && "border-red-400 focus:ring-red-400"
                )}
                min={0}
                max={1000}
                onKeyDown={(e) => e.key === 'Enter' && onCustomExcessSubmit()}
              />
              {customExcessError && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {customExcessError}
                </p>
              )}
            </div>
            <Button
              onClick={onCustomExcessSubmit}
              className="h-11 px-4 bg-brand-green hover:bg-brand-green/90 text-white rounded-lg"
            >
              Apply
            </Button>
          </div>
        )}
      </section>

      {/* Claim Limit Section */}
      <section className="space-y-3">
        <div>
          <Label className="text-sm font-semibold text-gray-900">Claim limit</Label>
          <p className="text-xs text-gray-500 mt-0.5">
            This is the maximum amount we'll pay per claim. Most customers choose between £3,000 and £5,000.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CLAIM_LIMIT_OPTIONS.map((option) => (
            <ChipButton
              key={option.value}
              selected={previewClaimLimit === option.value}
              onClick={() => onClaimLimitChange(option)}
              label={option.label}
              available={option.available}
              unavailableLabel="Request"
            />
          ))}
        </div>
        {previewClaimLimit >= 5000 && (
          <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            £5,000 is the highest claim limit available online. If you need more, request a custom limit and our team will help.
          </p>
        )}
      </section>

      {/* Labour Rate Section */}
      <section className="space-y-3">
        <div>
          <Label className="text-sm font-semibold text-gray-900">Labour rate</Label>
          <p className="text-xs text-gray-500 mt-0.5">
            Match the hourly labour rate charged by your usual garage.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {LABOUR_RATE_OPTIONS.map((option) => (
            <ChipButton
              key={option.value}
              selected={previewLabourRate === option.value}
              onClick={() => onLabourRateChange(option)}
              label={option.label}
              available={option.available}
              unavailableLabel="Request"
            />
          ))}
        </div>
        {previewLabourRate >= 200 && (
          <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            £200/hr is the highest labour rate available online. If your garage charges more, request a custom rate.
          </p>
        )}
      </section>
    </div>
  );
};

interface ChipButtonProps {
  selected: boolean;
  onClick: () => void;
  label: string;
  available?: boolean;
  unavailableLabel?: string;
  variant?: 'default' | 'outline';
}

const ChipButton: React.FC<ChipButtonProps> = ({
  selected,
  onClick,
  label,
  available = true,
  unavailableLabel,
  variant = 'default',
}) => {
  if (!available) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "px-3 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px]",
          "bg-gray-100/60 text-gray-400 border border-dashed border-gray-300",
          "hover:bg-gray-100 hover:border-gray-400 hover:text-gray-500",
          "flex flex-col items-center gap-0.5"
        )}
        aria-label={`${label} - Not available, click to request this option`}
      >
        <span className="line-through">{label}</span>
        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
          <Lock className="w-2.5 h-2.5" />
          {unavailableLabel || 'Request'}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px]",
        selected
          ? "bg-brand-green text-white shadow-md shadow-brand-green/20"
          : variant === 'outline'
            ? "bg-white text-gray-600 border border-gray-200 hover:border-brand-green/40 hover:text-brand-green"
            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      )}
    >
      {label}
    </button>
  );
};

interface LivePriceSummaryProps {
  currentPrice: number;
  priceChange: number;
  hasChanges: boolean;
  onReset: () => void;
  onApply: () => void;
  isMobile?: boolean;
}

const LivePriceSummary: React.FC<LivePriceSummaryProps> = ({
  currentPrice,
  priceChange,
  hasChanges,
  onReset,
  onApply,
  isMobile,
}) => {
  return (
    <div className="space-y-3">
      {/* Price Display */}
      <div 
        className="flex items-center justify-between"
        role="status"
        aria-live="polite"
        aria-label={`Your updated price is now £${currentPrice} per month`}
      >
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Your updated price</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">£{currentPrice}</span>
            <span className="text-sm text-gray-500">/month</span>
          </div>
        </div>
        {hasChanges && priceChange !== 0 && (
          <div className={cn(
            "px-2.5 py-1 rounded-full text-xs font-semibold",
            priceChange < 0 ? "bg-brand-green/10 text-brand-green" : "bg-amber-100 text-amber-700"
          )}>
            {priceChange < 0 ? `Save ~£${Math.abs(priceChange)}/mo` : `+£${priceChange}/mo`}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        {hasChanges && (
          <Button
            variant="outline"
            onClick={onReset}
            className="h-12 px-4 rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Reset
          </Button>
        )}
        <Button
          onClick={onApply}
          disabled={!hasChanges}
          className={cn(
            "flex-1 h-12 rounded-xl font-semibold transition-all",
            hasChanges
              ? "bg-brand-orange hover:bg-brand-orange/90 text-white shadow-lg shadow-brand-orange/25"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          )}
        >
          Apply changes
        </Button>
      </div>
    </div>
  );
};

interface RequestCallbackFormProps {
  requestedOption: string;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  message: string;
  setMessage: (v: string) => void;
  consent: boolean;
  setConsent: (v: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  isMobile?: boolean;
}

const RequestCallbackForm: React.FC<RequestCallbackFormProps> = ({
  requestedOption,
  phone,
  setPhone,
  email,
  setEmail,
  message,
  setMessage,
  consent,
  setConsent,
  onSubmit,
  isSubmitting,
  isMobile,
}) => {
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-brand-green/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <Phone className="w-7 h-7 text-brand-green" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Request a call back</h3>
        <p className="text-sm text-gray-500">
          We'll call you to discuss your options and help find the best cover for your vehicle.
        </p>
      </div>

      {/* Requested Option */}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold text-gray-800">Requested option</Label>
        <div className="h-11 px-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center text-gray-700">
          {requestedOption}
        </div>
      </div>

      {/* Phone */}
      <div className="space-y-1.5">
        <Label htmlFor="request-phone" className="text-sm font-semibold text-gray-800">
          Phone number <span className="text-red-500">*</span>
        </Label>
        <Input
          id="request-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Enter your mobile number"
          className="h-12 rounded-lg"
          disabled={isSubmitting}
          autoComplete="tel"
        />
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="request-email" className="text-sm font-semibold text-gray-800">
          Email address <span className="text-red-500">*</span>
        </Label>
        <Input
          id="request-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email address"
          className="h-12 rounded-lg"
          disabled={isSubmitting}
          autoComplete="email"
        />
      </div>

      {/* Additional Info */}
      <div className="space-y-1.5">
        <Label htmlFor="request-message" className="text-sm font-semibold text-gray-800">
          Additional information <span className="text-gray-400 font-normal">(optional)</span>
        </Label>
        <Textarea
          id="request-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us anything else"
          className="rounded-lg resize-none"
          rows={3}
          disabled={isSubmitting}
        />
      </div>

      {/* Consent */}
      <div className="flex items-start gap-3">
        <Checkbox
          id="request-consent"
          checked={consent}
          onCheckedChange={(checked) => setConsent(checked === true)}
          disabled={isSubmitting}
          className="mt-0.5"
        />
        <Label htmlFor="request-consent" className="text-sm text-gray-600 cursor-pointer leading-relaxed">
          I agree to be contacted about my quote.
        </Label>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-12 bg-brand-orange hover:bg-brand-orange/90 text-white font-semibold rounded-xl shadow-lg shadow-brand-orange/25 disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Submitting...
          </>
        ) : (
          'Request my call back'
        )}
      </Button>
    </form>
  );
};

export default PriceHelpPanel;
