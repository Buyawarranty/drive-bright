import React from 'react';
import { CarDrivingSpinner } from '@/components/ui/car-driving-spinner';

const CarSpinnerPreview = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-gray-900">
            Updated Car Spinner Preview
          </h1>
          <p className="text-gray-600">
            Now using the same orange car design from the progress bar
          </p>
        </div>
        
        <div className="bg-white rounded-lg p-8 shadow-lg">
          <CarDrivingSpinner />
        </div>
        
        <div className="text-sm text-gray-500">
          This car design now matches the one used in the progress indicator
        </div>
      </div>
    </div>
  );
};

export default CarSpinnerPreview;