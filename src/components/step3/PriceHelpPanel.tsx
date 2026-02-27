import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, Trophy, Phone, ChevronRight, ChevronDown, ArrowRight, Mail } from 'lucide-react';
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
  const [requestPhone, setRequestPhone] = useState('');
  const [competitorPrice, setCompetitorPrice] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [requestEmail, setRequestEmail] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isPhoneValid, setIsPhoneValid] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setRequestPhone('');
      setCompetitorPrice('');
      setRequestMessage('');
      setRequestEmail('');
      setRequestSuccess(false);
      setShowDetails(false);
      setShowEmail(false);
      setPhoneError('');
      setIsPhoneValid(false);
      document.body.style.overflow = 'hidden';
      trackEvent('price_help_panel_opened');
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const validatePhone = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-]/g, '');
    return /^(07\d{9}|(\+44|0044)7\d{9}|0[1-9]\d{8,9})$/.test(cleaned);
  };




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
    if (phoneError) setPhoneError('');
    setIsPhoneValid(validatePhone(value));
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
    setPhoneError('');
    if (!requestPhone.trim()) { setPhoneError('Phone number is required'); return; }
    if (!validatePhone(requestPhone)) { setPhoneError('Please enter a valid UK phone number'); return; }

    setIsSubmitting(true);
    try {
      const vehicleData = JSON.parse(localStorage.getItem('vehicleData') || '{}');
      const quoteRef = localStorage.getItem('quoteReference') || `QR-${Date.now()}`;
      const requestedOptions = getRequestedOptionsString();

      const { error } = await supabase.from('abandoned_carts').insert({
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
          currentExcess, currentClaimLimit, currentLabourRate, currentMonthlyPrice,
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
      toast({ title: "Something went wrong", description: "Please try again or call us on 0330 229 5040", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen && !isAnimating) return null;

  // ── Helpers to render form / success as plain JSX (NOT components) ──
  const renderForm = (mobile: boolean) => (
    <form onSubmit={handleSubmit} className={cn("space-y-5", mobile ? "p-5 pt-10 pb-8" : "p-6 pt-12 pb-8")}>
      <div>
        <h2 className={cn("font-bold text-gray-900 leading-tight", mobile ? "text-xl" : "text-2xl")}>
          🏆 We'll beat any like‑for‑like quote
        </h2>
        <p className="text-sm text-gray-500 mt-1.5">Tell us what you were quoted and we'll do better — guaranteed.</p>
      </div>

      {/* Price field */}
      <div>
        <Label className="text-sm font-bold text-gray-900 mb-1.5 block">What price were you quoted?</Label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">£</span>
          <Input
            type="text"
            inputMode="numeric"
            value={competitorPrice}
            onChange={(e) => setCompetitorPrice(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="e.g. 350"
            className={cn(
              "h-14 pl-9 pr-12 rounded-xl text-base font-semibold border focus:ring-0 transition-colors",
              competitorPrice
                ? "border-emerald-500 bg-white focus:border-emerald-500"
                : "border-gray-200 bg-[#F5F5F5] focus:bg-white focus:border-brand-orange"
            )}
            disabled={isSubmitting}
          />
          {competitorPrice && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-6 h-6 rounded-full border-2 border-emerald-500 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-500" strokeWidth={3} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phone field */}
      <div>
        <Label className="text-sm font-bold text-gray-900 mb-1.5 block">Your mobile number</Label>
        <div className="relative">
          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="tel"
            value={requestPhone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            onBlur={handlePhoneBlur}
            placeholder="07900 000000"
            className={cn(
              "h-14 pl-11 pr-12 rounded-xl text-base font-semibold border focus:ring-0 transition-colors",
              phoneError
                ? "border-red-500 bg-white focus:border-red-500"
                : isPhoneValid
                  ? "border-emerald-500 bg-white focus:border-emerald-500"
                  : "border-gray-200 bg-[#F5F5F5] focus:bg-white focus:border-brand-orange"
            )}
            disabled={isSubmitting}
            autoComplete="tel"
          />
          {isPhoneValid && !phoneError && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-6 h-6 rounded-full border-2 border-emerald-500 flex items-center justify-center">
                <Check className="w-4 h-4 text-emerald-500" strokeWidth={3} />
              </div>
            </div>
          )}
        </div>
        {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
        <p className="text-xs text-gray-400 mt-1">Unlock exclusive discounts and get expert advice</p>
      </div>

      {/* Collapsible email field */}
      <button
        type="button"
        onClick={() => setShowEmail(!showEmail)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <Mail className="w-3.5 h-3.5" />
        Add email <span className="text-gray-400">(optional)</span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showEmail && "rotate-180")} />
      </button>
      {showEmail && (
        <div className="relative animate-fade-in">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="email"
            value={requestEmail}
            onChange={(e) => setRequestEmail(e.target.value)}
            placeholder="e.g. john@example.com"
            className="h-14 pl-11 rounded-xl text-base font-semibold border border-gray-200 bg-[#F5F5F5] focus:bg-white focus:border-brand-orange focus:ring-0 transition-colors"
            disabled={isSubmitting}
            autoComplete="email"
          />
        </div>
      )}

      {/* Optional details toggle */}
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        More details about your quote <span className="text-gray-400">(optional)</span>
        <ChevronRight className={cn("w-4 h-4 transition-transform", showDetails && "rotate-90")} />
      </button>
      {showDetails && (
        <Textarea
          value={requestMessage}
          onChange={(e) => setRequestMessage(e.target.value)}
          placeholder="Tell us what the quote includes (provider, cover level, etc.)"
          className="rounded-xl resize-none border border-gray-200 bg-[#F5F5F5] focus:bg-white focus:border-brand-orange text-sm font-medium"
          rows={3}
          disabled={isSubmitting}
        />
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-14 bg-brand-orange hover:bg-brand-orange/90 text-white font-bold text-lg rounded-xl shadow-lg shadow-orange-200 disabled:opacity-50"
      >
        {isSubmitting ? (
          <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting...</>
        ) : (
          <>Beat this quote <ArrowRight className="w-5 h-5 ml-2" /></>
        )}
      </Button>

      <p className="text-xs text-gray-500 text-center font-medium">⚡ Priority request — we'll call you back ASAP</p>

      <div className="border-t border-gray-100 pt-4">
        <p className="text-sm text-gray-600 text-center mb-2">Don't want to wait? Ring us now</p>
        <a
          href="tel:03302295040"
          className="flex items-center justify-center gap-2 w-full h-12 rounded-xl border-2 border-brand-orange/30 bg-brand-orange/5 hover:bg-brand-orange/10 text-brand-orange font-bold text-base transition-colors"
        >
          <Phone className="w-4 h-4" />
          0330 229 5040
        </a>
      </div>

      <div className="flex justify-center pt-2">
        <img src={pandaSavingsMascot} alt="Panda savings mascot" width={140} height={140} loading="lazy" className="object-contain" />
      </div>
    </form>
  );

  const renderSuccess = (mobile: boolean) => (
    <div className={cn("flex flex-col items-center justify-center text-center animate-fade-in", mobile ? "px-5 py-8" : "px-8 py-10 flex-1")}>
      <div className="mb-5">
        <div className={cn("rounded-full bg-emerald-50 flex items-center justify-center animate-in zoom-in-50 duration-500", mobile ? "w-16 h-16" : "w-20 h-20")}>
          <Check className={cn("text-emerald-500", mobile ? "w-10 h-10" : "w-12 h-12")} strokeWidth={2.5} />
        </div>
      </div>

      <h3 className={cn("font-bold text-gray-900 mb-3", mobile ? "text-lg" : "text-2xl")}>You're all set!</h3>

      <div className="bg-gray-50 rounded-xl p-4 mb-4 max-w-sm w-full border border-gray-100">
        <p className={cn("text-gray-700 leading-relaxed", mobile ? "text-sm" : "text-base")}>
          Our team is already working on <span className="font-semibold text-gray-900">your personalised quote</span>.
          Expect a call today — or within one working day if we're flat out.
        </p>
      </div>

      <div className="bg-gradient-to-r from-brand-orange/10 to-amber-50 rounded-xl p-3.5 mb-5 max-w-sm w-full border border-brand-orange/20">
        <p className={cn("text-gray-800 font-medium", mobile ? "text-sm" : "text-base")}>
          <Trophy className="w-4 h-4 text-brand-orange inline-block mr-1.5 align-text-bottom" />
          Have any other quotes handy?
          <span className="text-brand-orange font-bold"> We'll beat them.</span>
        </p>
      </div>

      <Button onClick={onClose} className={cn("bg-brand-orange hover:bg-brand-orange/90 text-white font-bold rounded-xl shadow-md shadow-orange-200", mobile ? "w-full h-12 text-base" : "px-12 h-12")}>
        Got it ✓
      </Button>
    </div>
  );

  // ── Render ──
  return (
    <>
      {/* Backdrop */}
      <div
        className={cn("fixed inset-0 bg-black/50 z-[60] transition-opacity duration-300", isOpen ? "opacity-100" : "opacity-0 pointer-events-none")}
        onClick={onClose}
        onTransitionEnd={() => !isOpen && setIsAnimating(false)}
      />

      {/* Desktop panel */}
      <div className={cn(
        "fixed z-[70] bg-white transition-transform duration-300 ease-out",
        "hidden md:flex md:flex-col md:right-0 md:top-0 md:h-full md:w-[460px] md:shadow-2xl md:rounded-l-2xl",
        isOpen ? "md:translate-x-0" : "md:translate-x-full"
      )}>
        <button onClick={onClose} className="absolute top-4 right-4 w-11 h-11 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center z-10 transition-colors" aria-label="Close">
          <X className="w-6 h-6 text-gray-700" />
        </button>
        <div className="flex-1 overflow-y-auto">
          {requestSuccess ? renderSuccess(false) : renderForm(false)}
        </div>
      </div>

      {/* Mobile bottom sheet */}
      <div className={cn(
        "fixed z-[70] md:hidden bg-white transition-transform duration-300 ease-out",
        "left-0 right-0 bottom-0 rounded-t-2xl shadow-2xl max-h-[92vh] overflow-hidden",
        isOpen ? "translate-y-0" : "translate-y-full"
      )}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        <button onClick={onClose} className="absolute top-3 right-3 w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center z-10 transition-colors" aria-label="Close">
          <X className="w-5 h-5 text-gray-700" />
        </button>
        <div className="overflow-y-auto max-h-[calc(92vh-40px)]">
          {requestSuccess ? renderSuccess(true) : renderForm(true)}
        </div>
      </div>
    </>
  );
};

export default PriceHelpPanel;
