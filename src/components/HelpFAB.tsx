import React, { useState } from 'react';
import { Phone, MessageCircle, Star, X, HelpCircle } from 'lucide-react';

const HelpFAB: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed bottom-6 right-4 z-50 md:hidden">
      {/* Expanded Options */}
      {isExpanded && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setIsExpanded(false)}
          />
          
          {/* Options Menu */}
          <div className="absolute bottom-16 right-0 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 w-56 z-50 animate-scale-in">
            <p className="text-xs text-gray-500 font-medium mb-2 px-1">Need help? We're here for you</p>
            
            <a 
              href="tel:03302295040"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={() => setIsExpanded(false)}
            >
              <div className="w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-brand-orange" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Call Us</p>
                <p className="text-xs text-gray-500">0330 229 5040</p>
              </div>
            </a>
            
            <a 
              href="https://wa.me/message/SPQPJ6O3UBF5B1"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={() => setIsExpanded(false)}
            >
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">WhatsApp</p>
                <p className="text-xs text-gray-500">Chat with us</p>
              </div>
            </a>
            
            <a 
              href="https://uk.trustpilot.com/review/buyawarranty.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={() => setIsExpanded(false)}
            >
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <Star className="w-5 h-5 text-green-600 fill-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Trustpilot</p>
                <p className="text-xs text-gray-500">See our reviews</p>
              </div>
            </a>
          </div>
        </>
      )}

      {/* FAB Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          isExpanded 
            ? 'bg-gray-800 rotate-0' 
            : 'bg-brand-orange hover:bg-brand-orange/90'
        }`}
        aria-label={isExpanded ? 'Close help menu' : 'Need help?'}
      >
        {isExpanded ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <HelpCircle className="w-6 h-6 text-white" />
        )}
      </button>
      
      {/* Label below FAB when collapsed */}
      {!isExpanded && (
        <p className="text-xs text-gray-600 text-center mt-1 font-medium">Need help?</p>
      )}
    </div>
  );
};

export default HelpFAB;
