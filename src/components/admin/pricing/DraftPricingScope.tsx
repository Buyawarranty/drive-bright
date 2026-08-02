import React, { useEffect, useState } from 'react';
import {
  getLivePricingOverride,
  setLivePricingOverride,
  type PricingMatrixShape,
} from '@/lib/pricingMatrix';

interface DraftPricingScopeProps {
  /** Draft admin matrix to apply while this subtree is mounted. */
  matrix: PricingMatrixShape;
  /** Website discount off Quotes & Orders. */
  discountPct: number;
  /** When false, leave the live prices untouched. */
  active: boolean;
  children: React.ReactNode;
}

/**
 * Temporarily swaps the in-memory pricing override to a DRAFT matrix so the
 * Quotes & Orders preview shows the prices being tested — never persisted, and
 * always restored to the real live prices on unmount / toggle off.
 */
export default function DraftPricingScope({
  matrix,
  discountPct,
  active,
  children,
}: DraftPricingScopeProps) {
  // Force the child tree to remount whenever the applied prices change so any
  // memoised quote figures recompute from the new matrix.
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const previous = getLivePricingOverride();
    if (active) {
      setLivePricingOverride(matrix, discountPct);
    }
    setEpoch(e => e + 1);
    return () => {
      setLivePricingOverride(previous.adminMatrix, previous.step3DiscountPct);
    };
  }, [active, matrix, discountPct]);

  return <React.Fragment key={epoch}>{children}</React.Fragment>;
}
