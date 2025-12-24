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

interface MercedesWarrantyLandingProps {
  onRegistrationSubmit: (vehicleData: VehicleData) => void;
}

const MercedesWarrantyLanding: React.FC<MercedesWarrantyLandingProps> = ({ onRegistrationSubmit }) => {
  return (
    <BrandLandingPage
      onRegistrationSubmit={onRegistrationSubmit}
      brandName="Mercedes-Benz"
      brandLogo="https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Mercedes-Logo.svg/800px-Mercedes-Logo.svg.png"
      h1Override="Mercedes-Benz Extended Warranty"
      metaTitle="Mercedes Extended Warranty UK | Affordable Mercedes Car Warranty Plans | Buy A Warranty"
      metaDescription="Protect your Mercedes-Benz with our comprehensive extended warranty plans. Cover for all Mercedes models including A-Class, C-Class, E-Class, GLC, GLE and more. From just 80p a day with unlimited claims."
      canonicalUrl="https://buyawarranty.co.uk/warranty-types/mercedes"
    />
  );
};

export default MercedesWarrantyLanding;
