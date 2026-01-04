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
        
        {/* Car - Modern SUV/Jeep shape */}
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 animate-[car-bounce_0.3s_ease-in-out_infinite]">
          <svg width="72" height="38" viewBox="0 0 72 38" className="drop-shadow-lg">
            {/* SUV Body - solid orange, boxy modern shape */}
            <path 
              d="M8 28 L8 16 L14 16 L18 8 L54 8 L58 16 L64 16 L64 28 L8 28" 
              fill="#ea580c"
            />
            
            {/* Wheel wells (cutouts) */}
            <path d="M12 28 L12 24 C12 21 15 18 20 18 C25 18 28 21 28 24 L28 28" fill="#374151" />
            <path d="M44 28 L44 24 C44 21 47 18 52 18 C57 18 60 21 60 24 L60 28" fill="#374151" />
            
            {/* Front windshield - angled */}
            <path 
              d="M50 8 L54 8 L58 16 L54 16 L50 8" 
              fill="#bfdbfe" 
              opacity="0.9"
            />
            {/* Rear windshield */}
            <path 
              d="M18 8 L22 8 L18 16 L14 16 L18 8" 
              fill="#bfdbfe" 
              opacity="0.9"
            />
            {/* Side windows */}
            <rect x="24" y="9" width="24" height="6" rx="1" fill="#bfdbfe" opacity="0.9" />
            {/* Window pillar */}
            <rect x="35" y="9" width="2" height="6" fill="#ea580c" />
            
            {/* Roof rails */}
            <rect x="20" y="6" width="32" height="2" rx="1" fill="#ea580c" />
            
            {/* Front wheel */}
            <g className="origin-center animate-[wheel-spin_0.3s_linear_infinite]" style={{ transformOrigin: '52px 26px' }}>
              <circle cx="52" cy="26" r="7" fill="#1f2937" />
              <circle cx="52" cy="26" r="5" fill="#4b5563" />
              <circle cx="52" cy="26" r="2" fill="#9ca3af" />
              <line x1="52" y1="21" x2="52" y2="31" stroke="#6b7280" strokeWidth="1" />
              <line x1="47" y1="26" x2="57" y2="26" stroke="#6b7280" strokeWidth="1" />
            </g>
            
            {/* Rear wheel */}
            <g className="origin-center animate-[wheel-spin_0.3s_linear_infinite]" style={{ transformOrigin: '20px 26px' }}>
              <circle cx="20" cy="26" r="7" fill="#1f2937" />
              <circle cx="20" cy="26" r="5" fill="#4b5563" />
              <circle cx="20" cy="26" r="2" fill="#9ca3af" />
              <line x1="20" y1="21" x2="20" y2="31" stroke="#6b7280" strokeWidth="1" />
              <line x1="15" y1="26" x2="25" y2="26" stroke="#6b7280" strokeWidth="1" />
            </g>
            
            {/* Headlights - modern LED style */}
            <rect x="62" y="16" width="3" height="4" rx="1" fill="#fef3c7" className="animate-pulse" />
            <rect x="62" y="21" width="3" height="3" rx="1" fill="#fef3c7" opacity="0.7" />
            
            {/* Taillights - modern LED strip */}
            <rect x="7" y="16" width="2" height="4" rx="1" fill="#ef4444" className="animate-pulse" />
            <rect x="7" y="21" width="2" height="3" rx="1" fill="#ef4444" opacity="0.7" />
            
            {/* Front grille */}
            <rect x="63" y="18" width="2" height="6" rx="0.5" fill="#1f2937" />
            
            {/* Door handles */}
            <rect x="30" y="16" width="3" height="1" rx="0.5" fill="#c2410c" />
            <rect x="42" y="16" width="3" height="1" rx="0.5" fill="#c2410c" />
            
            {/* Side mirror */}
            <rect x="56" y="12" width="3" height="2" rx="0.5" fill="#ea580c" />
            
            {/* Exhaust smoke */}
            <g className="animate-[exhaust_0.8s_ease-out_infinite]">
              <circle cx="5" cy="26" r="2" fill="#9ca3af" opacity="0.4" />
            </g>
            <g className="animate-[exhaust_0.8s_ease-out_infinite_0.2s]">
              <circle cx="1" cy="24" r="1.5" fill="#9ca3af" opacity="0.3" />
            </g>
            <g className="animate-[exhaust_0.8s_ease-out_infinite_0.4s]">
              <circle cx="-2" cy="22" r="1" fill="#9ca3af" opacity="0.2" />
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
