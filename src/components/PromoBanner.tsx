import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PromoBannerProps {
  onApplyDiscount?: (code: string) => void;
}

// Minimized pill component - exported to be placed elsewhere
export const MinimizedPromoPill: React.FC<{ onExpand: () => void }> = ({ onExpand }) => {
  const discountPercent = 10;
  
  return (
    <div 
      className="cursor-pointer"
      onClick={onExpand}
      role="button"
      aria-label="Expand promo banner"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onExpand()}
      style={{
        animation: 'promoPulse 1s ease-in-out infinite',
      }}
    >
      <style>{`
        @keyframes promoPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.03); opacity: 0.9; }
        }
      `}</style>
      <div className="bg-[#1E9E5C] text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-lg hover:scale-105 transition-transform border border-white/30">
        <Sparkles className="w-3 h-3" />
        <span>{discountPercent}% OFF</span>
        <ChevronUp className="w-3 h-3" />
      </div>
    </div>
  );
};

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
      console.log('Analytics: promo_banner_impression', { code: promoCode, page: window.location.pathname });
      setHasTrackedImpression(true);
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
      console.log('Analytics: promo_banner_copy', { code: promoCode, page: window.location.pathname });
      setTimeout(() => setHasCopied(false), 2500);
    } catch (err) {
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
    console.log('Analytics: promo_banner_dismiss', { code: promoCode, page: window.location.pathname });
  };

  const handleExpand = () => {
    setIsMinimized(false);
    sessionStorage.removeItem('promo_banner_minimized');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Export the expand function and minimized state for external use
  useEffect(() => {
    (window as any).promoExpandBanner = handleExpand;
    (window as any).promoBannerMinimized = isMinimized;
  }, [isMinimized]);

  // Don't render when minimized - the pill will be rendered elsewhere
  if (isMinimized) {
    return null;
  }

  return (
    <div 
      ref={bannerRef}
      className="sticky top-0 z-[100] w-full bg-[#FFA94D] text-black overflow-hidden"
      role="banner"
      aria-label="Promotional offer"
    >
      {/* Main Banner Row */}
      <div className="relative px-3 py-2 sm:py-2.5">
        {/* Animated background sparkles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-[10%] w-1 h-1 bg-white rounded-full animate-ping opacity-60" style={{ animationDuration: '2s' }} />
          <div className="absolute top-1/3 left-[30%] w-1 h-1 bg-[#1E9E5C] rounded-full animate-ping opacity-60" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
          <div className="absolute top-2/3 right-[20%] w-1 h-1 bg-white rounded-full animate-ping opacity-60" style={{ animationDuration: '3s', animationDelay: '1s' }} />
          <div className="absolute top-1/4 right-[40%] w-1 h-1 bg-[#1E9E5C] rounded-full animate-ping opacity-40" style={{ animationDuration: '2.8s', animationDelay: '0.3s' }} />
        </div>

        <div className="flex items-center justify-center gap-2 sm:gap-4 flex-wrap relative">
          <Sparkles className="w-4 h-4 text-[#1E9E5C] animate-pulse hidden sm:block" />
          
          <span className="text-black font-bold text-xs sm:text-sm uppercase tracking-wide">
            Limited time only
          </span>
          
          <span className="text-black font-semibold text-xs sm:text-sm">
            Save {discountPercent}% today
          </span>
          
          {/* Code pill */}
          <button
            onClick={copyToClipboard}
            className="group flex items-center gap-1.5 bg-[#1E9E5C] text-white px-2.5 py-1 rounded-full text-xs sm:text-sm font-bold border border-white hover:bg-[#1E9E5C]/90 transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#FFA94D]"
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
          
          <span className="text-black/70 text-[10px] sm:text-xs hidden md:inline">
            Applied at checkout
          </span>
          
          {/* Expand/Details button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-black/70 hover:text-black text-xs flex items-center gap-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-white rounded px-1 border border-[#6B7280]/30 bg-white/20"
            aria-expanded={isExpanded}
            aria-controls="promo-details"
            aria-label={isExpanded ? "Hide details" : "Show details"}
          >
            <span className="hidden sm:inline">Details</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          
          {/* Minimize button - uses ChevronUp */}
          <button
            onClick={handleMinimize}
            className="text-black/70 hover:text-black transition-colors p-1 focus:outline-none focus:ring-2 focus:ring-white rounded border border-[#6B7280]/30 bg-white/20"
            aria-label="Minimize banner"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
        
        <p className="text-center text-black/80 text-[10px] mt-1 sm:hidden font-medium">
          Ends soon — Don't miss out!
        </p>
      </div>
      
      {/* Expandable Details Panel */}
      <div 
        id="promo-details"
        className={`bg-[#FF9933] border-t border-white/30 overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-40 py-3' : 'max-h-0 py-0'}`}
        aria-hidden={!isExpanded}
      >
        <div className="px-4 text-center space-y-2">
          <p className="text-black text-xs sm:text-sm flex items-center justify-center gap-2">
            <Check className="w-4 h-4 text-[#1E9E5C]" />
            <span>Discount applied automatically at checkout</span>
          </p>
          <p className="text-black/70 text-[10px] sm:text-xs">
            Use code <span className="text-[#1E9E5C] font-semibold bg-white/50 px-1 rounded">{promoCode}</span> for {discountPercent}% off your warranty. 
            <a 
              href="/terms-and-conditions" 
              className="underline hover:text-black ml-1 focus:outline-none focus:ring-2 focus:ring-white rounded"
              target="_blank"
              rel="noopener noreferrer"
            >
              T&Cs apply
            </a>
          </p>
          <p className="text-black font-medium text-[10px] animate-pulse">
            ⏰ Ends soon — Don't miss out!
          </p>
        </div>
      </div>
    </div>
  );
};

// Hook to check if banner is minimized
export const usePromoBannerState = () => {
  const [isMinimized, setIsMinimized] = useState(false);
  
  useEffect(() => {
    const checkState = () => {
      const minimized = sessionStorage.getItem('promo_banner_minimized');
      setIsMinimized(minimized === 'true');
    };
    
    checkState();
    window.addEventListener('storage', checkState);
    const interval = setInterval(checkState, 100);
    
    return () => {
      window.removeEventListener('storage', checkState);
      clearInterval(interval);
    };
  }, []);
  
  const expandBanner = () => {
    sessionStorage.removeItem('promo_banner_minimized');
    setIsMinimized(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  return { isMinimized, expandBanner };
};
