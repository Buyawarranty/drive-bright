import React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type PresenceStatus = 'active' | 'idle' | 'offline';

interface PresenceBadgeProps {
  status: PresenceStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  lastInteractionAt?: Date | string | null;
  className?: string;
}

export const PresenceBadge: React.FC<PresenceBadgeProps> = ({
  status,
  showLabel = false,
  size = 'md',
  lastInteractionAt,
  className
}) => {
  const statusConfig = {
    active: {
      color: 'bg-green-500',
      pulseColor: 'bg-green-400',
      label: 'Active',
      description: 'Currently active'
    },
    idle: {
      color: 'bg-amber-500',
      pulseColor: 'bg-amber-400',
      label: 'Idle',
      description: 'Away from desk'
    },
    offline: {
      color: 'bg-gray-400',
      pulseColor: 'bg-gray-300',
      label: 'Offline',
      description: 'Not available'
    }
  };

  const sizeConfig = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3'
  };

  const config = statusConfig[status];
  const sizeClass = sizeConfig[size];

  const formatLastInteraction = (date: Date | string | null | undefined): string => {
    if (!date) return 'Unknown';
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  };

  const badge = (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span className="relative flex">
        <span
          className={cn(
            sizeClass,
            config.color,
            'rounded-full'
          )}
        />
        {status === 'active' && (
          <span
            className={cn(
              sizeClass,
              config.pulseColor,
              'absolute rounded-full animate-ping opacity-75'
            )}
          />
        )}
      </span>
      {showLabel && (
        <span className={cn(
          'text-xs font-medium',
          status === 'active' && 'text-green-600',
          status === 'idle' && 'text-amber-600',
          status === 'offline' && 'text-gray-500'
        )}>
          {config.label}
        </span>
      )}
    </div>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <div className="space-y-1">
          <div className="font-medium">{config.description}</div>
          {lastInteractionAt && (
            <div className="text-muted-foreground">
              Last activity: {formatLastInteraction(lastInteractionAt)}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
