import React from 'react';
import BrandLandingPage from '@/components/BrandLandingPage';

interface VehicleData {
  regNumber: string;
  mileage: string;
  make?: string;
  model?: string;
  fuelType?: string;
  transmission?: string;
  year?: string;
  vehicleType?: string;
  blocked?: boolean;
  blockReason?: string;
  manufactureDate?: string;
}

interface BMWWarrantyLandingProps {
  onRegistrationSubmit: (vehicleData: VehicleData) => void;
}

const BMWWarrantyLanding: React.FC<BMWWarrantyLandingProps> = ({ onRegistrationSubmit }) => {
  return (
    <BrandLandingPage
      onRegistrationSubmit={onRegistrationSubmit}
      brandName="BMW"
      brandLogo="https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/BMW.svg/800px-BMW.svg.png"
      h1Override="BMW Extended Warranty"
      metaTitle="BMW Extended Warranty UK | Affordable BMW Car Warranty Plans | Buy A Warranty"
      metaDescription="Protect your BMW with our comprehensive extended warranty plans. Cover for all BMW models including 1 Series, 3 Series, 5 Series, X3, X5 and more. From just 80p a day with unlimited claims."
      canonicalUrl="https://buyawarranty.co.uk/warranty-types/bmw"
    />
  );
};

export default BMWWarrantyLanding;
