// Utility functions for warranty calculations that match the edge function logic
import { getWarrantyDurationInMonths, getWarrantyDurationDisplay, getPaymentTypeDisplay } from './warrantyDurationUtils';

// Re-export the master functions to maintain backward compatibility
export function getWarrantyDuration(paymentType: string): number {
  return getWarrantyDurationInMonths(paymentType);
}

export { getWarrantyDurationDisplay, getPaymentTypeDisplay };