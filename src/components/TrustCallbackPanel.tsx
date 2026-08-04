import React, { useState } from 'react';
import RequestCallbackModal from '@/components/RequestCallbackModal';

const TrustCallbackPanel: React.FC = () => {
  const [showCallbackModal, setShowCallbackModal] = useState(false);

  return (
    <>
      <div className="mt-4 sm:mt-7 bg-gray-50 border border-gray-200 rounded-xl shadow-sm px-4 py-3.5 sm:px-5 sm:py-4 text-center">
        <p className="text-[13px] leading-snug sm:text-[17px] font-bold text-[#1B2A4A]">
          Fair price. Fast quote. No surprises.
        </p>
        <div className="mt-1 sm:mt-1.5 flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-y-0.5 sm:gap-x-1.5 text-xs sm:text-[15px]">
          <span className="whitespace-nowrap">
            <span className="text-gray-600">Speak to an expert: </span>
            <a
              href="tel:03302295040"
              className="font-semibold text-gray-900 hover:underline"
            >
              0330 229 5040
            </a>
          </span>
          <span className="hidden sm:inline text-gray-400">or</span>
          <button
            onClick={() => setShowCallbackModal(true)}
            className="text-brand-orange hover:underline font-medium"
          >
            Request a callback
          </button>
        </div>
      </div>

      <RequestCallbackModal
        isOpen={showCallbackModal}
        onClose={() => setShowCallbackModal(false)}
      />
    </>
  );
};

export default TrustCallbackPanel;
