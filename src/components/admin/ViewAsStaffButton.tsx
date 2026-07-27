import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { useViewAs } from '@/contexts/ViewAsContext';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ViewAsStaffButtonProps {
  /** admin_users.id of the staff member */
  adminUserId: string;
  /** Whether the signed-in user is allowed to impersonate (super_admin only) */
  canImpersonate: boolean;
}

/**
 * "View as staff" — mirrors the customer-management "View as Customer" flow,
 * but switches the admin dashboard into the selected sales agent's view.
 */
export const ViewAsStaffButton: React.FC<ViewAsStaffButtonProps> = ({
  adminUserId,
  canImpersonate,
}) => {
  const { availableAgents, viewAsAgent, setViewAsAgent } = useViewAs();

  if (!canImpersonate) return null;

  const agent = availableAgents.find(a => a.id === adminUserId);
  const isActive = viewAsAgent?.id === adminUserId;

  if (!agent && !isActive) return null;

  const handleClick = () => {
    if (isActive) {
      setViewAsAgent(null);
      toast.success('Back to your own view');
      return;
    }
    setViewAsAgent(agent!);
    const name = `${agent!.firstName} ${agent!.lastName}`.trim() || agent!.email;
    toast.success(`Now viewing as ${name}`, {
      description: 'Every dashboard tab now shows what they see. Switch back any time.',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant={isActive ? 'outline' : 'default'}
            onClick={handleClick}
            className={isActive
              ? 'border-amber-500 text-amber-700 hover:bg-amber-50'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'}
          >
            {isActive ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {isActive ? 'Stop viewing' : 'View as staff'}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-medium mb-1">Safe staff view</p>
          <p className="text-sm">
            See the admin dashboard exactly as this staff member does — their tabs, leads and
            permissions — without logging out of your own account.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ViewAsStaffButton;
