import { Badge } from '@/components/ui/badge';
import { Store, Globe, GitCompare } from 'lucide-react';

interface PriceSurfaceBadgeProps {
  /** Which price surface this section shows by default. */
  surface: 'quotes' | 'web' | 'mixed';
  /** Optional discount percentage shown when this is a web price. */
  discountPct?: number | null;
  /** Optional size variant. */
  size?: 'sm' | 'md';
}

/**
 * Reusable badge that makes it immediately obvious whether a price section is
 * showing Quotes & Orders (agent) prices, website (customer) prices, or both.
 */
export function PriceSurfaceBadge({
  surface,
  discountPct,
  size = 'md',
}: PriceSurfaceBadgeProps) {
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1';

  if (surface === 'web') {
    return (
      <Badge
        variant="outline"
        className={`gap-1 border-sky-300 bg-sky-50 text-sky-700 dark:bg-sky-950/30 ${sizeClasses}`}
      >
        <Globe className="h-3 w-3" />
        Website price
        {discountPct ? ` · ${discountPct}% off Q&O` : null}
      </Badge>
    );
  }

  if (surface === 'mixed') {
    return (
      <Badge
        variant="outline"
        className={`gap-1 border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-950/30 ${sizeClasses}`}
      >
        <GitCompare className="h-3 w-3" />
        Quotes & Orders + website columns
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={`gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 ${sizeClasses}`}
    >
      <Store className="h-3 w-3" />
      Quotes & Orders price
    </Badge>
  );
}

export default PriceSurfaceBadge;
