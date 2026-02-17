import React, { useState, useEffect } from 'react';
import { Phone, ArrowRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNavigate } from 'react-router-dom';

const PersistentCallback: React.FC = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsVisible(window.scrollY > 300);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!isVisible) return null;

  return (
    <>
      {isMobile ? (
        /* Mobile: dual-action sticky bottom bar */
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.08)] p-2.5 pb-[env(safe-area-inset-bottom,10px)] animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/?step=1')}
              className="flex-1 bg-[#1B2A4A] hover:bg-[#152238] text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
              aria-label="Get instant quote"
            >
              Get Instant Quote
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="tel:03302295040"
              className="flex-1 bg-brand-orange hover:bg-brand-orange/90 text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
              aria-label="Call now"
            >
              <Phone className="w-4 h-4" />
              Call Now
            </a>
          </div>
        </div>
      ) : (
        /* Desktop: keep floating button but as "Get a Quote" */
        <button
          onClick={() => navigate('/?step=1')}
          className="fixed bottom-8 right-8 z-40 bg-[#1B2A4A] hover:bg-[#152238] text-white font-bold px-5 py-3.5 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 text-sm animate-in fade-in-50 duration-300"
          aria-label="Get instant quote"
        >
          Get Instant Quote
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </>
  );
};

export default PersistentCallback;
