import React from 'react';
import pandaHead from '@/assets/panda_head.png';

export const PandaLoadingSpinner = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-orange-50 flex items-center justify-center">
      <div className="text-center space-y-8">
        {/* Animated panda face */}
        <div className="relative">
          <div className="w-32 h-32 mx-auto animate-bounce">
            <img 
              src={pandaHead} 
              alt="Loading panda" 
              className="w-full h-full object-contain drop-shadow-lg"
            />
          </div>
        </div>
        
        {/* Loading text */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">
            Getting your quote ready...
          </h2>
          <p className="text-gray-600">
            Our panda is working hard to find you the best deal!
          </p>
        </div>
        
        {/* Progress bar */}
        <div className="w-80 mx-auto">
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-orange-500 rounded-full animate-[loading_2s_ease-in-out_infinite]"></div>
          </div>
          <p className="text-sm text-gray-500 mt-2">This will just take a moment...</p>
        </div>
      </div>
    </div>
  );
};
