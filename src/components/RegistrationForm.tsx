
import React, { useState, useEffect } from 'react';
import VehicleDetailsStep from './VehicleDetailsStep';

interface RegistrationFormProps {
  onNext: (data: { regNumber: string; mileage: string; email: string; phone: string; firstName: string; lastName: string; address: string; make?: string; model?: string; fuelType?: string; transmission?: string; year?: string; isManualEntry?: boolean }) => void;
  onBack?: (step: number) => void;
  onFormDataUpdate?: (data: any) => void;
  initialData?: {
    regNumber: string;
    mileage: string;
    email: string;
    phone: string;
    firstName?: string;
    address?: string;
    make?: string;
    model?: string;
    fuelType?: string;
    transmission?: string;
    year?: string;
  };
  currentStep: number;
  onStepChange: (step: number) => void;
}

interface VehicleData {
  regNumber: string;
  mileage: string;
  make?: string;
  model?: string;
  fuelType?: string;
  transmission?: string;
  year?: string;
  isManualEntry?: boolean;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({ 
  onNext, 
  onBack, 
  onFormDataUpdate,
  initialData,
  currentStep,
  onStepChange
}) => {
  const handleVehicleNext = (data: VehicleData) => {
    onFormDataUpdate?.(data);
    // Pass empty contact details since we'll collect them in step 2
    onNext({
      ...data,
      email: '',
      phone: '',
      firstName: '',
      lastName: '',
      address: ''
    });
  };

  return (
    <VehicleDetailsStep 
      onNext={handleVehicleNext}
      initialData={initialData}
      onBack={onBack ? () => onBack(1) : undefined}
      onFormDataUpdate={onFormDataUpdate}
      currentStep={currentStep}
      onStepChange={onStepChange}
    />
  );
};

export default RegistrationForm;
