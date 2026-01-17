import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Globe, Mail, Phone } from 'lucide-react';

export type PurchaseSource = 'website' | 'quote_link' | 'external';

interface PurchaseSourceBadgeProps {
  source?: PurchaseSource | string | null;
  className?: string;
}

/**
 * Displays a badge indicating how the customer purchased their warranty:
 * - Website: Direct purchase from the website
 * - Quote Link: Purchased via admin-sent quote link
 * - External: External payment confirmed manually by admin
 */
export const PurchaseSourceBadge: React.FC<PurchaseSourceBadgeProps> = ({ 
  source, 
  className = '' 
}) => {
  const getSourceConfig = (src: string | null | undefined) => {
    switch (src) {
      case 'website':
        return {
          label: 'Website',
          icon: Globe,
          variant: 'default' as const,
          className: 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200',
          tooltip: 'Direct website purchase'
        };
      case 'quote_link':
        return {
          label: 'Quote Link',
          icon: Mail,
          variant: 'secondary' as const,
          className: 'bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-200',
          tooltip: 'Purchased via admin-sent quote'
        };
      case 'external':
        return {
          label: 'External',
          icon: Phone,
          variant: 'outline' as const,
          className: 'bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200',
          tooltip: 'External payment (manually confirmed)'
        };
      default:
        return {
          label: 'Unknown',
          icon: Globe,
          variant: 'outline' as const,
          className: 'bg-gray-100 text-gray-600 hover:bg-gray-100 border-gray-200',
          tooltip: 'Source not recorded'
        };
    }
  };

  const config = getSourceConfig(source);
  const Icon = config.icon;

  return (
    <Badge 
      variant={config.variant}
      className={`${config.className} ${className} inline-flex items-center gap-1 text-xs font-medium`}
      title={config.tooltip}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
};

export default PurchaseSourceBadge;
