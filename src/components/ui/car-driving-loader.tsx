import React from 'react';

export const CarDrivingLoader = ({ text = "Loading your quote..." }: { text?: string }) => {
  return (
    <div className="flex flex-col items-center space-y-6">
      {/* Road scene container */}
      <div className="relative w-72 h-24 overflow-hidden">
        {/* Sky gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-100 to-blue-50 rounded-lg" />
        
        {/* Clouds moving */}
        <div className="absolute top-2 left-0 animate-[cloud-move_8s_linear_infinite]">
          <svg width="32" height="16" viewBox="0 0 32 16" fill="white" opacity="0.8">
            <ellipse cx="10" cy="10" rx="10" ry="6" />
            <ellipse cx="22" cy="10" rx="8" ry="5" />
            <ellipse cx="16" cy="6" rx="8" ry="6" />
          </svg>
        </div>
        <div className="absolute top-4 left-20 animate-[cloud-move_12s_linear_infinite_2s]">
          <svg width="24" height="12" viewBox="0 0 24 12" fill="white" opacity="0.6">
            <ellipse cx="8" cy="7" rx="8" ry="5" />
            <ellipse cx="16" cy="7" rx="6" ry="4" />
          </svg>
        </div>
        
        {/* Road */}
        <div className="absolute bottom-0 w-full h-8 bg-gray-600 rounded-b-lg">
          {/* Road markings moving */}
          <div className="absolute top-1/2 -translate-y-1/2 w-full flex gap-8 animate-[road-lines_1s_linear_infinite]">
            <div className="w-8 h-1 bg-yellow-400 rounded" />
            <div className="w-8 h-1 bg-yellow-400 rounded" />
            <div className="w-8 h-1 bg-yellow-400 rounded" />
            <div className="w-8 h-1 bg-yellow-400 rounded" />
            <div className="w-8 h-1 bg-yellow-400 rounded" />
            <div className="w-8 h-1 bg-yellow-400 rounded" />
          </div>
        </div>
        
        {/* Car - side view - proper saloon/sedan shape */}
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 animate-[car-bounce_0.3s_ease-in-out_infinite]">
          <svg width="72" height="36" viewBox="0 0 72 36" className="drop-shadow-lg">
            {/* Car body - unified saloon shape, all orange */}
            <path 
              d="M6 22 L6 26 L66 26 L66 22 L62 18 L58 18 L58 22 L14 22 L14 18 L10 18 L6 22" 
              fill="#ea580c"
            />
            {/* Upper body - smooth saloon roofline */}
            <path 
              d="M14 18 L18 18 L22 10 L50 10 L56 18 L58 18 L58 18 L14 18" 
              fill="#ea580c"
            />
            {/* Roof - gentle curve */}
            <path 
              d="M22 10 L26 6 L46 6 L50 10 L22 10" 
              fill="#ea580c"
            />
            {/* Hood (front/right) - sleek slope */}
            <path 
              d="M50 10 L56 18 L62 18 L62 16 L58 12 L50 10" 
              fill="#ea580c"
            />
            {/* Trunk (rear/left) - classic saloon boot */}
            <path 
              d="M18 18 L22 10 L18 12 L14 18 L18 18" 
              fill="#ea580c"
            />
            
            {/* Front windshield */}
            <path 
              d="M46 6.5 L50 10 L50 12 L46 8 L46 6.5" 
              fill="#bfdbfe" 
              opacity="0.9"
            />
            {/* Rear windshield */}
            <path 
              d="M26 6.5 L22 10 L22 12 L26 8 L26 6.5" 
              fill="#bfdbfe" 
              opacity="0.9"
            />
            {/* Side windows */}
            <rect x="28" y="7" width="16" height="4" rx="1" fill="#bfdbfe" opacity="0.9" />
            {/* Window pillar */}
            <rect x="35" y="7" width="1" height="4" fill="#ea580c" />
            
            {/* Front wheel (right side) */}
            <g className="origin-center animate-[wheel-spin_0.3s_linear_infinite]" style={{ transformOrigin: '54px 26px' }}>
              <circle cx="54" cy="26" r="6" fill="#1f2937" />
              <circle cx="54" cy="26" r="4" fill="#4b5563" />
              <circle cx="54" cy="26" r="1.5" fill="#9ca3af" />
              <line x1="54" y1="22" x2="54" y2="30" stroke="#6b7280" strokeWidth="1" />
              <line x1="50" y1="26" x2="58" y2="26" stroke="#6b7280" strokeWidth="1" />
            </g>
            
            {/* Rear wheel (left side) */}
            <g className="origin-center animate-[wheel-spin_0.3s_linear_infinite]" style={{ transformOrigin: '18px 26px' }}>
              <circle cx="18" cy="26" r="6" fill="#1f2937" />
              <circle cx="18" cy="26" r="4" fill="#4b5563" />
              <circle cx="18" cy="26" r="1.5" fill="#9ca3af" />
              <line x1="18" y1="22" x2="18" y2="30" stroke="#6b7280" strokeWidth="1" />
              <line x1="14" y1="26" x2="22" y2="26" stroke="#6b7280" strokeWidth="1" />
            </g>
            
            {/* Headlights at front (right side) */}
            <ellipse cx="64" cy="18" rx="2" ry="2" fill="#fef3c7" className="animate-pulse" />
            <ellipse cx="64" cy="22" rx="1.5" ry="1.5" fill="#fef3c7" opacity="0.8" />
            
            {/* Taillights at back (left side) */}
            <rect x="6" y="17" width="2" height="3" rx="1" fill="#ef4444" className="animate-pulse" />
            <rect x="6" y="21" width="2" height="2" rx="0.5" fill="#ef4444" opacity="0.7" />
            
            {/* Front grille (right side) */}
            <rect x="62" y="19" width="2" height="4" rx="0.5" fill="#1f2937" />
            
            {/* Door handles */}
            <rect x="32" y="14" width="3" height="1" rx="0.5" fill="#c2410c" />
            <rect x="40" y="14" width="3" height="1" rx="0.5" fill="#c2410c" />
            
            {/* Side mirror */}
            <rect x="52" y="10" width="2" height="2" rx="0.5" fill="#ea580c" />
            
            {/* Exhaust smoke at back (left side) */}
            <g className="animate-[exhaust_0.8s_ease-out_infinite]">
              <circle cx="4" cy="24" r="2" fill="#9ca3af" opacity="0.4" />
            </g>
            <g className="animate-[exhaust_0.8s_ease-out_infinite_0.2s]">
              <circle cx="0" cy="22" r="1.5" fill="#9ca3af" opacity="0.3" />
            </g>
            <g className="animate-[exhaust_0.8s_ease-out_infinite_0.4s]">
              <circle cx="-3" cy="20" r="1" fill="#9ca3af" opacity="0.2" />
            </g>
          </svg>
        </div>
        
        {/* Speed lines */}
        <div className="absolute bottom-12 left-4 w-6 h-0.5 bg-gray-400/50 rounded animate-[speed-line_0.4s_linear_infinite]" />
        <div className="absolute bottom-14 left-8 w-4 h-0.5 bg-gray-400/40 rounded animate-[speed-line_0.4s_linear_infinite_0.1s]" />
        <div className="absolute bottom-10 left-6 w-5 h-0.5 bg-gray-400/30 rounded animate-[speed-line_0.4s_linear_infinite_0.2s]" />
      </div>
      
      {/* Loading text */}
      <div className="text-center px-4">
        <p className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
          Finding your best warranty quote…
        </p>
        <p className="text-sm sm:text-base text-gray-500">
          Give us a few seconds – we're securing the right cover for your vehicle.
        </p>
      </div>
    </div>
  );
};
