import React from 'react';
import { AlertCircle } from 'lucide-react';

const MaintenanceBanner: React.FC = () => {
  return (
    <div className="w-full bg-red-50 border border-red-200 animate-bounce-slow">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-center gap-3">
          <div className="flex-shrink-0">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          </div>
          <p className="text-red-800 text-base font-medium text-center">
            We're upgrading our systems to serve you better. Back online in a few days. Thanks for your patience!
          </p>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceBanner;