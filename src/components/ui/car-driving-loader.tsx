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
        
        {/* Car - side view */}
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 animate-[car-bounce_0.3s_ease-in-out_infinite]">
          <svg width="64" height="40" viewBox="0 0 64 40" className="drop-shadow-lg">
            {/* Car body - main */}
            <path 
              d="M8 24 L12 24 L14 16 L26 12 L48 12 L54 16 L56 24 L56 28 L8 28 L8 24" 
              fill="#ea580c" 
              className="drop-shadow-sm"
            />
            {/* Car body - roof */}
            <path 
              d="M18 12 L26 6 L44 6 L48 12" 
              fill="#f97316" 
            />
            {/* Windshield */}
            <path 
              d="M26 7 L28 12 L20 12 L26 7" 
              fill="#bfdbfe" 
              opacity="0.9"
            />
            {/* Rear window */}
            <path 
              d="M44 7 L42 12 L48 12 L44 7" 
              fill="#bfdbfe" 
              opacity="0.9"
            />
            {/* Side windows */}
            <rect x="30" y="7" width="10" height="5" rx="1" fill="#bfdbfe" opacity="0.9" />
            
            {/* Front wheel */}
            <g className="origin-center animate-[wheel-spin_0.3s_linear_infinite]" style={{ transformOrigin: '48px 28px' }}>
              <circle cx="48" cy="28" r="6" fill="#1f2937" />
              <circle cx="48" cy="28" r="4" fill="#4b5563" />
              <circle cx="48" cy="28" r="2" fill="#9ca3af" />
              {/* Wheel spokes */}
              <line x1="48" y1="24" x2="48" y2="32" stroke="#6b7280" strokeWidth="1" />
              <line x1="44" y1="28" x2="52" y2="28" stroke="#6b7280" strokeWidth="1" />
            </g>
            
            {/* Rear wheel */}
            <g className="origin-center animate-[wheel-spin_0.3s_linear_infinite]" style={{ transformOrigin: '16px 28px' }}>
              <circle cx="16" cy="28" r="6" fill="#1f2937" />
              <circle cx="16" cy="28" r="4" fill="#4b5563" />
              <circle cx="16" cy="28" r="2" fill="#9ca3af" />
              {/* Wheel spokes */}
              <line x1="16" y1="24" x2="16" y2="32" stroke="#6b7280" strokeWidth="1" />
              <line x1="12" y1="28" x2="20" y2="28" stroke="#6b7280" strokeWidth="1" />
            </g>
            
            {/* Headlight */}
            <ellipse cx="55" cy="20" rx="2" ry="3" fill="#fef3c7" className="animate-pulse" />
            
            {/* Taillight */}
            <rect x="8" y="18" width="2" height="4" rx="1" fill="#ef4444" className="animate-pulse" />
            
            {/* Door handle */}
            <rect x="32" y="16" width="4" height="1" rx="0.5" fill="#c2410c" />
            
            {/* Exhaust smoke */}
            <g className="animate-[exhaust_0.8s_ease-out_infinite]">
              <circle cx="6" cy="26" r="2" fill="#9ca3af" opacity="0.4" />
            </g>
            <g className="animate-[exhaust_0.8s_ease-out_infinite_0.2s]">
              <circle cx="2" cy="24" r="1.5" fill="#9ca3af" opacity="0.3" />
            </g>
            <g className="animate-[exhaust_0.8s_ease-out_infinite_0.4s]">
              <circle cx="-1" cy="22" r="1" fill="#9ca3af" opacity="0.2" />
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
