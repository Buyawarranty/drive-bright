import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Check, Car } from 'lucide-react';

interface AddAnotherWarrantyOfferProps {
  onAddAnotherWarranty: () => void;
}

const AddAnotherWarrantyOffer: React.FC<AddAnotherWarrantyOfferProps> = ({ onAddAnotherWarranty }) => {
  const [isSelected, setIsSelected] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent any form submission or page jumping
    e.stopPropagation(); // Stop event bubbling
    
    if (!isSelected) {
      setIsSelected(true);
      onAddAnotherWarranty();
    }
  };

  return (
    <Card className="neutral-container shadow-lg shadow-black/15 mb-6 border-0">
      <CardContent className="p-6">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
            <Car className="w-5 h-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Add Another Vehicle & Save 10% Today
            </h3>
            <p className="text-sm text-gray-600">
              Protect all your vehicles under one account and enjoy instant savings.
            </p>
          </div>
        </div>
        
        <Button
          type="button"
          onClick={handleClick}
          className={isSelected 
            ? "bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 w-full" 
            : "bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 w-full"
          }
          disabled={isSelected}
        >
          {isSelected ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Selected for after checkout
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Add Another Warranty
            </>
          )}
        </Button>
        
        {!isSelected && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            Takes less than 60 seconds
          </p>
        )}
        
        {isSelected && (
          <p className="text-sm text-green-700 mt-2 flex items-center gap-1">
            <Check className="w-4 h-4" />
            You'll get 10% off your next warranty after completing this purchase
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default AddAnotherWarrantyOffer;