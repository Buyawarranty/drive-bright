import React, { useState, useEffect } from 'react';
import { X, ChevronRight, Phone, Upload, Link, Check, Loader2, Sliders, Scale, MessageCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

type TabType = 'adjust' | 'price-match' | 'speak';

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
  const [activeTab, setActiveTab] = useState<TabType>('adjust');
  const [isAnimating, setIsAnimating] = useState(false);

  // Price match form state
  const [competitorName, setCompetitorName] = useState('');
  const [competitorPrice, setCompetitorPrice] = useState('');
  const [competitorLink, setCompetitorLink] = useState('');
  const [priceMatchSubmitting, setPriceMatchSubmitting] = useState(false);
  const [priceMatchSuccess, setPriceMatchSuccess] = useState(false);

  // Callback form state
  const [callbackPhone, setCallbackPhone] = useState('');
  const [callbackSubmitting, setCallbackSubmitting] = useState(false);
  const [callbackSuccess, setCallbackSuccess] = useState(false);

  // Local state for adjustments preview
  const [previewExcess, setPreviewExcess] = useState(currentExcess || 100);
  const [previewClaimLimit, setPreviewClaimLimit] = useState(currentClaimLimit || 1250);
  const [previewLabourRate, setPreviewLabourRate] = useState(currentLabourRate);

  // Update preview state when props change
  useEffect(() => {
    if (isOpen) {
      setPreviewExcess(currentExcess || 100);
      setPreviewClaimLimit(currentClaimLimit || 1250);
      setPreviewLabourRate(currentLabourRate);
    }
  }, [isOpen, currentExcess, currentClaimLimit, currentLabourRate]);

  // Handle open/close animation
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleApplyChanges = () => {
    onExcessChange(previewExcess);
    onClaimLimitChange(previewClaimLimit);
    onLabourRateChange(previewLabourRate);
    toast({
      title: "Settings updated",
      description: "Your cover options have been applied.",
    });
    onClose();
  };

  const validateUKPhone = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-]/g, '');
    const ukMobilePattern = /^(07\d{9}|(\+44|0044)7\d{9})$/;
    const ukLandlinePattern = /^(0[1-9]\d{8,9}|(\+44|0044)[1-9]\d{8,9})$/;
    return ukMobilePattern.test(cleaned) || ukLandlinePattern.test(cleaned);
  };

  const handlePriceMatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!competitorName.trim() || !competitorPrice.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter the competitor name and price.",
        variant: "destructive",
      });
      return;
    }

    setPriceMatchSubmitting(true);
    try {
      const { error } = await supabase
        .from('abandoned_carts')
        .insert({
          email: '',
          phone: '',
          step_abandoned: 3,
          contact_status: 'price_match_request',
          contact_notes: `Price Match Request - Competitor: ${competitorName}, Price: £${competitorPrice}, Link: ${competitorLink || 'Not provided'}`,
          full_name: 'Price Match Request',
        });

      if (error) throw error;

      setPriceMatchSuccess(true);
      toast({
        title: "Request submitted",
        description: "We'll review your price match and get back to you.",
      });

      setTimeout(() => {
        setPriceMatchSuccess(false);
        setCompetitorName('');
        setCompetitorPrice('');
        setCompetitorLink('');
        onClose();
      }, 2500);
    } catch (err) {
      console.error('Price match submit error:', err);
      toast({
        title: "Something went wrong",
        description: "Please try again or call us on 0800 494 7477",
        variant: "destructive",
      });
    } finally {
      setPriceMatchSubmitting(false);
    }
  };

  const handleCallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callbackPhone.trim()) {
      toast({
        title: "Phone number required",
        description: "Please enter your phone number.",
        variant: "destructive",
      });
      return;
    }

    if (!validateUKPhone(callbackPhone)) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid UK phone number.",
        variant: "destructive",
      });
      return;
    }

    setCallbackSubmitting(true);
    try {
      const { error } = await supabase
        .from('abandoned_carts')
        .insert({
          phone: callbackPhone.trim(),
          email: '',
          step_abandoned: 3,
          contact_status: 'urgent_callback',
          contact_notes: 'Urgent Callback - Requested from pricing page help panel',
          full_name: 'Callback Request',
        });

      if (error) throw error;

      setCallbackSuccess(true);
      toast({
        title: "Request received",
        description: "We'll call you back shortly.",
      });

      setTimeout(() => {
        setCallbackSuccess(false);
        setCallbackPhone('');
        onClose();
      }, 2500);
    } catch (err) {
      console.error('Callback submit error:', err);
      toast({
        title: "Something went wrong",
        description: "Please try again or call us on 0800 494 7477",
        variant: "destructive",
      });
    } finally {
      setCallbackSubmitting(false);
    }
  };

  if (!isOpen && !isAnimating) return null;

  const excessOptions = [50, 100, 200, 350, 500];
  const claimLimitOptions = [1250, 2000, 3000, 5000, 7500, 10000];
  const labourRateOptions = [50, 70, 100, 200];

  const tabs = [
    { id: 'adjust' as TabType, label: 'Adjust your cover', icon: Sliders },
    { id: 'price-match' as TabType, label: 'Price match', icon: Scale },
    { id: 'speak' as TabType, label: 'Speak to us', icon: MessageCircle },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 z-50 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        onTransitionEnd={() => !isOpen && setIsAnimating(false)}
      />

      {/* Panel - Desktop: slide from right, Mobile: bottom sheet */}
      <div
        className={cn(
          "fixed z-50 bg-white transition-transform duration-300 ease-out",
          // Desktop: right slide-in panel
          "hidden md:flex md:flex-col md:right-0 md:top-0 md:h-full md:w-[420px] md:shadow-2xl md:rounded-l-2xl",
          isOpen ? "md:translate-x-0" : "md:translate-x-full"
        )}
      >
        {/* Desktop Panel Content */}
        <div className="hidden md:flex md:flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Need help with your price?</h2>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 py-3 px-2 text-xs font-medium transition-all relative",
                  activeTab === tab.id
                    ? "text-brand-green"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </div>
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand-green rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'adjust' && (
              <AdjustCoverTab
                previewExcess={previewExcess}
                setPreviewExcess={setPreviewExcess}
                previewClaimLimit={previewClaimLimit}
                setPreviewClaimLimit={setPreviewClaimLimit}
                previewLabourRate={previewLabourRate}
                setPreviewLabourRate={setPreviewLabourRate}
                excessOptions={excessOptions}
                claimLimitOptions={claimLimitOptions}
                labourRateOptions={labourRateOptions}
                onApply={handleApplyChanges}
                currentMonthlyPrice={currentMonthlyPrice}
              />
            )}

            {activeTab === 'price-match' && (
              <PriceMatchTab
                competitorName={competitorName}
                setCompetitorName={setCompetitorName}
                competitorPrice={competitorPrice}
                setCompetitorPrice={setCompetitorPrice}
                competitorLink={competitorLink}
                setCompetitorLink={setCompetitorLink}
                onSubmit={handlePriceMatchSubmit}
                isSubmitting={priceMatchSubmitting}
                isSuccess={priceMatchSuccess}
              />
            )}

            {activeTab === 'speak' && (
              <SpeakToUsTab
                callbackPhone={callbackPhone}
                setCallbackPhone={setCallbackPhone}
                onSubmit={handleCallbackSubmit}
                isSubmitting={callbackSubmitting}
                isSuccess={callbackSuccess}
              />
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Sheet */}
      <div
        className={cn(
          "fixed z-50 md:hidden bg-white transition-transform duration-300 ease-out",
          "left-0 right-0 bottom-0 rounded-t-2xl shadow-2xl max-h-[85vh] overflow-hidden",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Need help with your price?</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 py-3 px-1 text-[11px] font-medium transition-all relative",
                activeTab === tab.id
                  ? "text-brand-green"
                  : "text-gray-500"
              )}
            >
              <div className="flex flex-col items-center gap-1">
                <tab.icon className="w-4 h-4" />
                <span className="leading-tight">{tab.label}</span>
              </div>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand-green rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="overflow-y-auto p-5 max-h-[calc(85vh-140px)]">
          {activeTab === 'adjust' && (
            <AdjustCoverTab
              previewExcess={previewExcess}
              setPreviewExcess={setPreviewExcess}
              previewClaimLimit={previewClaimLimit}
              setPreviewClaimLimit={setPreviewClaimLimit}
              previewLabourRate={previewLabourRate}
              setPreviewLabourRate={setPreviewLabourRate}
              excessOptions={excessOptions}
              claimLimitOptions={claimLimitOptions}
              labourRateOptions={labourRateOptions}
              onApply={handleApplyChanges}
              currentMonthlyPrice={currentMonthlyPrice}
              isMobile
            />
          )}

          {activeTab === 'price-match' && (
            <PriceMatchTab
              competitorName={competitorName}
              setCompetitorName={setCompetitorName}
              competitorPrice={competitorPrice}
              setCompetitorPrice={setCompetitorPrice}
              competitorLink={competitorLink}
              setCompetitorLink={setCompetitorLink}
              onSubmit={handlePriceMatchSubmit}
              isSubmitting={priceMatchSubmitting}
              isSuccess={priceMatchSuccess}
              isMobile
            />
          )}

          {activeTab === 'speak' && (
            <SpeakToUsTab
              callbackPhone={callbackPhone}
              setCallbackPhone={setCallbackPhone}
              onSubmit={handleCallbackSubmit}
              isSubmitting={callbackSubmitting}
              isSuccess={callbackSuccess}
              isMobile
            />
          )}
        </div>
      </div>
    </>
  );
};

