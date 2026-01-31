import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, Phone, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

// Preference chips - NOT live pricing, just user preference capture
const EXCESS_OPTIONS = [
  { value: 200, label: '£200' },
  { value: 350, label: '£350' },
  { value: 500, label: '£500' },
];

const CLAIM_LIMIT_OPTIONS = [
  { value: 7000, label: '£7,000' },
  { value: 10000, label: '£10,000' },
];

const LABOUR_RATE_OPTIONS = [
  { value: 250, label: '£250/hr' },
];

const COVER_LEVEL_OPTIONS = [
  { value: 'basic', label: 'Basic' },
  { value: 'standard', label: 'Standard' },
  { value: 'comprehensive', label: 'Comprehensive' },
  { value: 'not_sure', label: 'Not sure' },
];

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

  // Selected preferences state
  const [selectedExcess, setSelectedExcess] = useState<number | null>(null);
  const [selectedClaimLimit, setSelectedClaimLimit] = useState<number | null>(null);
  const [selectedLabourRate, setSelectedLabourRate] = useState<number | null>(null);

  // Request form state
  const [requestPhone, setRequestPhone] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [competitorPrice, setCompetitorPrice] = useState('');
  const [competitorCoverLevel, setCompetitorCoverLevel] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [requestConsent, setRequestConsent] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);

  // Reset state when panel opens
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setSelectedExcess(null);
      setSelectedClaimLimit(null);
      setSelectedLabourRate(null);
      setRequestPhone('');
      setRequestEmail('');
      setCompetitorPrice('');
      setCompetitorCoverLevel('');
      setRequestMessage('');
      setRequestConsent(true);
      setRequestSuccess(false);
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
    if (selectedExcess) parts.push(`Excess: £${selectedExcess}`);
    if (selectedClaimLimit) parts.push(`Claim Limit: £${selectedClaimLimit.toLocaleString()}`);
    if (selectedLabourRate) parts.push(`Labour Rate: £${selectedLabourRate}/hr`);
    if (competitorPrice) parts.push(`Competitor Price: £${competitorPrice}`);
    if (competitorCoverLevel) {
      const levelLabel = COVER_LEVEL_OPTIONS.find(o => o.value === competitorCoverLevel)?.label || competitorCoverLevel;
      parts.push(`Competitor Cover: ${levelLabel}`);
    }
    return parts.length > 0 ? parts.join(', ') : 'Custom quote request';
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
    
    // Email is optional - only validate if provided
    if (requestEmail.trim() && !validateEmail(requestEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const vehicleData = JSON.parse(localStorage.getItem('vehicleData') || '{}');
      const quoteRef = localStorage.getItem('quoteReference') || `QR-${Date.now()}`;
      const requestedOptions = getRequestedOptionsString();
      
      const { error } = await supabase
        .from('abandoned_carts')
        .insert({
          email: requestEmail.trim(),
          phone: requestPhone.trim(),
          step_abandoned: 3,
          contact_status: 'special_pricing_request',
          contact_notes: `Price Match Request - ${requestedOptions}. ${competitorPrice ? `Competitor quoted £${competitorPrice}.` : ''} ${requestMessage ? `Additional info: ${requestMessage}` : ''} Source: Price Pop Up Callback Request. Priority: High. Note: Customer requested customised pricing. Guarantee to beat any like-for-like quote. Follow-up required.`,
          full_name: 'Price Match Request',
          vehicle_reg: vehicleData?.registration || null,
          vehicle_make: vehicleData?.make || null,
          vehicle_model: vehicleData?.model || null,
          vehicle_year: vehicleData?.year || null,
          cart_metadata: {
            requestedOptions,
            selectedExcess,
            selectedClaimLimit,
            selectedLabourRate,
            competitorPrice: competitorPrice || null,
            competitorCoverLevel: competitorCoverLevel || null,
            currentExcess,
            currentClaimLimit,
            currentLabourRate,
            currentMonthlyPrice,
            quoteReference: quoteRef,
            source: 'Price Pop Up Callback Request',
            priority: 'High',
            category: 'Special Pricing Request',
            timestamp: new Date().toISOString(),
          }
        });

      if (error) throw error;

      trackEvent('price_help_callback_submitted', { requestedOptions });
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
              Thank you. We are preparing your quote. ⭐
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
              Thank you. We are preparing your quote. ⭐
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
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-orange flex-shrink-0" />
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
            Tell us what you have been quoted or what cover you want. We will call you back with a personalised price and beat any like-for-like quote.
          </p>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 pb-8">
          {/* Competitor Quote Section */}
          <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-sm font-semibold text-gray-900 mb-3">Got a quote elsewhere?</p>
            <div className="space-y-1.5">
              <Label htmlFor="quote-details" className="text-sm font-medium text-gray-700">
                Details about your quote <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                id="quote-details"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Tell us what the quote includes, such as cover, parts, mileage, exclusions or anything else."
                className="rounded-xl resize-none border-gray-200"
                rows={4}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Quote Box */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-gray-900 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-gray-900 leading-relaxed">
                We can't show a price instantly. Request a call back for a personalised quote that beats any quote.
              </p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="space-y-4">
            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="request-phone" className="text-sm font-semibold text-gray-800">
                Phone number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="request-phone"
                type="tel"
                value={requestPhone}
                onChange={(e) => setRequestPhone(e.target.value)}
                placeholder="Enter your mobile number"
                className="h-12 rounded-xl border-gray-200"
                disabled={isSubmitting}
                autoComplete="tel"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="request-email" className="text-sm font-semibold text-gray-800">
                Email <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="request-email"
                type="email"
                value={requestEmail}
                onChange={(e) => setRequestEmail(e.target.value)}
                placeholder="Enter your email address"
                className="h-12 rounded-xl border-gray-200"
                disabled={isSubmitting}
                autoComplete="email"
              />
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-6 space-y-3">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-brand-orange text-white font-bold text-lg rounded-full shadow-lg shadow-brand-orange/25 disabled:opacity-50 animate-breathing"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Request a call back'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="w-full h-11 text-gray-500 hover:text-gray-700"
            >
              Cancel
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
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-orange flex-shrink-0" />
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
            Tell us what you have been quoted or what cover you want. We will call you back with a personalised price.
          </p>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 max-h-[calc(92vh-100px)]">
          {/* Competitor Quote Section */}
          <div className="mb-5 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-sm font-semibold text-gray-900 mb-2">Got a quote elsewhere?</p>
            <div className="space-y-1">
              <Label htmlFor="mobile-quote-details" className="text-xs font-medium text-gray-700">
                Details about your quote <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                id="mobile-quote-details"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Tell us what the quote includes, such as cover, parts, mileage, exclusions or anything else."
                className="rounded-xl resize-none border-gray-200 text-sm"
                rows={3}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Quote Box */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-5">
            <div className="flex items-start gap-2">
              <Phone className="w-4 h-4 text-gray-900 flex-shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-gray-900 leading-relaxed">
                We can't show a price instantly. Request a call back for a personalised quote that beats any quote.
              </p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="space-y-3">
            {/* Phone */}
            <div className="space-y-1">
              <Label htmlFor="mobile-phone" className="text-sm font-semibold text-gray-800">
                Phone number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="mobile-phone"
                type="tel"
                value={requestPhone}
                onChange={(e) => setRequestPhone(e.target.value)}
                placeholder="Enter your mobile number"
                className="h-11 rounded-xl border-gray-200"
                disabled={isSubmitting}
                autoComplete="tel"
              />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <Label htmlFor="mobile-email" className="text-sm font-semibold text-gray-800">
                Email <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="mobile-email"
                type="email"
                value={requestEmail}
                onChange={(e) => setRequestEmail(e.target.value)}
                placeholder="Enter your email address"
                className="h-11 rounded-xl border-gray-200"
                disabled={isSubmitting}
                autoComplete="email"
              />
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-5 space-y-2 pb-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-brand-orange text-white font-bold text-lg rounded-full shadow-lg shadow-brand-orange/25 disabled:opacity-50 animate-breathing"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Request a call back'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="w-full h-10 text-gray-500 hover:text-gray-700 text-sm"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </>
  );
};

// Preference Chip Component
interface PreferenceChipProps {
  selected: boolean;
  onClick: () => void;
  label: string;
  compact?: boolean;
}

const PreferenceChip: React.FC<PreferenceChipProps> = ({ selected, onClick, label, compact = false }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl text-sm font-semibold transition-all border-2",
        compact ? "px-3 py-2 min-h-[40px] min-w-[70px]" : "px-4 py-3 min-h-[48px] min-w-[80px]",
        selected
          ? "bg-brand-orange text-white border-brand-orange shadow-md shadow-brand-orange/25"
          : "bg-white text-gray-700 border-gray-200 hover:border-brand-orange/50 hover:bg-brand-orange/5"
      )}
    >
      {label}
    </button>
  );
};

export default PriceHelpPanel;
