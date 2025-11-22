
import React from 'react';

const SupportFooter = () => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div className="relative bg-[#224380] px-2 sm:px-4 py-4 sm:py-6 lg:py-8 overflow-hidden">
        {/* Diagonal orange stripe with curved edges */}
        <div 
          className="absolute inset-0 bg-[#eb4b00]"
          style={{
            clipPath: 'polygon(0 0, 100% 0, 85% 100%, 0 70%)',
          }}
        />
        
        {/* Content over the background */}
        <div className="relative z-10 max-w-6xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-3 sm:gap-4 lg:gap-6">
          {/* Logo - Responsive sizing */}
          <div className="flex items-center order-2 lg:order-1">
            <img 
              src="/lovable-uploads/ce43a78c-28ec-400b-8a16-1e98b15e0185.png" 
              alt="Buy a Warranty" 
              className="h-8 sm:h-12 lg:h-16 xl:h-20 w-auto"
            />
          </div>
          
          {/* Support text and phone - Responsive text sizes */}
          <div className="flex flex-col items-center gap-2 sm:gap-3 lg:gap-4 text-white text-center order-1 lg:order-2">
            <span className="text-xs sm:text-sm lg:text-base xl:text-lg font-medium leading-tight">
              Need help or have a question?
            </span>
            <a 
              href="tel:03302291111" 
              className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold hover:text-orange-200 transition-colors"
            >
              0330 229 1111
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportFooter;
