import React from 'react';

export const CarDrivingSpinner = () => {
  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative w-80 h-20 overflow-hidden">
        {/* Progress bar background */}
        <div className="absolute bottom-0 w-full h-4 bg-gray-300 rounded-full">
          {/* Progress bar fill */}
          <div className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full animate-[progress-fill_3s_ease-in-out_infinite]" style={{ width: '70%' }}></div>
          
          {/* Road markings on progress bar */}
          <div className="absolute top-1/2 transform -translate-y-1/2 w-full h-0.5">
            <div className="flex justify-between px-4">
              <div className="w-4 h-0.5 bg-white rounded animate-pulse"></div>
              <div className="w-4 h-0.5 bg-white rounded animate-pulse delay-150"></div>
              <div className="w-4 h-0.5 bg-white rounded animate-pulse delay-300"></div>
              <div className="w-4 h-0.5 bg-white rounded animate-pulse delay-450"></div>
            </div>
          </div>
        </div>
        
        {/* Simple orange car matching progress bar style */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 animate-[car-progress_3s_ease-in-out_infinite]">
          <svg width="48" height="32" viewBox="0 0 48 32" className="drop-shadow-md">
            {/* Car Body */}
            <rect x="3" y="12" width="42" height="12" rx="3" fill="#ea580c" />
            <rect x="9" y="6" width="30" height="9" rx="3" fill="#fb923c" />
            
            {/* Windows */}
            <rect x="12" y="7" width="9" height="6" rx="1.5" fill="#fef3c7" opacity="0.9" />
            <rect x="27" y="7" width="9" height="6" rx="1.5" fill="#fef3c7" opacity="0.9" />
            
            {/* Wheels */}
            <circle cx="12" cy="22" r="4.5" fill="#374151" />
            <circle cx="36" cy="22" r="4.5" fill="#374151" />
            <circle cx="12" cy="22" r="3" fill="#6b7280" />
            <circle cx="36" cy="22" r="3" fill="#6b7280" />
            
            {/* Headlights */}
            <circle cx="42" cy="16" r="2" fill="#fef3c7" opacity="0.9" />
            <circle cx="42" cy="20" r="2" fill="#fef3c7" opacity="0.9" />
          </svg>
        </div>
        
        {/* Wind effect lines coming towards car */}
        <div className="absolute top-2 right-8 w-8 h-0.5 bg-gray-400/60 rounded animate-[wind-lines_1.5s_linear_infinite]"></div>
        <div className="absolute top-4 right-12 w-6 h-0.5 bg-gray-400/40 rounded animate-[wind-lines_1.5s_linear_infinite_0.3s]"></div>
        <div className="absolute top-6 right-6 w-10 h-0.5 bg-gray-400/50 rounded animate-[wind-lines_1.5s_linear_infinite_0.6s]"></div>
        <div className="absolute top-8 right-16 w-4 h-0.5 bg-gray-400/30 rounded animate-[wind-lines_1.5s_linear_infinite_0.9s]"></div>
      </div>
    </div>
  );
};