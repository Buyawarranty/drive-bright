import React from 'react';

export const CarDiscountSpinner = () => {
  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative w-28 h-20">
        {/* Assembly platform */}
        <div className="absolute bottom-0 w-full h-2 bg-gray-300 rounded-lg"></div>
        
        {/* Car being assembled */}
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2">
          {/* Car chassis - animated build up */}
          <div className="relative w-20 h-8 bg-gradient-to-r from-orange-400 to-orange-500 rounded-lg animate-pulse">
            {/* Car parts floating down */}
            <div className="absolute -top-6 left-2 w-3 h-2 bg-gray-600 rounded animate-bounce delay-100">
              {/* Engine part */}
            </div>
            <div className="absolute -top-8 right-3 w-4 h-2 bg-blue-400 rounded animate-bounce delay-300">
              {/* Hood part */}
            </div>
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-black rounded animate-bounce delay-500">
              {/* Windshield */}
            </div>
            
            {/* Car windows */}
            <div className="absolute top-0.5 left-1 w-3 h-2 bg-blue-100 rounded-sm opacity-0 animate-fade-in delay-700"></div>
            <div className="absolute top-0.5 right-1 w-3 h-2 bg-blue-100 rounded-sm opacity-0 animate-fade-in delay-1000"></div>
            
            {/* Headlights appearing */}
            <div className="absolute top-2 left-0 w-1 h-1 bg-yellow-300 rounded-full opacity-0 animate-fade-in delay-1200"></div>
            <div className="absolute top-4 left-0 w-1 h-1 bg-red-400 rounded-full opacity-0 animate-fade-in delay-1400"></div>
          </div>
        </div>
        
        {/* Wheels being attached */}
        <div className="absolute bottom-2 left-3 w-3 h-3 bg-gray-700 rounded-full opacity-0 animate-fade-in delay-1600 border border-gray-600"></div>
        <div className="absolute bottom-2 right-3 w-3 h-3 bg-gray-700 rounded-full opacity-0 animate-fade-in delay-1800 border border-gray-600"></div>
        
        {/* Assembly arms/tools */}
        <div className="absolute top-0 left-0 w-1 h-8 bg-gray-500 rounded transform rotate-45 animate-bounce delay-200"></div>
        <div className="absolute top-0 right-0 w-1 h-8 bg-gray-500 rounded transform -rotate-45 animate-bounce delay-400"></div>
        
        {/* Sparks/work effects */}
        <div className="absolute top-4 left-4 w-1 h-1 bg-yellow-400 rounded-full animate-ping delay-600"></div>
        <div className="absolute top-6 right-6 w-1 h-1 bg-orange-400 rounded-full animate-ping delay-800"></div>
        <div className="absolute top-2 left-1/2 w-1 h-1 bg-blue-400 rounded-full animate-ping delay-1000"></div>
      </div>
      
      {/* Discount badge animation */}
      <div className="relative">
        <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-spin-slow flex items-center justify-center">
          <div className="text-white font-bold text-sm">10%</div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-bounce flex items-center justify-center">
            <span className="text-white text-xs">%</span>
          </div>
        </div>
        
        {/* Discount rays */}
        <div className="absolute inset-0 w-16 h-16">
          <div className="absolute top-0 left-1/2 w-0.5 h-4 bg-yellow-300 transform -translate-x-1/2 animate-pulse"></div>
          <div className="absolute bottom-0 left-1/2 w-0.5 h-4 bg-yellow-300 transform -translate-x-1/2 animate-pulse delay-200"></div>
          <div className="absolute left-0 top-1/2 w-4 h-0.5 bg-yellow-300 transform -translate-y-1/2 animate-pulse delay-400"></div>
          <div className="absolute right-0 top-1/2 w-4 h-0.5 bg-yellow-300 transform -translate-y-1/2 animate-pulse delay-600"></div>
        </div>
      </div>
    </div>
  );
};