// ============ TAB COMPONENTS ============

interface AdjustCoverTabProps {
  previewExcess: number;
  setPreviewExcess: (v: number) => void;
  previewClaimLimit: number;
  setPreviewClaimLimit: (v: number) => void;
  previewLabourRate: number;
  setPreviewLabourRate: (v: number) => void;
  excessOptions: number[];
  claimLimitOptions: number[];
  labourRateOptions: number[];
  onApply: () => void;
  currentMonthlyPrice: number;
  isMobile?: boolean;
}

const AdjustCoverTab: React.FC<AdjustCoverTabProps> = ({
  previewExcess,
  setPreviewExcess,
  previewClaimLimit,
  setPreviewClaimLimit,
  previewLabourRate,
  setPreviewLabourRate,
  excessOptions,
  claimLimitOptions,
  labourRateOptions,
  onApply,
  currentMonthlyPrice,
  isMobile,
}) => {
  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600 leading-relaxed">
        Adjusting your excess or claim limit can lower your price without removing essential protection.
      </p>

      {/* Excess */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-gray-800">Voluntary excess</Label>
        <div className="flex flex-wrap gap-2">
          {excessOptions.map((excess) => (
            <button
              key={excess}
              onClick={() => setPreviewExcess(excess)}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-all min-w-[60px]",
                previewExcess === excess
                  ? "bg-brand-green text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              £{excess}
            </button>
          ))}
        </div>
      </div>

      {/* Claim Limit */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-gray-800">Claim limit</Label>
        <div className="flex flex-wrap gap-2">
          {claimLimitOptions.map((limit) => (
            <button
              key={limit}
              onClick={() => setPreviewClaimLimit(limit)}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                previewClaimLimit === limit
                  ? "bg-brand-green text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              £{limit.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {/* Labour Rate */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-gray-800">Labour rate</Label>
        <div className="flex flex-wrap gap-2">
          {labourRateOptions.map((rate) => (
            <button
              key={rate}
              onClick={() => setPreviewLabourRate(rate)}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                previewLabourRate === rate
                  ? "bg-brand-green text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              £{rate}/hr
            </button>
          ))}
        </div>
      </div>

      {/* Price Preview */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Your current price</span>
          <span className="text-xl font-bold text-brand-green">£{currentMonthlyPrice}/mo</span>
        </div>
      </div>

      {/* Apply Button */}
      <Button
        onClick={onApply}
        className="w-full h-12 bg-brand-orange hover:bg-brand-orange/90 text-white font-bold rounded-xl shadow-lg shadow-brand-orange/25"
      >
        Apply changes
      </Button>
    </div>
  );
};

interface PriceMatchTabProps {
  competitorName: string;
  setCompetitorName: (v: string) => void;
  competitorPrice: string;
  setCompetitorPrice: (v: string) => void;
  competitorLink: string;
  setCompetitorLink: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  isSuccess: boolean;
  isMobile?: boolean;
}

const PriceMatchTab: React.FC<PriceMatchTabProps> = ({
  competitorName,
  setCompetitorName,
  competitorPrice,
  setCompetitorPrice,
  competitorLink,
  setCompetitorLink,
  onSubmit,
  isSubmitting,
  isSuccess,
  isMobile,
}) => {
  if (isSuccess) {
    return (
      <div className="py-10 text-center space-y-4 animate-in fade-in-0 zoom-in-95 duration-300">
        <div className="relative inline-block">
          <Check className="w-14 h-14 text-brand-green mx-auto" />
          <Sparkles className="w-5 h-5 text-brand-orange absolute -top-1 -right-1 animate-bounce" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-gray-900">Request submitted</h3>
          <p className="text-gray-600 text-sm">We'll review your quote and get back to you.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-gray-600 leading-relaxed">
        Found a cheaper quote? Share it with us and we'll see what we can do.
      </p>

      {/* Rule chips */}
      <div className="flex flex-wrap gap-2">
        {['UK providers only', 'Like-for-like cover', 'Quote within 14 days'].map((rule) => (
          <span
            key={rule}
            className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full"
          >
            {rule}
          </span>
        ))}
      </div>

      {/* Competitor Name */}
      <div className="space-y-1.5">
        <Label htmlFor="competitor-name" className="text-sm font-semibold text-gray-800">
          Competitor name
        </Label>
        <Input
          id="competitor-name"
          value={competitorName}
          onChange={(e) => setCompetitorName(e.target.value)}
          placeholder="e.g. AA Warranty"
          className="h-11 rounded-lg"
          disabled={isSubmitting}
        />
      </div>

      {/* Price */}
      <div className="space-y-1.5">
        <Label htmlFor="competitor-price" className="text-sm font-semibold text-gray-800">
          Their price (£)
        </Label>
        <Input
          id="competitor-price"
          type="number"
          value={competitorPrice}
          onChange={(e) => setCompetitorPrice(e.target.value)}
          placeholder="e.g. 450"
          className="h-11 rounded-lg"
          disabled={isSubmitting}
        />
      </div>

      {/* Link */}
      <div className="space-y-1.5">
        <Label htmlFor="competitor-link" className="text-sm font-semibold text-gray-800">
          Link to quote (optional)
        </Label>
        <div className="relative">
          <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            id="competitor-link"
            value={competitorLink}
            onChange={(e) => setCompetitorLink(e.target.value)}
            placeholder="https://"
            className="h-11 rounded-lg pl-9"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Note */}
      <p className="text-xs text-gray-500">
        We'll review your price match and reply as soon as possible.
      </p>

      {/* Submit */}
      <Button
        type="submit"
        disabled={isSubmitting || !competitorName.trim() || !competitorPrice.trim()}
        className="w-full h-12 bg-brand-orange hover:bg-brand-orange/90 text-white font-bold rounded-xl shadow-lg shadow-brand-orange/25 disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Submitting...
          </>
        ) : (
          'Request a price match'
        )}
      </Button>
    </form>
  );
};

interface SpeakToUsTabProps {
  callbackPhone: string;
  setCallbackPhone: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  isSuccess: boolean;
  isMobile?: boolean;
}

const SpeakToUsTab: React.FC<SpeakToUsTabProps> = ({
  callbackPhone,
  setCallbackPhone,
  onSubmit,
  isSubmitting,
  isSuccess,
  isMobile,
}) => {
  if (isSuccess) {
    return (
      <div className="py-10 text-center space-y-4 animate-in fade-in-0 zoom-in-95 duration-300">
        <div className="relative inline-block">
          <Check className="w-14 h-14 text-brand-green mx-auto" />
          <Sparkles className="w-5 h-5 text-brand-orange absolute -top-1 -right-1 animate-bounce" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-gray-900">We've got your request</h3>
          <p className="text-gray-600 text-sm">We'll call you back shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600 leading-relaxed">
        Need help with a particular vehicle or want to customise your warranty? We're here to help.
      </p>

      {/* Phone number CTA */}
      <div className="bg-brand-green/5 border border-brand-green/20 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Phone className="w-5 h-5 text-brand-green" />
          <span className="text-sm font-semibold text-gray-800">Call us now</span>
        </div>
        <a
          href="tel:08004947477"
          className="block text-2xl font-bold text-brand-green hover:underline"
        >
          0800 494 7477
        </a>
        <p className="text-xs text-gray-500">Free to call. Lines open Mon-Fri 9am-5pm.</p>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Callback Form */}
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="callback-phone" className="text-sm font-semibold text-gray-800">
            Phone number
          </Label>
          <Input
            id="callback-phone"
            type="tel"
            value={callbackPhone}
            onChange={(e) => setCallbackPhone(e.target.value)}
            placeholder="+44 or 07xxx xxxxxx"
            className="h-12 rounded-lg text-base"
            disabled={isSubmitting}
            autoComplete="tel"
          />
        </div>

        <Button
          type="submit"
          disabled={isSubmitting || !callbackPhone.trim()}
          className="w-full h-12 bg-brand-orange hover:bg-brand-orange/90 text-white font-bold rounded-xl shadow-lg shadow-brand-orange/25 disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            'Call me back'
          )}
        </Button>

        <div className="text-center space-y-0.5">
          <p className="text-xs text-gray-500">No email needed. Your request will be marked as urgent.</p>
          <p className="text-xs text-brand-green font-medium">We'll call you back as soon as possible.</p>
        </div>
      </form>
    </div>
  );
};

export default PriceHelpPanel;
