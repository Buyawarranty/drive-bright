import React, { useState, useEffect, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import PerformanceOptimizedSuspense from '@/components/PerformanceOptimizedSuspense';
import { safeLocalStorageRemove, getWithTimestamp } from '@/utils/localStorage';

// Lazy load the test checkout component
const CustomerDetailsStepTest = lazy(() => import('@/components/CustomerDetailsStepTest'));
const CarJourneyProgress = lazy(() => import('@/components/CarJourneyProgress'));

interface VehicleData {
  regNumber: string;
  mileage: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  address: string;
  make?: string;
  model?: string;
  fuelType?: string;
  transmission?: string;
  year?: string;
  vehicleType?: string;
  isManualEntry?: boolean;
}

const StepTest = () => {
  const navigate = useNavigate();
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if the user has S17DRW registration
    const checkAuthorization = () => {
      try {
        const savedVehicleData = getWithTimestamp('buyawarranty_vehicleData', 30);
        const savedSelectedPlan = getWithTimestamp('buyawarranty_selectedPlan', 30);

        if (savedVehicleData) {
          const parsedVehicleData = JSON.parse(savedVehicleData);
          setVehicleData(parsedVehicleData);

          // Check if registration matches S17DRW (case insensitive, ignore spaces)
          const normalizedReg = (parsedVehicleData.regNumber || '').replace(/\s/g, '').toUpperCase();
          if (normalizedReg === 'S17DRW') {
            setIsAuthorized(true);
          } else {
            console.log('⚠️ Unauthorized access to /steptest - reg:', parsedVehicleData.regNumber);
            setIsAuthorized(false);
          }
        }

        if (savedSelectedPlan) {
          setSelectedPlan(JSON.parse(savedSelectedPlan));
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
      setIsLoading(false);
    };

    checkAuthorization();
  }, []);

  const handleBackToStep3 = () => {
    // Clear original pricing data when going back
    localStorage.removeItem('buyawarranty_originalPricingData');
    navigate('/?step=3');
  };

  const handleCustomerDetailsComplete = (customerData: any) => {
    console.log('Customer details completed:', customerData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-md w-full mx-auto px-6 text-center space-y-6">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <h2 className="text-2xl font-bold text-gray-900">Loading...</h2>
        </div>
      </div>
    );
  }

  // If not authorized (not S17DRW), show message and redirect option
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-white">
        <div className="max-w-md w-full mx-auto px-6 text-center space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Access Restricted</h2>
          <p className="text-gray-600">
            This test page is only available for specific vehicles. Please use the standard checkout.
          </p>
          <Button 
            onClick={() => navigate('/?step=4')}
            className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3"
          >
            Go to Checkout
          </Button>
        </div>
      </div>
    );
  }

  // If missing required data, show recovery option
  if (!vehicleData || !selectedPlan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-white">
        <div className="max-w-md w-full mx-auto px-6 text-center space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Missing Data</h2>
          <p className="text-gray-600">
            We couldn't find your quote details. Please start again.
          </p>
          <Button 
            onClick={() => navigate('/')}
            className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3"
          >
            Start Over
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full">
      {/* Progress Bar */}
      <PerformanceOptimizedSuspense height="120px">
        <CarJourneyProgress 
          currentStep={4}
          onLogoClick={() => {
            safeLocalStorageRemove([
              'buyawarranty_vehicleData',
              'buyawarranty_selectedPlan',
              'buyawarranty_formData',
              'buyawarranty_currentStep',
              'warrantyJourneyState'
            ]);
            navigate('/');
          }}
        />
      </PerformanceOptimizedSuspense>

      {/* Test Checkout with Payment Assist */}
      <div className="bg-[#e8f4fb]">
        <PerformanceOptimizedSuspense height="60vh">
          <CustomerDetailsStepTest
            vehicleData={{
              ...vehicleData,
              make: vehicleData.make || 'Unknown'
            }}
            planId={selectedPlan.id}
            paymentType={selectedPlan.paymentType}
            planName={selectedPlan.name}
            pricingData={{
              basePrice: selectedPlan.pricingData?.totalPrice || 0,
              totalPrice: selectedPlan.pricingData?.totalPrice || 0,
              ...selectedPlan.pricingData
            }}
            onNext={handleCustomerDetailsComplete}
            onBack={handleBackToStep3}
          />
        </PerformanceOptimizedSuspense>
      </div>
    </div>
  );
};

export default StepTest;
