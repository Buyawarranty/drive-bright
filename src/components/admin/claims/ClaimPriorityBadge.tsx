import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowUp, Minus, ArrowDown } from 'lucide-react';

interface ClaimPriorityBadgeProps {
  priority: string;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  urgent: {
    label: 'Urgent',
    color: '#DC2626',
    bgColor: '#FEE2E2',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  high: {
    label: 'High',
    color: '#EA580C',
    bgColor: '#FFEDD5',
    icon: <ArrowUp className="h-3 w-3" />,
  },
  normal: {
    label: 'Normal',
    color: '#2563EB',
    bgColor: '#DBEAFE',
    icon: <Minus className="h-3 w-3" />,
  },
  low: {
    label: 'Low',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    icon: <ArrowDown className="h-3 w-3" />,
  },
};

export const ClaimPriorityBadge: React.FC<ClaimPriorityBadgeProps> = ({ priority }) => {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.normal;

  return (
    <Badge
      variant="outline"
      className="flex items-center gap-1 text-xs font-medium"
      style={{
        backgroundColor: config.bgColor,
        borderColor: config.color,
        color: config.color,
      }}
    >
      {config.icon}
      {config.label}
    </Badge>
  );
};
