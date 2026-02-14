import React, { useState, useEffect } from 'react';
import { Phone } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import RequestCallbackModal from '@/components/modals/RequestCallbackModal';

const PersistentCallback: React.FC = () => {
  const isMobile = useIsMobile();
  const [showModal, setShowModal] = useState(false);
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
        /* Mobile: sticky bottom bar */
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.08)] p-3 animate-in slide-in-from-bottom-4 duration-300">
          <button
            onClick={() => setShowModal(true)}
            className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg"
            aria-label="Request a callback"
          >
            <Phone className="w-4 h-4" />
            Request a callback
          </button>
        </div>
      ) : (
        /* Desktop: floating button lower right */
        <button
          onClick={() => setShowModal(true)}
          className="fixed bottom-8 right-8 z-40 bg-brand-orange hover:bg-brand-orange/90 text-white font-bold px-5 py-3.5 rounded-full shadow-lg shadow-brand-orange/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 text-sm animate-in fade-in-50 duration-300"
          aria-label="Request a callback"
        >
          <Phone className="w-4 h-4" />
          Request a callback
        </button>
      )}

      <RequestCallbackModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
};

export default PersistentCallback;
