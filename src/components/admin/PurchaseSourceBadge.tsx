import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Globe, Mail, Phone, CreditCard, Banknote } from 'lucide-react';

export type PurchaseSource = 'website' | 'quote_link' | 'external' | 'bumper' | 'stripe';

interface PurchaseSourceBadgeProps {
  source?: PurchaseSource | string | null;
  bumperOrderId?: string | null;
  stripeSessionId?: string | null;
  className?: string;
}

/**
 * Displays a badge indicating how the customer purchased their warranty:
 * - Website: Direct purchase from the website
 * - Quote Link: Purchased via admin-sent quote link
 * - External: External payment confirmed manually by admin
 * - Bumper: Bumper finance payment
 * - Stripe: Stripe card payment
 */
export const PurchaseSourceBadge: React.FC<PurchaseSourceBadgeProps> = ({ 
  source, 
  bumperOrderId,
  stripeSessionId,
  className = '' 
}) => {
  // Smart fallback: derive source from payment IDs if source is not set
  const effectiveSource = source || 
    (bumperOrderId ? 'bumper' : null) || 
    (stripeSessionId ? 'stripe' : null);

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
      case 'bumper':
        return {
          label: 'Bumper',
          icon: Banknote,
          variant: 'default' as const,
          className: 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200',
          tooltip: 'Bumper finance payment'
        };
      case 'stripe':
        return {
          label: 'Stripe',
          icon: CreditCard,
          variant: 'default' as const,
          className: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100 border-indigo-200',
          tooltip: 'Stripe card payment'
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

  const config = getSourceConfig(effectiveSource);
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
