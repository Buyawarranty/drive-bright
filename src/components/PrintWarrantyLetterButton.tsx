import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { PrintableWarrantyLetter } from '@/components/admin/PrintableWarrantyLetter';

interface PrintWarrantyLetterButtonProps {
  policy: {
    customerName: string;
    customerEmail?: string;
    customerAddress?: {
      flatNumber?: string;
      buildingName?: string;
      buildingNumber?: string;
      street?: string;
      town?: string;
      county?: string;
      postcode?: string;
    };
    vehicleReg: string;
    vehicleMake?: string;
    vehicleModel?: string;
    vehicleYear?: string;
    mileage?: string;
    warrantyNumber: string;
    policyNumber: string;
    planType: string;
    policyStartDate: string;
    policyEndDate: string;
    claimLimit?: number;
    voluntaryExcess?: number;
    labourRate?: number;
    breakdownRecovery?: boolean;
    wearTear?: boolean;
    europeCover?: boolean;
    motFee?: boolean;
    motRepair?: boolean;
    tyreCover?: boolean;
    lostKey?: boolean;
    vehicleRental?: boolean;
    transferCover?: boolean;
    consequential?: boolean;
    seasonalBonusMonths?: number;
    additionalNotes?: string;
  };
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export const PrintWarrantyLetterButton: React.FC<PrintWarrantyLetterButtonProps> = ({
  policy,
  variant = 'outline',
  size = 'default',
  className,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setDialogOpen(true)}
      >
        <Printer className="h-4 w-4 mr-2" />
        Print Confirmation Letter
      </Button>

      <PrintableWarrantyLetter
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        policy={policy}
      />
    </>
  );
};
