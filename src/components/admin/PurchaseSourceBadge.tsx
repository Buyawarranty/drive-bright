import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Globe, Mail, Phone, CreditCard, Banknote } from 'lucide-react';

export type PurchaseSource = 'website' | 'quote_link' | 'external' | 'bumper' | 'stripe' | 'google_ads' | 'facebook_ads';

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
      case 'bumper_portal':
        return {
          label: 'Bumper',
          icon: Banknote,
          variant: 'default' as const,
          className: 'bg-green-100 text-green-800 hover:bg-green-100 border-green-200',
          tooltip: 'Bumper finance payment'
        };
      case 'google_ads':
        return {
          label: 'Google Ads',
          icon: Globe,
          variant: 'default' as const,
          className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200',
          tooltip: 'Google Ads acquisition'
        };
      case 'facebook_ads':
        return {
          label: 'Facebook Ads',
          icon: Globe,
          variant: 'default' as const,
          className: 'bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200',
          tooltip: 'Facebook Ads acquisition'
        };
      case 'stripe':
      case 'stripe_dashboard':
        return {
          label: 'Stripe',
          icon: CreditCard,
          variant: 'default' as const,
          className: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100 border-indigo-200',
          tooltip: 'Stripe card payment'
        };
      case 'bank_transfer':
        return {
          label: 'Bank Transfer',
          icon: Banknote,
          variant: 'default' as const,
          className: 'bg-teal-100 text-teal-800 hover:bg-teal-100 border-teal-200',
          tooltip: 'Bank transfer payment'
        };
      case 'phone_card':
        return {
          label: 'Phone Card',
          icon: Phone,
          variant: 'default' as const,
          className: 'bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-200',
          tooltip: 'Phone card payment'
        };
      case 'dealer_portal':
        return {
          label: 'Dealer Portal',
          icon: Globe,
          variant: 'default' as const,
          className: 'bg-cyan-100 text-cyan-800 hover:bg-cyan-100 border-cyan-200',
          tooltip: 'Dealer portal payment'
        };
      case 'payment_assist':
        return {
          label: 'Payment Assist',
          icon: CreditCard,
          variant: 'default' as const,
          className: 'bg-pink-100 text-pink-800 hover:bg-pink-100 border-pink-200',
          tooltip: 'Payment Assist finance'
        };
      case 'other':
        return {
          label: 'Other',
          icon: Globe,
          variant: 'outline' as const,
          className: 'bg-gray-100 text-gray-600 hover:bg-gray-100 border-gray-200',
          tooltip: 'Other payment source'
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
