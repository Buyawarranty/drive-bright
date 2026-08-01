import { AlertTriangle, Info, Ban } from 'lucide-react';
import { evaluateTermEligibility, type EligibilityInput } from '@/lib/pricing/termEligibility';

/**
 * Light, non-blocking notice for sales staff explaining which warranty terms
 * are available for this vehicle (Section 7 — eligibility and term controls).
 */
export function TermEligibilityNotice({
  ageYears,
  mileage,
  veryHighRisk,
  referralOrExcluded,
  className = '',
}: EligibilityInput & { className?: string }) {
  const result = evaluateTermEligibility({ ageYears, mileage, veryHighRisk, referralOrExcluded });
  if (!result.warning) return null;

  const styles =
    result.severity === 'blocked'
      ? 'border-destructive/40 bg-destructive/10 text-destructive'
      : result.severity === 'warning'
        ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400'
        : 'border-border bg-muted/50 text-muted-foreground';

  const Icon = result.severity === 'blocked' ? Ban : result.severity === 'warning' ? AlertTriangle : Info;

  const terms = result.allowedTerms.length
    ? result.allowedTerms.map(m => `${m / 12} year${m === 12 ? '' : 's'}`).join(', ')
    : 'None automatically';

  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${styles} ${className}`}>
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="space-y-0.5">
        <p className="font-semibold">{result.band}</p>
        <p>{result.warning}</p>
        <p className="opacity-80">Terms available: {terms}</p>
      </div>
    </div>
  );
}
