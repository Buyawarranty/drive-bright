import React, { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import HomepageAlt from '@/components/HomepageAlt';

// Live test of the Miles chat widget on this page only (not the homepage yet).
const SiteChatWidget = lazy(() => import('@/components/ai-sandbox/SiteChatWidget'));

interface VehicleData {
  registration: string;
  make: string;
  model: string;
  year: string;
  fuel: string;
  color: string;
  mileage: string;
}

const UsedCarWarrantyUK = () => {
  const navigate = useNavigate();
  const [, setVehicleData] = useState<VehicleData | null>(null);

  const handleRegistrationSubmit = (data: VehicleData) => {
    setVehicleData(data);
    sessionStorage.setItem('vehicleData', JSON.stringify(data));
    navigate('/warranty-plan/');
  };

  return (
    <div>
      <HomepageAlt onRegistrationSubmit={handleRegistrationSubmit} />
      <Suspense fallback={null}>
        <SiteChatWidget source="used-car-warranty-uk" greeting="Hi — any questions about your price?" />
      </Suspense>
    </div>
  );
};

export default UsedCarWarrantyUK;
