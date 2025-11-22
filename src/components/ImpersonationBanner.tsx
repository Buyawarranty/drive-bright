import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Eye, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ImpersonationBannerProps {
  customerName: string;
  customerEmail: string;
  onExit: () => void;
}

export const ImpersonationBanner: React.FC<ImpersonationBannerProps> = ({
  customerName,
  customerEmail,
  onExit,
}) => {
  const navigate = useNavigate();

  const handleExit = () => {
    onExit();
    navigate('/admin-dashboard');
  };

  return (
    <Alert className="bg-yellow-50 border-yellow-500 mb-4">
      <Eye className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-yellow-800">
          <strong>Admin Impersonation Mode:</strong> Viewing as {customerName} ({customerEmail})
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExit}
          className="ml-4 border-yellow-600 text-yellow-700 hover:bg-yellow-100"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Exit Impersonation
        </Button>
      </AlertDescription>
    </Alert>
  );
};
