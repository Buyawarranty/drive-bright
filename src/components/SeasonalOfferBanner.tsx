import { useState } from 'react';
import { X } from 'lucide-react';

export const SeasonalOfferBanner = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => setIsVisible(false), 300);
  };

  if (!isVisible) return null;

  return (
    <div 
      className={`relative overflow-hidden bg-gradient-to-r from-[#1e3a8a] via-[#3b82f6] to-[#1e40af] text-white transition-all duration-300 ${
        isClosing ? 'animate-[slide-out-right_0.3s_ease-out] opacity-0 -translate-y-full' : 'animate-fade-in'
      }`}
    >
      {/* Snowfall Effect */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute text-white opacity-60 animate-[fall_linear_infinite]"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-${Math.random() * 20}%`,
              fontSize: `${Math.random() * 10 + 10}px`,
              animationDuration: `${Math.random() * 3 + 5}s`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          >
            ❄
          </div>
        ))}
      </div>
      
      <div className="relative container mx-auto px-4 py-2 md:py-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-base md:text-lg lg:text-xl text-white mb-1">
              ❄️ Don't Risk a Breakdown This Winter – <span className="font-bold text-yellow-300">Claim 3 Months FREE Extra Cover</span>
            </h1>
            <p className="text-xs md:text-sm text-white/90">
              🎅 Order by Sunday 11pm – ✨ Automatically Applied at Checkout
            </p>
          </div>
          
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-white/20 hover:rotate-90 rounded-full transition-all duration-200 flex-shrink-0"
            aria-label="Close banner"
          >
            <X className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};
