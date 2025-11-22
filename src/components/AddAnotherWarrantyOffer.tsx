import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Check } from 'lucide-react';

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
        <h3 className="text-lg font-medium mb-3">
          Get 10% off a 2nd warranty today
          <span className="block text-sm opacity-70">(after checkout)</span>
        </h3>
        
        <Button
          type="button"
          onClick={handleClick}
          className={isSelected 
            ? "bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4" 
            : "bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4"
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
        
        {isSelected && (
          <p className="text-sm opacity-70 mt-2">
            ✓ You'll get 10% off your next warranty after completing this purchase
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default AddAnotherWarrantyOffer;