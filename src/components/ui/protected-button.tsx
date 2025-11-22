import React from 'react';
import { Button, ButtonProps } from './button';
import { useClickFraudProtection } from '@/hooks/useClickFraudProtection';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProtectedButtonProps extends Omit<ButtonProps, 'onClick'> {
  onClick: () => Promise<void> | void;
  actionType: string;
  sessionId?: string;
  children: React.ReactNode;
  loading?: boolean;
}

export const ProtectedButton = React.forwardRef<HTMLButtonElement, ProtectedButtonProps>(
  ({ onClick, actionType, sessionId, children, disabled, className, loading = false, ...props }, ref) => {
    const { protectedAction, isValidating } = useClickFraudProtection();

    const handleClick = async () => {
      await protectedAction(actionType, onClick, sessionId);
    };

    const isLoading = loading || isValidating;

    return (
      <Button
        ref={ref}
        onClick={handleClick}
        disabled={disabled || isLoading}
        className={cn(className)}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {loading ? children : 'Validating...'}
          </>
        ) : (
          children
        )}
      </Button>
    );
  }
);

ProtectedButton.displayName = 'ProtectedButton';