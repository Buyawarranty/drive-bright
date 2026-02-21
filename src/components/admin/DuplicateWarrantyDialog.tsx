import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { PurchaseSourceBadge } from '@/components/admin/PurchaseSourceBadge';

interface DuplicateWarrantyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  record?: {
    name: string;
    email: string;
    registration_plate: string;
    warranty_reference_number: string | null;
    warranty_number: string | null;
    plan_type: string;
    status: string;
    signup_date: string;
    final_amount: number | null;
    purchase_source: string | null;
  };
}

export const DuplicateWarrantyDialog: React.FC<DuplicateWarrantyDialogProps> = ({
  isOpen,
  onClose,
  record,
}) => {
  if (!record) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Possible Duplicate Order
          </DialogTitle>
          <DialogDescription>
            It's possible the customer may have already placed a similar order online, so there might be a duplicate. 
            Let's double‑check just to be sure. Please check the <strong>Customers</strong> tab to view it, 
            or contact your administrator if you're unable to locate it.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border-2 border-destructive/20 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="font-mono font-bold text-sm">
              {record.warranty_reference_number || record.warranty_number || 'N/A'}
            </span>
            <PurchaseSourceBadge source={record.purchase_source} />
          </div>
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Customer:</span>
              <p className="font-medium">{record.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Email:</span>
              <p className="font-medium">{record.email}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Reg Plate:</span>
              <p className="font-medium">{record.registration_plate}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Plan:</span>
              <p className="font-medium">{record.plan_type}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Amount:</span>
              <p className="font-medium">£{record.final_amount?.toFixed(2) || 'N/A'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Paid:</span>
              <p className="font-medium">
                {format(new Date(record.signup_date), 'dd/MM/yyyy HH:mm')}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>
            Understood
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
