import React from 'react';
import pandaLoadingImage from '@/assets/panda-loading.png';

export const PandaLoadingSpinner = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-orange-50 flex items-center justify-center">
      <div className="text-center space-y-8">
        {/* Loading text */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">
            Getting your quote ready...
          </h2>
          <p className="text-gray-600">
            Our panda is working hard to find you the best deal!
          </p>
        </div>
        
        {/* Animated panda with car */}
        <div className="relative">
          {/* Road */}
          <div className="w-96 h-4 bg-gray-600 rounded-full relative overflow-hidden mx-auto mb-8">
            {/* Road markings */}
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white transform -translate-y-1/2">
              <div className="flex space-x-4 animate-pulse">
                <div className="w-8 h-0.5 bg-white"></div>
                <div className="w-8 h-0.5 bg-white"></div>
                <div className="w-8 h-0.5 bg-white"></div>
                <div className="w-8 h-0.5 bg-white"></div>
                <div className="w-8 h-0.5 bg-white"></div>
              </div>
            </div>
          </div>
          
          {/* Panda in car - animated to drive across */}
          <div className="relative w-96 h-32 mx-auto">
            <div className="absolute animate-[drive_3s_ease-in-out_infinite] w-24 h-24">
              <img 
                src={pandaLoadingImage} 
                alt="Panda driving car" 
                className="w-full h-full object-contain drop-shadow-lg"
              />
            </div>
          </div>
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