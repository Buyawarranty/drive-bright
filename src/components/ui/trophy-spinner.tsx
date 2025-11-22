import React from 'react';

export const TrophySpinner = () => {
  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        {/* Trophy animation */}
        <div className="w-16 h-16 animate-bounce">
          <svg 
            viewBox="0 0 64 64" 
            className="w-full h-full text-yellow-500"
            fill="currentColor"
          >
            {/* Trophy cup */}
            <path d="M20 16v12c0 6.627 5.373 12 12 12s12-5.373 12-12V16H20z" />
            {/* Trophy handles */}
            <path d="M44 20h4c2.209 0 4 1.791 4 4v4c0 2.209-1.791 4-4 4h-4M20 20h-4c-2.209 0-4 1.791-4 4v4c0 2.209 1.791 4 4 4h4" />
            {/* Trophy stem */}
            <rect x="30" y="40" width="4" height="8" />
            {/* Trophy base */}
            <rect x="24" y="48" width="16" height="4" rx="2" />
          </svg>
        </div>
        
        {/* Sparkle effects */}
        <div className="absolute -top-2 -right-2 w-3 h-3 text-yellow-400 animate-ping">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
        
        <div className="absolute -bottom-1 -left-1 w-2 h-2 text-yellow-300 animate-pulse delay-300">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
      </div>
    </div>
  );
};