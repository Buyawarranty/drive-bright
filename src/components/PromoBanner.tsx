import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, ChevronDown, ChevronUp, X, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PromoBannerProps {
  onApplyDiscount?: (code: string) => void;
}

export const PromoBanner: React.FC<PromoBannerProps> = ({ onApplyDiscount }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [hasTrackedImpression, setHasTrackedImpression] = useState(false);
  const { toast } = useToast();
  const bannerRef = useRef<HTMLDivElement>(null);
  
  const promoCode = 'SAVE10PERCENT';
  const discountPercent = 10;

  // Track impression on mount
  useEffect(() => {
    if (!hasTrackedImpression) {
      // Analytics: promo_banner_impression
      console.log('Analytics: promo_banner_impression', { code: promoCode, page: window.location.pathname });
      setHasTrackedImpression(true);
      
      // Set sessionStorage for auto-apply signal
      sessionStorage.setItem('promo_auto_apply', promoCode);
      document.documentElement.setAttribute('data-voucher', promoCode);
    }
  }, [hasTrackedImpression]);

  // Check for minimized state in sessionStorage
  useEffect(() => {
    const minimized = sessionStorage.getItem('promo_banner_minimized');
    if (minimized === 'true') {
      setIsMinimized(true);
    }
  }, []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(promoCode);
      setHasCopied(true);
      toast({
        title: "Promo code copied!",
        description: `${promoCode} - Use at checkout for ${discountPercent}% off`,
      });
      
      // Analytics: promo_banner_copy
      console.log('Analytics: promo_banner_copy', { code: promoCode, page: window.location.pathname });
      
      setTimeout(() => setHasCopied(false), 2500);
    } catch (err) {
      // Fallback: select text for manual copy
      const textArea = document.createElement('textarea');
      textArea.value = promoCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      toast({
        title: "Code selected",
        description: "Press Ctrl+C to copy the code",
      });
    }
  };

  const handleMinimize = () => {
    setIsMinimized(true);
    sessionStorage.setItem('promo_banner_minimized', 'true');
    // Analytics: promo_banner_dismiss
    console.log('Analytics: promo_banner_dismiss', { code: promoCode, page: window.location.pathname });
  };

  const handleExpand = () => {
    setIsMinimized(false);
    sessionStorage.removeItem('promo_banner_minimized');
  };

  // Minimized state - small floating pill
  if (isMinimized) {
    return (
      <div 
        className="fixed top-2 right-2 z-[100] cursor-pointer animate-pulse"
        onClick={handleExpand}
        role="button"
        aria-label="Expand promo banner"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleExpand()}
      >
        <div className="bg-[#1E9E5C] text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-lg hover:scale-105 transition-transform">
          <Sparkles className="w-3 h-3 animate-spin" style={{ animationDuration: '3s' }} />
          <span>{discountPercent}% OFF</span>
          <ChevronDown className="w-3 h-3" />
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={bannerRef}
      className="sticky top-0 z-[100] w-full bg-black text-white overflow-hidden"
      role="banner"
      aria-label="Promotional offer"
    >
      {/* Main Banner Row */}
      <div className="relative px-3 py-2 sm:py-2.5">
        {/* Animated background sparkles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-[10%] w-1 h-1 bg-[#FFA94D] rounded-full animate-ping opacity-60" style={{ animationDuration: '2s' }} />
          <div className="absolute top-1/3 left-[30%] w-1 h-1 bg-[#1E9E5C] rounded-full animate-ping opacity-60" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
          <div className="absolute top-2/3 right-[20%] w-1 h-1 bg-[#FFA94D] rounded-full animate-ping opacity-60" style={{ animationDuration: '3s', animationDelay: '1s' }} />
          <div className="absolute top-1/4 right-[40%] w-1 h-1 bg-white rounded-full animate-ping opacity-40" style={{ animationDuration: '2.8s', animationDelay: '0.3s' }} />
        </div>

        <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap relative">
          {/* Sparkle icon with animation */}
          <Sparkles className="w-4 h-4 text-[#FFA94D] animate-pulse hidden sm:block" />
          
          {/* Urgency text */}
          <span className="text-[#FFA94D] font-bold text-xs sm:text-sm uppercase tracking-wide animate-pulse">
            Limited time only
          </span>
          
          {/* Main message */}
          <span className="text-white font-semibold text-xs sm:text-sm">
            Save {discountPercent}% today
          </span>
          
          {/* Code pill */}
          <button
            onClick={copyToClipboard}
            className="group flex items-center gap-1.5 bg-[#1E9E5C] text-white px-2.5 py-1 rounded-full text-xs sm:text-sm font-bold border border-[#FFA94D] hover:bg-[#1E9E5C]/90 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[#FFA94D] focus:ring-offset-2 focus:ring-offset-black"
            aria-label={`Copy promo code ${promoCode}`}
            title="Copy code"
          >
            <span className="tracking-wider">{promoCode}</span>
            {hasCopied ? (
              <Check className="w-3.5 h-3.5 text-white" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-white/80 group-hover:text-white transition-colors" />
            )}
          </button>
          
          {/* Supporting text - hidden on mobile */}
          <span className="text-[#6B7280] text-[10px] sm:text-xs hidden md:inline">
            Applied at checkout
          </span>
          
          {/* Expand/Details button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[#6B7280] hover:text-white text-xs flex items-center gap-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-[#FFA94D] rounded px-1"
            aria-expanded={isExpanded}
            aria-controls="promo-details"
            aria-label={isExpanded ? "Hide details" : "Show details"}
          >
            <span className="hidden sm:inline">Details</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          
          {/* Minimize button */}
          <button
            onClick={handleMinimize}
            className="text-[#6B7280] hover:text-white transition-colors p-1 focus:outline-none focus:ring-2 focus:ring-[#FFA94D] rounded"
            aria-label="Minimize banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Urgency microcopy - mobile only */}
        <p className="text-center text-[#FFA94D] text-[10px] mt-1 sm:hidden animate-pulse">
          Ends soon — Don't miss out!
        </p>
      </div>
      
      {/* Expandable Details Panel */}
      <div 
        id="promo-details"
        className={`bg-[#111] border-t border-[#333] overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-40 py-3' : 'max-h-0 py-0'}`}
        aria-hidden={!isExpanded}
      >
        <div className="px-4 text-center space-y-2">
          <p className="text-white text-xs sm:text-sm flex items-center justify-center gap-2">
            <Check className="w-4 h-4 text-[#1E9E5C]" />
            <span>Discount applied automatically at checkout</span>
          </p>
          <p className="text-[#6B7280] text-[10px] sm:text-xs">
            Use code <span className="text-[#1E9E5C] font-semibold">{promoCode}</span> for {discountPercent}% off your warranty. 
            <a 
              href="/terms-and-conditions" 
              className="underline hover:text-white ml-1 focus:outline-none focus:ring-2 focus:ring-[#FFA94D] rounded"
              target="_blank"
              rel="noopener noreferrer"
            >
              T&Cs apply
            </a>
          </p>
          <p className="text-[#FFA94D] text-[10px] font-medium animate-pulse">
            ⏰ Ends soon — Don't miss out!
          </p>
        </div>
      </div>
    </div>
  );
};
