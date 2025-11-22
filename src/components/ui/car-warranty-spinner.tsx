import React from 'react';

export const CarWarrantySpinner = () => {
  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative w-24 h-16">
        {/* Car body */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg relative animate-bounce">
            {/* Car windows */}
            <div className="absolute top-1 left-2 w-4 h-3 bg-blue-200 rounded-sm"></div>
            <div className="absolute top-1 right-2 w-4 h-3 bg-blue-200 rounded-sm"></div>
            
            {/* Car headlights */}
            <div className="absolute top-3 left-0 w-1 h-2 bg-yellow-300 rounded-full animate-pulse"></div>
            <div className="absolute top-5 left-0 w-1 h-2 bg-red-400 rounded-full animate-pulse delay-300"></div>
          </div>
        </div>
        
        {/* Wheels */}
        <div className="absolute bottom-0 left-2 w-4 h-4 bg-gray-700 rounded-full border-2 border-gray-600 animate-spin"></div>
        <div className="absolute bottom-0 right-2 w-4 h-4 bg-gray-700 rounded-full border-2 border-gray-600 animate-spin"></div>
        
        {/* Wheel centers */}
        <div className="absolute bottom-1 left-3 w-2 h-2 bg-gray-400 rounded-full"></div>
        <div className="absolute bottom-1 right-3 w-2 h-2 bg-gray-400 rounded-full"></div>
        
        {/* Road/motion lines */}
        <div className="absolute bottom-0 -left-2 w-2 h-0.5 bg-gray-300 animate-pulse"></div>
        <div className="absolute bottom-0 -left-6 w-4 h-0.5 bg-gray-300 animate-pulse delay-150"></div>
        <div className="absolute bottom-0 -left-10 w-3 h-0.5 bg-gray-300 animate-pulse delay-300"></div>
      </div>
      
      {/* Protection shield animation */}
      <div className="relative">
        <div className="w-12 h-12 border-4 border-green-500 rounded-full animate-ping opacity-75"></div>
        <div className="absolute inset-0 w-12 h-12 border-2 border-green-400 rounded-full animate-pulse">
          <div className="absolute inset-2 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};