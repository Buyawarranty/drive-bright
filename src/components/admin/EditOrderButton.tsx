import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Edit } from 'lucide-react';
import { ManualOrderEntry } from './ManualOrderEntry';

interface EditOrderButtonProps {
  customer: any;
  policy: any;
}

export const EditOrderButton: React.FC<EditOrderButtonProps> = ({ customer, policy }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2"
      >
        <Edit className="h-4 w-4" />
        Edit Order Details
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <ManualOrderEntry 
            customerToEdit={customer}
            policyToEdit={policy}
            onClose={() => setIsOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
