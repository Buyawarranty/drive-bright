import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useImpersonation } from '@/hooks/useImpersonation';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ViewAsCustomerButtonProps {
  customerId: string;
  customerEmail: string;
  customerName: string;
}

export const ViewAsCustomerButton: React.FC<ViewAsCustomerButtonProps> = ({
  customerId,
  customerEmail,
  customerName,
}) => {
  const navigate = useNavigate();
  const { startImpersonation } = useImpersonation();

  const handleViewAsCustomer = () => {
    // Start impersonation mode
    startImpersonation(customerId, customerEmail, customerName);
    
    // Show toast notification
    toast.success(`Now viewing as ${customerName}`, {
      description: 'You can view their customer dashboard without logging out',
    });
    
    // Navigate to customer dashboard
    navigate('/customer-dashboard');
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            size="sm"
            onClick={handleViewAsCustomer}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md"
          >
            <Eye className="h-4 w-4" />
            View as Customer
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-medium mb-1">Safe Impersonation Mode</p>
          <p className="text-sm">View this customer's dashboard without logging out of your admin account. Your admin session stays active in other tabs.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
