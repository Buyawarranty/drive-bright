import React, { useState, useEffect } from 'react';
import { Phone } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import RequestCallbackModal from '@/components/modals/RequestCallbackModal';

const BluePersistentCallback: React.FC = () => {
  const isMobile = useIsMobile();
  const [showModal, setShowModal] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsVisible(window.scrollY > 300);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Mobile sticky bar is now handled globally by StickyNavigation
  if (!isVisible || isMobile) return null;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-8 right-8 z-40 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-3.5 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 text-sm animate-in fade-in-50 duration-300"
        aria-label="Request a callback"
      >
        <Phone className="w-4 h-4" />
        Request a callback
      </button>

      <RequestCallbackModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
};

export default BluePersistentCallback;
